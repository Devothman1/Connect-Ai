import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, Chat, GenerateContentResponse, Part } from "@google/genai";
import { ChatMessage, MessageRole } from '../types';
import { ChatMessageComponent } from './ChatMessage';
import { SendIcon, PaperclipIcon, XCircleIcon, SquareIcon, EyeIcon } from './Icons';

// --- Gemini Service Functions (adapted for this component) ---

const initializeVisionChat = (history: ChatMessage[] = []): Chat => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key is not configured. Please ensure the API_KEY environment variable is set.");
  }
  const ai = new GoogleGenAI({ apiKey });
  return ai.chats.create({
    model: 'gemini-2.5-flash', // This model supports multimodal input
    history: history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    })),
  });
};

const streamVisionResponse = async (chat: Chat, prompt: string, images: Array<{ data: string, type: string }>, signal?: AbortSignal): Promise<AsyncGenerator<GenerateContentResponse>> => {
    const parts: Part[] = [{ text: prompt }];
    const imageParts = images.map(img => ({ inlineData: { data: img.data, mimeType: img.type } }));
    parts.unshift(...imageParts);
    
    const stream = await chat.sendMessageStream({ message: parts });

    async function* wrappedStream(): AsyncGenerator<GenerateContentResponse> {
        for await (const chunk of stream) {
            if (signal?.aborted) {
                console.log("Stream generation aborted by user.");
                break;
            }
            yield chunk;
        }
    }
    return wrappedStream();
};


// --- Component ---

export const VisionView: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [selectedImages, setSelectedImages] = useState<Array<{ data: string, type: string, name: string }>>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    const chatRef = useRef<Chat | null>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        chatContainerRef.current?.scrollTo(0, chatContainerRef.current.scrollHeight);
    }, [messages, isLoading]);

    const handleSend = async () => {
        if ((!input.trim() && selectedImages.length === 0) || isLoading) return;

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            role: MessageRole.USER,
            content: input.trim(),
            imageUrls: selectedImages.map(img => `data:${img.type};base64,${img.data}`),
        };

        const currentImages = [...selectedImages];
        setInput('');
        setSelectedImages([]);
        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);
        
        const modelMessageId = (Date.now() + 1).toString();

        try {
            chatRef.current = initializeVisionChat(messages);
            setMessages(prev => [...prev, { id: modelMessageId, role: MessageRole.MODEL, content: '' }]);
            abortControllerRef.current = new AbortController();
            
            const stream = await streamVisionResponse(chatRef.current, userMessage.content, currentImages, abortControllerRef.current.signal);
            let fullResponse = '';
            for await (const chunk of stream) {
                const chunkText = chunk.text;
                if (chunkText) {
                    fullResponse += chunkText;
                    setMessages(prev => prev.map(m => m.id === modelMessageId ? { ...m, content: fullResponse } : m));
                }
            }
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
            setMessages(prev => prev.map(m => m.id === modelMessageId ? { ...m, content: `**Error:** ${errorMessage}` } : m));
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;

        // FIX: Explicitly type `file` as `File` to resolve TypeScript errors where
        // it was being inferred as `unknown`.
        Array.from(files).forEach((file: File) => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64String = (reader.result as string).split(',')[1];
                    setSelectedImages(prev => [...prev, { data: base64String, type: file.type, name: file.name }]);
                };
                reader.readAsDataURL(file);
            }
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeImage = (index: number) => {
        setSelectedImages(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="flex flex-col h-full bg-gray-900 text-white">
            <main ref={chatContainerRef} className="flex-1 overflow-y-auto p-4">
                <div className="max-w-4xl mx-auto">
                    {messages.length === 0 && !isLoading ? (
                        <div className="flex flex-col items-center justify-center text-gray-400 text-center pt-16">
                            <EyeIcon className="w-16 h-16 mb-4 text-gray-500" />
                            <h2 className="text-2xl font-bold text-gray-300">Vision Studio</h2>
                            <p className="mt-2">Upload one or more images and ask me anything about them!</p>
                        </div>
                    ) : (
                        messages.map((msg, index) => (
                            <ChatMessageComponent
                                key={msg.id}
                                message={msg}
                                isStreaming={isLoading && index === messages.length - 1}
                                isLastMessage={index === messages.length - 1}
                                onPlayAudio={() => {}} onStopAudio={() => {}} onRegenerate={() => {}} onEdit={() => {}}
                                currentlySpeakingMessageId={null}
                            />
                        ))
                    )}
                </div>
            </main>

            <div className="bg-gray-800 p-4 border-t border-gray-700">
                <div className="max-w-4xl mx-auto flex flex-col">
                     {selectedImages.length > 0 && (
                        <div className="mb-2 p-2 bg-gray-700 rounded-lg">
                            <div className="flex gap-2 flex-wrap">
                                {selectedImages.map((img, index) => (
                                    <div key={index} className="relative">
                                        <img src={`data:${img.type};base64,${img.data}`} alt={img.name} className="w-16 h-16 rounded object-cover" />
                                        <button onClick={() => removeImage(index)} className="absolute -top-2 -right-2 p-0.5 bg-gray-800 rounded-full text-gray-400 hover:text-white" title="Remove image">
                                            <XCircleIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                     {isLoading && (
                        <div className="flex justify-center mb-2">
                             <button onClick={() => abortControllerRef.current?.abort()} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md text-white bg-red-600 hover:bg-red-500 transition-colors">
                                <SquareIcon className="w-4 h-4" /> Stop
                            </button>
                        </div>
                    )}
                    <div className="flex items-end gap-3">
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" multiple className="hidden" />
                        <button onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="p-3 rounded-full bg-gray-600 text-gray-300 hover:bg-gray-500 transition-colors disabled:opacity-50" title="Attach images">
                            <PaperclipIcon />
                        </button>
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
                            placeholder="Ask a question about the image(s)..."
                            disabled={isLoading}
                            className="flex-1 bg-gray-700 text-white rounded-2xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent-color-500)] disabled:opacity-50 max-h-48"
                            rows={1}
                        />
                        <button onClick={handleSend} disabled={isLoading || (!input.trim() && selectedImages.length === 0)} className="bg-[var(--accent-color-600)] text-white p-3 rounded-full hover:bg-[var(--accent-color-500)] disabled:bg-gray-600 transition-colors" title="Send">
                            <SendIcon />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};