

import React, { useRef, useEffect, useState } from 'react';
import { SendIcon, MicrophoneIcon, StopIcon, PaperclipIcon, XCircleIcon, SquareIcon } from './Icons';

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  handleSend: (image?: { data: string, type: string }) => void;
  isLoading: boolean;
  onStopGenerating: () => void;
}

// Check for SpeechRecognition API
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
if (recognition) {
  recognition.continuous = true;
  recognition.interimResults = true;
}

export const ChatInput: React.FC<ChatInputProps> = ({ input, setInput, handleSend, isLoading, onStopGenerating }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isListening, setIsListening] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ data: string, type: string, name: string } | null>(null);
  const [textBeforeSpeech, setTextBeforeSpeech] = useState('');

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  useEffect(() => {
    if (!recognition) return;

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      
      const separator = textBeforeSpeech.trim().length > 0 ? ' ' : '';
      const fullTranscript = finalTranscript + interimTranscript;

      // Use the text from before recognition started as a base,
      // then append the live transcript. This prevents duplication
      // and handles corrections properly.
      setInput(textBeforeSpeech + (fullTranscript ? separator + fullTranscript : ''));
    };

    recognition.onend = () => {
      if (isListening) {
        setIsListening(false);
      }
    };
    
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (isListening) {
        setIsListening(false);
      }
    };

    return () => {
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
      if (recognition.stop) {
        recognition.stop();
      }
    }
  }, [isListening, textBeforeSpeech, setInput]);
  
  const handleLocalSend = () => {
    if (!isLoading) {
      handleSend(selectedImage ?? undefined);
      setSelectedImage(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleLocalSend();
    }
  };

  const toggleListen = () => {
    if (isListening) {
      recognition?.stop();
      setIsListening(false);
    } else {
      setTextBeforeSpeech(input);
      recognition?.start();
      setIsListening(true);
    }
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setSelectedImage({ data: base64String, type: file.type, name: file.name });
      };
      reader.readAsDataURL(file);
    }
     // Reset file input value to allow re-selection of the same file
     if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-4 border-t border-gray-200 dark:border-gray-700">
      <div className="max-w-4xl mx-auto flex flex-col">
        {selectedImage && (
          <div className="mb-2 bg-gray-100 dark:bg-gray-700 p-2 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src={`data:${selectedImage.type};base64,${selectedImage.data}`} alt="Preview" className="w-12 h-12 rounded object-cover" />
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{selectedImage.name}</span>
              </div>
              <button onClick={() => setSelectedImage(null)} className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white" title="Remove image">
                  <XCircleIcon className="w-6 h-6" />
              </button>
          </div>
        )}
        {isLoading && (
            <div className="flex justify-center mb-2">
                <button 
                    onClick={onStopGenerating}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md text-white bg-red-600 hover:bg-red-500 transition-colors"
                >
                    <SquareIcon className="w-4 h-4" />
                    Stop Generating
                </button>
            </div>
        )}
        <div className="flex items-end gap-3">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
          <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="p-3 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800 focus:ring-black dark:focus:ring-white disabled:opacity-50"
              aria-label="Attach image"
              title="Attach image"
          >
              <PaperclipIcon />
          </button>
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? "Listening..." : "Message Connect Ai..."}
            disabled={isLoading}
            className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-2xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent-color-500)] disabled:opacity-50 max-h-48"
          />
          {recognition && (
            <button
              onClick={toggleListen}
              disabled={isLoading}
              className={`p-3 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800 focus:ring-black dark:focus:ring-white disabled:opacity-50 ${
                isListening
                  ? 'bg-red-500 text-white ring-4 ring-red-500/30 animate-pulse'
                  : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
              }`}
              aria-label={isListening ? 'Stop listening' : 'Start listening'}
              title={isListening ? 'Stop listening' : 'Start listening'}
            >
              {isListening ? <StopIcon /> : <MicrophoneIcon />}
            </button>
          )}
          <button
            onClick={handleLocalSend}
            disabled={isLoading || (!input.trim() && !selectedImage)}
            className="bg-[var(--accent-color-600)] text-white p-3 rounded-full hover:bg-[var(--accent-color-500)] disabled:bg-gray-500 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-color-500)]"
            aria-label="Send message"
            title="Send message"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
};