
import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { DocumentTextIcon, ConnectAiIcon, SparklesIcon, TrashIcon } from './Icons';

declare const marked: { parse: (text: string) => string; };
declare const DOMPurify: { sanitize: (html: string) => string; };

const renderMarkdown = (text: string) => {
  if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
    const escapedText = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
    return { __html: escapedText.replace(/\n/g, '<br/>') };
  }
  const rawHtml = marked.parse(text);
  const sanitizedHtml = DOMPurify.sanitize(rawHtml);
  return { __html: sanitizedHtml };
};

export const SummarizerView: React.FC = () => {
    const [inputText, setInputText] = useState('');
    const [summaryType, setSummaryType] = useState<'short' | 'bullets'>('bullets');
    const [output, setOutput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && (file.type === 'text/plain' || file.type === 'text/markdown')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setInputText(e.target?.result as string);
                setError(null);
            };
            reader.readAsText(file);
        } else if (file) {
            setError('Please upload a valid .txt or .md file.');
        }
        // Reset file input to allow re-uploading the same file
        if (event.target) {
            event.target.value = '';
        }
    };

    const handleSummarize = async () => {
        if (!inputText.trim()) {
            setError('Please enter or upload some text to summarize.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setOutput('');

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
            const prompt = `Provide a ${summaryType === 'bullets' ? 'bullet-point' : 'concise paragraph'} summary of the following text. The summary should capture the main ideas and key information. Format your response using Markdown.
Text to summarize:
---
${inputText}`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });
            setOutput(response.text.trim());
        } catch (e) {
            setError(e instanceof Error ? e.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex h-full bg-gray-900 text-white">
            <div className="flex-1 flex flex-col p-4 md:p-6 overflow-y-auto">
                <h2 className="text-2xl font-bold text-gray-300 mb-4">Document Summarizer</h2>
                <div className="flex-1 grid md:grid-cols-2 gap-6">
                    <div className="flex flex-col">
                        <label htmlFor="input-text" className="text-lg font-semibold text-gray-400 mb-2">Your Text</label>
                        <textarea
                            id="input-text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Paste your text here, or upload a file below."
                            disabled={isLoading}
                            className="flex-1 w-full bg-gray-800 text-white rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent-color-500)] disabled:opacity-50"
                        />
                         <div className="mt-4 flex items-center justify-between">
                             <input type="file" id="file-upload" accept=".txt,.md" onChange={handleFileChange} className="hidden"/>
                             <label htmlFor="file-upload" className="cursor-pointer px-4 py-2 text-sm font-semibold rounded-md text-white bg-gray-600 hover:bg-gray-500 transition-colors">Upload File (.txt, .md)</label>
                             <button onClick={() => setInputText('')} disabled={isLoading || !inputText} className="p-2 text-gray-400 hover:text-white disabled:opacity-50" title="Clear text">
                                <TrashIcon className="w-5 h-5"/>
                             </button>
                         </div>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-lg font-semibold text-gray-400 mb-2">Summary</label>
                        <div className="flex-1 w-full bg-gray-800 rounded-lg p-3 overflow-y-auto prose prose-invert max-w-none prose-p:my-2 prose-ul:my-2">
                             {isLoading && (
                                <div className="flex flex-col items-center justify-center h-full text-center">
                                    <ConnectAiIcon className="w-16 h-16 text-[var(--accent-color-500)] animate-pulse" />
                                    <p className="mt-4 font-semibold text-gray-300 animate-pulse">Summarizing...</p>
                                </div>
                            )}
                            {error && (
                                <div className="text-red-300">
                                    <h3 className="font-bold">Error</h3>
                                    <p>{error}</p>
                                </div>
                            )}
                            {output && !isLoading && (
                                <div dangerouslySetInnerHTML={renderMarkdown(output)} />
                            )}
                            {!output && !isLoading && !error && (
                                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                    <DocumentTextIcon className="w-16 h-16 mb-4"/>
                                    <p>Your summary will appear here.</p>
                                </div>
                            )}
                        </div>
                         <div className="mt-4 flex items-center gap-6">
                            <div className="flex items-center gap-4">
                                <span className="text-sm font-medium text-gray-300">Style:</span>
                                <div className="flex gap-2">
                                     <button onClick={() => setSummaryType('bullets')} disabled={isLoading} className={`px-3 py-1 text-sm rounded-full transition-colors disabled:opacity-50 ${summaryType === 'bullets' ? 'bg-[var(--accent-color-600)] text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>Bullet Points</button>
                                     <button onClick={() => setSummaryType('short')} disabled={isLoading} className={`px-3 py-1 text-sm rounded-full transition-colors disabled:opacity-50 ${summaryType === 'short' ? 'bg-[var(--accent-color-600)] text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>Paragraph</button>
                                </div>
                            </div>
                            <button
                                onClick={handleSummarize}
                                disabled={isLoading || !inputText.trim()}
                                className="ml-auto bg-[var(--accent-color-600)] text-white px-6 py-2 rounded-lg font-semibold hover:bg-[var(--accent-color-500)] disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                            >
                                <SparklesIcon className="w-5 h-5" />
                                {isLoading ? 'Working...' : 'Summarize'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};