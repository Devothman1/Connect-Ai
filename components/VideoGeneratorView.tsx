import React, { useState, useEffect, useRef } from 'react';
import { generateVideos, getVideosOperation } from '../services/geminiService';
import { ConnectAiIcon, DownloadIcon, PaperclipIcon, VideoIcon, XCircleIcon } from './Icons';
// FIX: The type `VideosOperation` is not exported from the `@google/genai` library.
// The import has been removed and the type annotation changed to `any`.


const resolutions = ["720p", "1080p"];
const aspectRatios = ["16:9", "9:16"];
const loadingMessages = [
    "Warming up the digital cameras...",
    "Choreographing the pixels...",
    "Rendering the first few frames...",
    "Applying cinematic color grading...",
    "This is taking a bit longer than usual, but good things take time!",
    "Finalizing the video stream...",
    "Almost there, adding the finishing touches..."
];

export const VideoGeneratorView: React.FC = () => {
    const [hasApiKey, setHasApiKey] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [resolution, setResolution] = useState('720p');
    const [aspectRatio, setAspectRatio] = useState('16:9');
    const [selectedImage, setSelectedImage] = useState<{ data: string, type: string, name: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState(loadingMessages[0]);
    const [error, setError] = useState<string | null>(null);
    const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const pollIntervalRef = useRef<number | null>(null);
    const messageIntervalRef = useRef<number | null>(null);

    useEffect(() => {
        const checkKey = async () => {
            if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
                const keyStatus = await window.aistudio.hasSelectedApiKey();
                setHasApiKey(keyStatus);
            }
        };
        checkKey();
        return () => {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            if (messageIntervalRef.current) clearInterval(messageIntervalRef.current);
        };
    }, []);

    const handleSelectKey = async () => {
        if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
            await window.aistudio.openSelectKey();
            // Assume success to avoid race conditions, and let API call failure handle the rest
            setHasApiKey(true);
        }
    };

    const pollOperation = (operation: any) => {
        let currentMessageIndex = 1;
        setLoadingMessage(loadingMessages[0]);
        messageIntervalRef.current = window.setInterval(() => {
            setLoadingMessage(loadingMessages[currentMessageIndex % loadingMessages.length]);
            currentMessageIndex++;
        }, 8000);

        pollIntervalRef.current = window.setInterval(async () => {
            try {
                const updatedOp = await getVideosOperation(operation);
                if (updatedOp.done) {
                    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                    if (messageIntervalRef.current) clearInterval(messageIntervalRef.current);
                    const downloadLink = updatedOp.response?.generatedVideos?.[0]?.video?.uri;
                    if (downloadLink) {
                        const apiKey = process.env.API_KEY;
                        if (!apiKey) {
                            setError("API key is missing. Cannot download the generated video.");
                            setIsLoading(false);
                            return;
                        }
                        const response = await fetch(`${downloadLink}&key=${apiKey}`);
                        const blob = await response.blob();
                        setGeneratedVideoUrl(URL.createObjectURL(blob));
                    } else {
                        setError("Video generation finished, but no video was returned.");
                    }
                    setIsLoading(false);
                }
            } catch (e) {
                if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                if (messageIntervalRef.current) clearInterval(messageIntervalRef.current);
                setError(e instanceof Error ? e.message : 'Failed to poll video status.');
                setIsLoading(false);
            }
        }, 10000);
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError('Please enter a prompt.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setGeneratedVideoUrl(null);

        try {
            const config = { numberOfVideos: 1, resolution, aspectRatio };
            const operation = await generateVideos(prompt, config, selectedImage ?? undefined);
            pollOperation(operation);
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
            setError(errorMessage);
            setIsLoading(false);
            if (errorMessage.includes("Requested entity was not found")) {
                setHasApiKey(false); // Force user to re-select key
            }
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
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    if (!hasApiKey) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <VideoIcon className="w-16 h-16 mb-4 text-gray-500" />
                <h2 className="text-2xl font-bold text-gray-300">API Key Required for Video Generation</h2>
                <p className="mt-2 max-w-lg text-gray-400">
                    To use the Veo video generation model, you need to select an API key associated with a project that has billing enabled.
                </p>
                <button
                    onClick={handleSelectKey}
                    className="mt-6 bg-[var(--accent-color-600)] text-white px-6 py-2 rounded-lg font-semibold hover:bg-[var(--accent-color-500)] transition-colors"
                >
                    Select API Key
                </button>
                 <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="mt-4 text-sm text-[var(--accent-color-500)] hover:underline">
                    Learn more about billing
                </a>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-gray-900 text-white">
            <main className="flex-1 overflow-y-auto p-4 md:p-6">
                 <div className="max-w-4xl mx-auto">
                    {!generatedVideoUrl && !isLoading && (
                        <div className="flex flex-col items-center justify-center text-gray-400 text-center pt-16">
                            <VideoIcon className="w-16 h-16 mb-4 text-gray-500" />
                            <h2 className="text-2xl font-bold text-gray-300">Video Generation Studio</h2>
                            <p className="mt-2 max-w-lg">Bring your ideas to life. Describe the video you want to create, and optionally provide a starting image.</p>
                        </div>
                    )}

                    {isLoading && (
                        <div className="flex flex-col items-center justify-center text-center pt-16">
                             <div className="relative w-20 h-20">
                                <ConnectAiIcon className="w-full h-full text-[var(--accent-color-500)] animate-pulse" />
                             </div>
                            <p className="mt-4 text-lg font-semibold text-gray-300">{loadingMessage}</p>
                            <p className="text-sm text-gray-500">Video generation can take several minutes. Please be patient.</p>
                        </div>
                    )}
                    
                    {error && (
                        <div className="bg-red-900/50 border border-red-500 text-red-300 p-4 rounded-lg my-4">
                            <h3 className="font-bold">Generation Failed</h3>
                            <p>{error}</p>
                        </div>
                    )}

                    {generatedVideoUrl && (
                       <div className="bg-black rounded-lg overflow-hidden">
                            <video src={generatedVideoUrl} controls autoPlay loop className="w-full" />
                            <a href={generatedVideoUrl} download="generated_video.mp4" className="block w-full text-center p-3 bg-gray-800 hover:bg-gray-700 font-semibold">
                                <DownloadIcon className="w-5 h-5 inline-block mr-2" /> Download Video
                            </a>
                        </div>
                    )}
                </div>
            </main>

            <div className="bg-gray-800 p-4 border-t border-gray-700">
                <div className="max-w-4xl mx-auto space-y-4">
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., A futuristic car driving through a neon-lit city at night..."
                        disabled={isLoading}
                        rows={2}
                        className="w-full bg-gray-700 text-white rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent-color-500)] disabled:opacity-50"
                    />
                    {selectedImage && (
                        <div className="bg-gray-700 p-2 rounded-lg flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <img src={`data:${selectedImage.type};base64,${selectedImage.data}`} alt="Preview" className="w-10 h-10 rounded object-cover" />
                                <span className="text-sm text-gray-300 truncate">{selectedImage.name}</span>
                            </div>
                            <button onClick={() => setSelectedImage(null)} className="p-1 text-gray-400 hover:text-white" title="Remove image">
                                <XCircleIcon className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                    <div className="flex flex-wrap items-center gap-4">
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                        <button onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md text-white bg-gray-600 hover:bg-gray-500 transition-colors disabled:opacity-50">
                            <PaperclipIcon className="w-5 h-5" /> Start with Image
                        </button>
                         <div className="flex items-center gap-2">
                            <label htmlFor="resolution" className="text-sm font-medium text-gray-300">Resolution:</label>
                             <select id="resolution" value={resolution} onChange={(e) => setResolution(e.target.value)} disabled={isLoading} className="bg-gray-700 border-gray-600 rounded-md p-2 text-sm focus:ring-[var(--accent-color-500)] focus:border-[var(--accent-color-500)]">
                                {resolutions.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                         <div className="flex items-center gap-2">
                            <label htmlFor="video-aspect-ratio" className="text-sm font-medium text-gray-300">Aspect Ratio:</label>
                             <select id="video-aspect-ratio" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} disabled={isLoading} className="bg-gray-700 border-gray-600 rounded-md p-2 text-sm focus:ring-[var(--accent-color-500)] focus:border-[var(--accent-color-500)]">
                                {aspectRatios.map(ar => <option key={ar} value={ar}>{ar}</option>)}
                            </select>
                        </div>
                        <button
                            onClick={handleGenerate}
                            disabled={isLoading || !prompt.trim()}
                            className="ml-auto bg-[var(--accent-color-600)] text-white px-6 py-2 rounded-lg font-semibold hover:bg-[var(--accent-color-500)] disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                        >
                            {isLoading ? 'Generating...' : 'Generate'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};