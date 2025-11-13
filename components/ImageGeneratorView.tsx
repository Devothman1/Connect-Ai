
import React, { useState } from 'react';
import { generateImages } from '../services/geminiService';
import { ConnectAiIcon, DownloadIcon, ImageIcon } from './Icons';

const aspectRatios = ["1:1", "16:9", "9:16", "4:3", "3:4"];

export const ImageGeneratorView: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [numberOfImages, setNumberOfImages] = useState(1);
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generatedImages, setGeneratedImages] = useState<string[]>([]);

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError('Please enter a prompt.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setGeneratedImages([]);
        try {
            const response = await generateImages(prompt, numberOfImages, aspectRatio);
            const imageUrls = response.generatedImages.map(img => `data:image/jpeg;base64,${img.image.imageBytes}`);
            setGeneratedImages(imageUrls);
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
            if (errorMessage.includes("API key is not configured")) {
                setError("Configuration Error: The Gemini API key is missing. This is required for the app to function.");
            } else if (errorMessage.includes("API key not valid")) {
                setError("Authentication Error: The provided Gemini API key is invalid.");
            } else {
                setError(errorMessage);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-900 text-white">
            <main className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="max-w-4xl mx-auto">
                    {generatedImages.length === 0 && !isLoading && (
                        <div className="flex flex-col items-center justify-center text-gray-400 text-center pt-16">
                            <ImageIcon className="w-16 h-16 mb-4 text-gray-500" />
                            <h2 className="text-2xl font-bold text-gray-300">Image Generation Studio</h2>
                            <p className="mt-2">Describe the image you want to create. Be as detailed as you can!</p>
                        </div>
                    )}

                    {isLoading && (
                        <div className="flex flex-col items-center justify-center text-center pt-16">
                             <div className="relative w-20 h-20">
                                <ConnectAiIcon className="w-full h-full text-[var(--accent-color-500)] animate-pulse" />
                             </div>
                            <p className="mt-4 text-lg font-semibold text-gray-300 animate-pulse">Creating your masterpiece...</p>
                            <p className="text-sm text-gray-500">This might take a moment.</p>
                        </div>
                    )}
                    
                    {error && (
                        <div className="bg-red-900/50 border border-red-500 text-red-300 p-4 rounded-lg my-4">
                            <h3 className="font-bold">Generation Failed</h3>
                            <p>{error}</p>
                        </div>
                    )}

                    {generatedImages.length > 0 && (
                        <div className={`grid gap-4 ${generatedImages.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                            {generatedImages.map((src, index) => (
                                <div key={index} className="relative group rounded-lg overflow-hidden">
                                    <img src={src} alt={`Generated image ${index + 1}`} className="w-full h-full object-contain" />
                                    <a 
                                        href={src} 
                                        download={`generated_image_${index + 1}.jpeg`}
                                        className="absolute bottom-4 right-4 p-2 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Download Image"
                                    >
                                        <DownloadIcon className="w-6 h-6" />
                                    </a>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            <div className="bg-gray-800 p-4 border-t border-gray-700">
                <div className="max-w-4xl mx-auto space-y-4">
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., A majestic lion wearing a crown, cinematic lighting, hyperrealistic..."
                        disabled={isLoading}
                        rows={2}
                        className="w-full bg-gray-700 text-white rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent-color-500)] disabled:opacity-50"
                    />
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <label htmlFor="num-images" className="text-sm font-medium text-gray-300">Images:</label>
                            <select id="num-images" value={numberOfImages} onChange={(e) => setNumberOfImages(Number(e.target.value))} disabled={isLoading} className="bg-gray-700 border-gray-600 rounded-md p-2 text-sm focus:ring-[var(--accent-color-500)] focus:border-[var(--accent-color-500)]">
                                {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <label htmlFor="aspect-ratio" className="text-sm font-medium text-gray-300">Aspect Ratio:</label>
                             <select id="aspect-ratio" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} disabled={isLoading} className="bg-gray-700 border-gray-600 rounded-md p-2 text-sm focus:ring-[var(--accent-color-500)] focus:border-[var(--accent-color-500)]">
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
