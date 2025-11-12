
import React, { useState, useRef } from 'react';
import { editImage } from '../services/geminiService';
import { ConnectAiIcon, DownloadIcon, SparklesIcon, UploadIcon, XCircleIcon } from './Icons';

export const ImageEditorView: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [originalImage, setOriginalImage] = useState<{ data: string, type: string, url: string } | null>(null);
    const [editedImage, setEditedImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = (reader.result as string).split(',')[1];
                setOriginalImage({ 
                    data: base64String, 
                    type: file.type, 
                    url: URL.createObjectURL(file) 
                });
                setEditedImage(null); // Clear previous edit on new image upload
            };
            reader.readAsDataURL(file);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError('Please enter an editing instruction.');
            return;
        }
        if (!originalImage) {
            setError('Please upload an image to edit.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setEditedImage(null);
        try {
            const newImageBase64 = await editImage(prompt, originalImage);
            setEditedImage(`data:image/png;base64,${newImageBase64}`);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const dropzoneProps = {
        onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.currentTarget.classList.add('border-[var(--accent-color-500)]', 'bg-gray-700'); },
        onDragLeave: (e: React.DragEvent) => { e.preventDefault(); e.currentTarget.classList.remove('border-[var(--accent-color-500)]', 'bg-gray-700'); },
        onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            e.currentTarget.classList.remove('border-[var(--accent-color-500)]', 'bg-gray-700');
            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                const event = { target: { files } } as unknown as React.ChangeEvent<HTMLInputElement>;
                handleFileChange(event);
            }
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-900 text-white">
            <main className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="max-w-5xl mx-auto">
                    {!originalImage && (
                        <div className="flex flex-col items-center justify-center text-gray-400 text-center pt-16">
                            <SparklesIcon className="w-16 h-16 mb-4 text-gray-500" />
                            <h2 className="text-2xl font-bold text-gray-300">AI Image Editor</h2>
                            <p className="mt-2">Upload an image and tell me how you want to change it.</p>
                             <div 
                                {...dropzoneProps}
                                onClick={() => fileInputRef.current?.click()}
                                className="mt-8 w-full max-w-lg h-64 border-2 border-dashed border-gray-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-gray-500 transition-colors"
                             >
                                <UploadIcon className="w-12 h-12 text-gray-500 mb-2"/>
                                <p className="font-semibold text-gray-300">Click to upload or drag & drop</p>
                                <p className="text-sm text-gray-500">PNG, JPG, WEBP, etc.</p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-900/50 border border-red-500 text-red-300 p-4 rounded-lg my-4 max-w-2xl mx-auto">
                            <h3 className="font-bold">Editing Failed</h3>
                            <p>{error}</p>
                        </div>
                    )}
                    
                    {originalImage && (
                        <div className="grid md:grid-cols-2 gap-6 items-center">
                            <div className="relative">
                               <h3 className="text-lg font-semibold mb-2 text-center text-gray-400">Original</h3>
                               <img src={originalImage.url} alt="Original" className="rounded-lg w-full h-auto object-contain max-h-[60vh]"/>
                               <button onClick={() => setOriginalImage(null)} className="absolute top-0 right-0 m-2 p-1.5 bg-black/50 rounded-full text-white hover:bg-black/80" title="Remove image">
                                   <XCircleIcon className="w-6 h-6" />
                               </button>
                            </div>
                            <div className="relative">
                                <h3 className="text-lg font-semibold mb-2 text-center text-gray-400">Edited</h3>
                                {isLoading ? (
                                    <div className="w-full aspect-square bg-gray-800 rounded-lg flex flex-col items-center justify-center">
                                        <ConnectAiIcon className="w-16 h-16 text-[var(--accent-color-500)] animate-pulse" />
                                        <p className="mt-4 text-lg font-semibold text-gray-300 animate-pulse">Magicking up your image...</p>
                                    </div>
                                ) : editedImage ? (
                                    <div className="relative group">
                                         <img src={editedImage} alt="Edited" className="rounded-lg w-full h-auto object-contain max-h-[60vh]"/>
                                         <a href={editedImage} download="edited_image.png" className="absolute bottom-4 right-4 p-2 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" title="Download Image">
                                            <DownloadIcon className="w-6 h-6" />
                                        </a>
                                    </div>
                                ) : (
                                    <div 
                                        {...dropzoneProps}
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full aspect-square bg-gray-800 rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-gray-600 cursor-pointer"
                                    >
                                        <p className="text-gray-400">Waiting for your edit...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </main>

            <div className="bg-gray-800 p-4 border-t border-gray-700">
                <div className="max-w-2xl mx-auto flex items-center gap-4">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                     <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-3 rounded-full bg-gray-600 text-gray-300 hover:bg-gray-500 transition-colors focus:outline-none disabled:opacity-50"
                        title="Upload a different image"
                        disabled={isLoading}
                    >
                        <UploadIcon />
                    </button>
                    <input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., Add a wizard hat, make it black and white..."
                        disabled={isLoading || !originalImage}
                        className="w-full bg-gray-700 text-white rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color-500)] disabled:opacity-50"
                    />
                    <button
                        onClick={handleGenerate}
                        disabled={isLoading || !prompt.trim() || !originalImage}
                        className="bg-[var(--accent-color-600)] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[var(--accent-color-500)] disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                    >
                        <SparklesIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};
