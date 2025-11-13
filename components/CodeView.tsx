
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { CommandLineIcon, ConnectAiIcon, SparklesIcon } from './Icons';

declare const hljs: {
  highlightElement: (element: HTMLElement) => void;
};

const languages = ['JavaScript', 'Python', 'TypeScript', 'HTML', 'CSS', 'Java', 'C++', 'Go', 'Rust', 'SQL'];

const CodeOutput: React.FC<{ code: string; language: string }> = ({ code, language }) => {
    const codeRef = useRef<HTMLElement>(null);
    const [isCopied, setIsCopied] = useState(false);

    useEffect(() => {
        if (codeRef.current && typeof hljs !== 'undefined') {
            // The language class name should be lowercase for highlight.js
            codeRef.current.className = `language-${language.toLowerCase()}`;
            hljs.highlightElement(codeRef.current);
        }
    }, [code, language]);

    const handleCopy = () => {
        navigator.clipboard.writeText(code).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        });
    };

    return (
        <div className="relative group">
            <pre className="bg-gray-800/80 rounded-md text-sm overflow-x-auto">
                <code ref={codeRef} className={`language-${language.toLowerCase()}`}>
                    {code}
                </code>
            </pre>
            <button
                onClick={handleCopy}
                className="absolute top-2 right-2 p-1.5 bg-gray-900/50 text-gray-400 rounded-md hover:bg-gray-700/70 hover:text-white text-xs flex items-center gap-1 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
            >
                {isCopied ? 'Copied!' : 'Copy'}
            </button>
        </div>
    );
};

export const CodeView: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [language, setLanguage] = useState('JavaScript');
    const [output, setOutput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const generateCode = async () => {
        if (!prompt.trim()) {
            setError('Please enter a prompt.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setOutput('');

        try {
            const apiKey = process.env.API_KEY;
            if (!apiKey) {
                throw new Error("Gemini API key is not configured. Please ensure the API_KEY environment variable is set.");
            }
            const ai = new GoogleGenAI({ apiKey });
            const fullPrompt = `Generate a code snippet in ${language} for the following task. Only output the raw code, without any markdown formatting (like \`\`\`${language.toLowerCase()}), explanations, or example usage.
Task: "${prompt}"`;
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: fullPrompt,
            });

            // Clean up potential markdown code blocks from the response
            let cleanedCode = response.text.trim();
            const langIdentifier = `\`\`\`${language.toLowerCase()}`;
            if (cleanedCode.startsWith(langIdentifier)) {
                cleanedCode = cleanedCode.substring(langIdentifier.length);
            }
            if (cleanedCode.startsWith('```')) {
                 cleanedCode = cleanedCode.substring(3);
            }
            if (cleanedCode.endsWith('```')) {
                cleanedCode = cleanedCode.slice(0, -3);
            }

            setOutput(cleanedCode.trim());
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
                    {output === '' && !isLoading && (
                        <div className="flex flex-col items-center justify-center text-gray-400 text-center pt-16">
                            <CommandLineIcon className="w-16 h-16 mb-4 text-gray-500" />
                            <h2 className="text-2xl font-bold text-gray-300">Code Generation Studio</h2>
                            <p className="mt-2">Describe the code you need, select a language, and let the AI write it for you.</p>
                        </div>
                    )}

                    {isLoading && (
                        <div className="flex flex-col items-center justify-center text-center pt-16">
                            <ConnectAiIcon className="w-20 h-20 text-[var(--accent-color-500)] animate-pulse" />
                            <p className="mt-4 text-lg font-semibold text-gray-300 animate-pulse">Writing code...</p>
                            <p className="text-sm text-gray-500">The AI is thinking hard to craft your snippet.</p>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-900/50 border border-red-500 text-red-300 p-4 rounded-lg my-4">
                            <h3 className="font-bold">Generation Failed</h3>
                            <p>{error}</p>
                        </div>
                    )}
                    
                    {output && (
                        <div>
                            <h3 className="text-lg font-semibold mb-2 text-gray-300">Generated {language} Code:</h3>
                            <CodeOutput code={output} language={language} />
                        </div>
                    )}
                </div>
            </main>

            <div className="bg-gray-800 p-4 border-t border-gray-700">
                <div className="max-w-4xl mx-auto space-y-4">
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., A function that fetches data from an API and handles errors"
                        disabled={isLoading}
                        rows={3}
                        className="w-full bg-gray-700 text-white rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent-color-500)] disabled:opacity-50"
                    />
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <label htmlFor="language-select" className="text-sm font-medium text-gray-300">Language:</label>
                            <select id="language-select" value={language} onChange={(e) => setLanguage(e.target.value)} disabled={isLoading} className="bg-gray-700 border-gray-600 rounded-md p-2 text-sm focus:ring-[var(--accent-color-500)] focus:border-[var(--accent-color-500)]">
                                {languages.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                            </select>
                        </div>
                        <button
                            onClick={generateCode}
                            disabled={isLoading || !prompt.trim()}
                            className="ml-auto bg-[var(--accent-color-600)] text-white px-6 py-2 rounded-lg font-semibold hover:bg-[var(--accent-color-500)] disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                        >
                            <SparklesIcon className="w-5 h-5"/>
                            {isLoading ? 'Generating...' : 'Generate Code'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
