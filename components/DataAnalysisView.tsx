
import React, { useState, useRef, useMemo } from 'react';
import { GoogleGenAI } from "@google/genai";
import { ChartBarIcon, ConnectAiIcon, SparklesIcon, TrashIcon, UploadIcon } from './Icons';

declare const marked: { parse: (text: string) => string; };
declare const DOMPurify: { sanitize: (html: string) => string; };

const renderMarkdown = (text: string) => {
  if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
    const escapedText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return { __html: escapedText.replace(/\n/g, '<br/>') };
  }
  const rawHtml = marked.parse(text);
  const sanitizedHtml = DOMPurify.sanitize(rawHtml);
  return { __html: sanitizedHtml };
};

interface DataChatMessage {
  role: 'user' | 'model';
  content: string;
}

export const DataAnalysisView: React.FC = () => {
    const [csvData, setCsvData] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [question, setQuestion] = useState('');
    const [conversation, setConversation] = useState<DataChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const tableData = useMemo(() => {
        if (!csvData) return { headers: [], rows: [] };
        const lines = csvData.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const rows = lines.slice(1, 6).map(line => line.split(',').map(cell => cell.trim())); // Preview first 5 rows
        return { headers, rows };
    }, [csvData]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.type === 'text/csv') {
            const reader = new FileReader();
            reader.onload = (e) => {
                setCsvData(e.target?.result as string);
                setFileName(file.name);
                setError(null);
                setConversation([]);
            };
            reader.readAsText(file);
        } else if (file) {
            setError('Please upload a valid .csv file.');
        }
        if (event.target) event.target.value = '';
    };

    const handleAskQuestion = async () => {
        if (!question.trim() || !csvData) return;

        setIsLoading(true);
        setError(null);
        const currentQuestion = question;
        setQuestion('');
        setConversation(prev => [...prev, { role: 'user', content: currentQuestion }, { role: 'model', content: '' }]);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
            const prompt = `
You are an expert data analyst. Given the following CSV data, please answer the user's question.
Provide clear, concise answers. If you generate a table in your response, format it using Markdown.

CSV Data (file: ${fileName}):
---
${csvData}
---

Question: "${currentQuestion}"
`;

            const stream = await ai.models.generateContentStream({
                model: 'gemini-2.5-pro',
                contents: prompt,
            });

            let fullResponse = '';
            for await (const chunk of stream) {
                fullResponse += chunk.text;
                setConversation(prev => {
                    const newConversation = [...prev];
                    newConversation[newConversation.length - 1] = { role: 'model', content: fullResponse };
                    return newConversation;
                });
            }
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
            setError(errorMessage);
            setConversation(prev => prev.slice(0, -2)); // Remove user question and empty model response
        } finally {
            setIsLoading(false);
        }
    };
    
    React.useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [conversation]);


    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
            <main className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="max-w-5xl mx-auto">
                    {!csvData ? (
                        <div className="flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 text-center pt-16">
                            <ChartBarIcon className="w-16 h-16 mb-4 text-gray-400 dark:text-gray-500" />
                            <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Data Analysis Studio</h2>
                            <p className="mt-2">Upload a CSV file and ask the AI to analyze it for you.</p>
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                className="mt-8 w-full max-w-lg h-64 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-[var(--accent-color-500)] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                             >
                                <UploadIcon className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-2"/>
                                <p className="font-semibold text-gray-700 dark:text-gray-300">Click to upload CSV</p>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className="mb-6 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-lg font-semibold">Data Preview: <span className="text-[var(--accent-color-500)]">{fileName}</span></h3>
                                    <button onClick={() => {setCsvData(null); setFileName(null);}} className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-500" title="Remove file">
                                        <TrashIcon className="w-5 h-5"/>
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-100 dark:bg-gray-700 text-xs uppercase">
                                            <tr>{tableData.headers.map((h, i) => <th key={i} className="px-4 py-2">{h}</th>)}</tr>
                                        </thead>
                                        <tbody>
                                            {tableData.rows.map((row, i) => (
                                                <tr key={i} className="border-b border-gray-200 dark:border-gray-700">
                                                    {row.map((cell, j) => <td key={j} className="px-4 py-2 truncate max-w-[150px]">{cell}</td>)}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="space-y-4">
                                {conversation.map((msg, index) => (
                                    <div key={index} className={`prose dark:prose-invert max-w-none p-4 rounded-lg ${msg.role === 'user' ? 'bg-gray-100 dark:bg-gray-700' : ''}`}>
                                        <p className="font-bold capitalize">{msg.role}</p>
                                        <div dangerouslySetInnerHTML={renderMarkdown(msg.content)} />
                                        {isLoading && msg.role === 'model' && index === conversation.length - 1 && (
                                            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                                                <ConnectAiIcon className="w-5 h-5 animate-pulse" />
                                                <span>Analyzing...</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                 <div ref={chatEndRef}></div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
            <div className="bg-white dark:bg-gray-800 p-4 border-t border-gray-200 dark:border-gray-700">
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden"/>
                <div className="max-w-5xl mx-auto flex items-center gap-4">
                    <input
                        type="text"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAskQuestion(); }}}
                        placeholder={csvData ? "Ask a question about your data..." : "Upload a CSV to begin"}
                        disabled={isLoading || !csvData}
                        className="w-full bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color-500)] disabled:opacity-50"
                    />
                    <button
                        onClick={handleAskQuestion}
                        disabled={isLoading || !question.trim() || !csvData}
                        className="bg-[var(--accent-color-600)] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[var(--accent-color-500)] disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                        <SparklesIcon className="w-5 h-5"/>
                        <span>{isLoading ? '...' : 'Ask'}</span>
                    </button>
                </div>
                {error && <p className="text-red-500 text-sm text-center mt-2">{error}</p>}
            </div>
        </div>
    );
};