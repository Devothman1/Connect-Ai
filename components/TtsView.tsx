
import React, { useState, useRef, useEffect } from 'react';
import { generateSpeech } from '../services/geminiService';
import { ConnectAiIcon, DownloadIcon, SpeakerIcon, StopIcon, TextToSpeechIcon, TrashIcon } from './Icons';

const voices = ['Kore', 'Puck', 'Zephyr', 'Charon', 'Fenrir'];

// --- Audio Utility Functions ---

function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper to convert raw PCM data to a WAV file Blob
function pcmToWav(pcmData: Uint8Array, sampleRate: number, numChannels: number, bitsPerSample: number): Blob {
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcmData.length;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    // fmt sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Sub-chunk size
    view.setUint16(20, 1, true); // Audio format (1 for PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    // data sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    // Write PCM data
    new Uint8Array(buffer, 44).set(pcmData);

    return new Blob([view], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}


export const TtsView: React.FC = () => {
    const [text, setText] = useState('');
    const [selectedVoice, setSelectedVoice] = useState('Zephyr');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    
    const audioRef = useRef<HTMLAudioElement>(null);
    const pcmDataRef = useRef<Uint8Array | null>(null);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        
        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onEnded = () => setIsPlaying(false);
        
        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('ended', onEnded);
        
        return () => {
            audio.removeEventListener('play', onPlay);
            audio.removeEventListener('pause', onPause);
            audio.removeEventListener('ended', onEnded);
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
            }
        };
    }, [audioUrl]);

    const handleGenerate = async () => {
        if (!text.trim()) {
            setError('Please enter some text to generate speech.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setAudioUrl(null);
        pcmDataRef.current = null;

        try {
            const base64Audio = await generateSpeech(text, selectedVoice);
            const pcmData = decode(base64Audio);
            pcmDataRef.current = pcmData;
            
            // The API returns raw PCM data at 24000Hz, 1 channel, 16-bit.
            const wavBlob = pcmToWav(pcmData, 24000, 1, 16);
            const url = URL.createObjectURL(wavBlob);
            setAudioUrl(url);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
        }
    };

    const handleDownload = () => {
        if (audioUrl) {
            const a = document.createElement('a');
            a.href = audioUrl;
            a.download = `speech_${selectedVoice}.wav`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-900 text-white">
            <main className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="max-w-3xl mx-auto">
                    {!audioUrl && !isLoading && (
                        <div className="flex flex-col items-center justify-center text-gray-400 text-center pt-16">
                            <TextToSpeechIcon className="w-16 h-16 mb-4 text-gray-500" />
                            <h2 className="text-2xl font-bold text-gray-300">Text-to-Speech Studio</h2>
                            <p className="mt-2">Convert your text into high-quality, natural-sounding audio.</p>
                        </div>
                    )}
                    {isLoading && (
                         <div className="flex flex-col items-center justify-center text-center pt-16">
                             <div className="relative w-20 h-20">
                                <ConnectAiIcon className="w-full h-full text-[var(--accent-color-500)] animate-pulse" />
                             </div>
                            <p className="mt-4 text-lg font-semibold text-gray-300 animate-pulse">Generating audio...</p>
                        </div>
                    )}
                    {error && (
                        <div className="bg-red-900/50 border border-red-500 text-red-300 p-4 rounded-lg my-4">
                            <h3 className="font-bold">Generation Failed</h3>
                            <p>{error}</p>
                        </div>
                    )}
                    {audioUrl && (
                        <div className="mt-8 p-6 bg-gray-800 rounded-lg flex items-center gap-4">
                            <audio ref={audioRef} src={audioUrl} className="hidden" />
                            <button onClick={togglePlay} className="p-4 bg-gray-700 rounded-full hover:bg-gray-600">
                                {isPlaying ? <StopIcon className="w-6 h-6"/> : <SpeakerIcon className="w-6 h-6" />}
                            </button>
                            <div className="flex-1 text-lg font-semibold">
                                Speech generated with <span className="text-[var(--accent-color-500)]">{selectedVoice}</span> voice.
                            </div>
                            <button onClick={handleDownload} className="p-3 bg-gray-700 rounded-full hover:bg-gray-600" title="Download WAV">
                                <DownloadIcon className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>
            </main>
             <div className="bg-gray-800 p-4 border-t border-gray-700">
                <div className="max-w-3xl mx-auto space-y-4">
                     <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Type or paste your text here..."
                        disabled={isLoading}
                        rows={5}
                        className="w-full bg-gray-700 text-white rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent-color-500)] disabled:opacity-50"
                    />
                    <div className="flex flex-wrap items-center gap-4">
                         <div className="flex items-center gap-2">
                            <label htmlFor="voice-select" className="text-sm font-medium text-gray-300">Voice:</label>
                             <select id="voice-select" value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)} disabled={isLoading} className="bg-gray-700 border-gray-600 rounded-md p-2 text-sm focus:ring-[var(--accent-color-500)] focus:border-[var(--accent-color-500)]">
                                {voices.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                        </div>
                         <button onClick={() => setText('')} disabled={isLoading} className="p-2 text-gray-400 hover:text-white" title="Clear text">
                             <TrashIcon className="w-5 h-5"/>
                         </button>
                         <button
                            onClick={handleGenerate}
                            disabled={isLoading || !text.trim()}
                            className="ml-auto bg-[var(--accent-color-600)] text-white px-6 py-2 rounded-lg font-semibold hover:bg-[var(--accent-color-500)] disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                        >
                            {isLoading ? 'Generating...' : 'Generate Speech'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
