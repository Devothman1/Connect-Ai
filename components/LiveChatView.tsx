

import React, { useState, useRef, useEffect, useCallback } from 'react';
// FIX: The type `LiveSession` is not exported from the `@google/genai` library.
// It has been removed from the import and the `sessionPromiseRef` type annotation changed to `any`.
// FIX: Aliased `Blob` to `GenAIBlob` to avoid conflict with the native DOM `Blob` type.
import type { LiveServerMessage, Blob as GenAIBlob, FunctionDeclaration } from '@google/genai';
import { Modality, Type } from '@google/genai';
import { liveConnect } from '../services/geminiService';
import { TranscriptionMessage, MessageRole } from '../types';
import { MicrophoneIcon, StopIcon, UserIcon, ConnectAiIcon, CogIcon, CheckCircleIcon, CameraIcon, CloseIcon } from './Icons';

// --- Constants ---
const JPEG_QUALITY = 0.7;
const FRAME_RATE = 1; // 1 frame per second

// --- Audio Utility Functions ---

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// Helper to convert blob to base64
// FIX: The parameter is a native DOM `Blob`. After aliasing the genai `Blob`, this now correctly refers to the DOM type.
const blobToBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
});


// --- Function Calling Definition ---

const controlLightFunctionDeclaration: FunctionDeclaration = {
  name: 'controlLight',
  parameters: {
    type: Type.OBJECT,
    description: 'Set the brightness and color temperature of a room light.',
    properties: {
      brightness: {
        type: Type.NUMBER,
        description: 'Light level from 0 to 100. Zero is off and 100 is full brightness.',
      },
      color: {
        type: Type.STRING,
        description: 'Color of the light, e.g., "warm white", "daylight", "blue".',
      },
    },
    required: [], // Make params optional for demo
  },
};


export const LiveChatView: React.FC = () => {
    const [isLive, setIsLive] = useState(false);
    const [transcriptions, setTranscriptions] = useState<TranscriptionMessage[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isCameraOn, setIsCameraOn] = useState(false);
    const [systemInstruction, setSystemInstruction] = useState('You are a friendly and helpful conversational AI. Your name is Connect Ai. You are witty and engaging.');
    const [tempInstruction, setTempInstruction] = useState(systemInstruction);

    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const nextStartTimeRef = useRef(0);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const frameIntervalRef = useRef<number | null>(null);

    const transcriptEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcriptions]);

    const addOrUpdateTranscription = (role: MessageRole, text: string, isFinal: boolean) => {
        setTranscriptions(prev => {
            if (role === MessageRole.TOOL) {
                 return [...prev, { id: Date.now().toString(), role, text, isFinal: true }];
            }

            const last = prev[prev.length - 1];
            if (last && last.role === role && !last.isFinal) {
                const updated = { ...last, text: last.text + text, isFinal };
                return [...prev.slice(0, -1), updated];
            } else {
                if (text.trim()) {
                    return [...prev, { id: Date.now().toString(), role, text, isFinal }];
                }
                return prev;
            }
        });
    };
    
    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getVideoTracks().forEach(track => track.stop());
        }
        if (frameIntervalRef.current) {
            clearInterval(frameIntervalRef.current);
            frameIntervalRef.current = null;
        }
        setIsCameraOn(false);
    }
    
    const startCamera = async () => {
        try {
            const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) {
                videoRef.current.srcObject = videoStream;
                videoRef.current.play();
            }
            if (streamRef.current) {
                videoStream.getVideoTracks().forEach(track => streamRef.current!.addTrack(track));
            } else {
                streamRef.current = videoStream;
            }
            setIsCameraOn(true);
        } catch(err) {
            console.error("Camera access denied:", err);
            setError("Camera permission is required to use this feature.");
            setIsCameraOn(false);
        }
    }

    const stopConversation = useCallback(() => {
        setIsLive(false);
        stopCamera();

        if (streamRef.current) {
            streamRef.current.getAudioTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (scriptProcessorRef.current) scriptProcessorRef.current.disconnect();
        if (mediaStreamSourceRef.current) mediaStreamSourceRef.current.disconnect();
        if (inputAudioContextRef.current?.state !== 'closed') inputAudioContextRef.current.close();
        if (outputAudioContextRef.current?.state !== 'closed') {
             sourcesRef.current.forEach(source => source.stop());
            sourcesRef.current.clear();
            outputAudioContextRef.current.close();
        }
        sessionPromiseRef.current?.then(session => session.close());
        
        scriptProcessorRef.current = null;
        mediaStreamSourceRef.current = null;
        sessionPromiseRef.current = null;
    }, []);

    const startConversation = async () => {
        setIsLive(true);
        setError(null);
        setTranscriptions([{ id: 'start', role: MessageRole.SYSTEM, text: 'Connecting...', isFinal: true }]);

        try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = audioStream;

            if(isCameraOn && videoRef.current?.srcObject) {
                 (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => streamRef.current!.addTrack(track));
            }
            
            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            const outputNode = outputAudioContextRef.current.createGain();
            nextStartTimeRef.current = 0;

            const callbacks = {
                onopen: () => {
                    setTranscriptions(prev => prev.map(t => t.id === 'start' ? {...t, text: "Connection open. Start speaking."} : t));
                    
                    // Audio processing chain
                    const source = inputAudioContextRef.current!.createMediaStreamSource(streamRef.current!);
                    mediaStreamSourceRef.current = source;
                    const gainNode = inputAudioContextRef.current!.createGain();
                    gainNode.gain.value = 1.5; // Boost microphone input by 50%
                    const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                    scriptProcessorRef.current = scriptProcessor;

                    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const l = inputData.length;
                        const int16 = new Int16Array(l);
                        for (let i = 0; i < l; i++) int16[i] = inputData[i] * 32768;
                        
                        // FIX: Used the aliased `GenAIBlob` type here to specify the library's Blob type.
                        const pcmBlob: GenAIBlob = {
                            data: encode(new Uint8Array(int16.buffer)),
                            mimeType: 'audio/pcm;rate=16000',
                        };
                        sessionPromiseRef.current?.then((session) => {
                            session.sendRealtimeInput({ media: pcmBlob });
                        });
                    };
                    source.connect(gainNode);
                    gainNode.connect(scriptProcessor);
                    scriptProcessor.connect(inputAudioContextRef.current!.destination);

                    // Video frame processing
                    if (isCameraOn && videoRef.current && canvasRef.current) {
                       const videoEl = videoRef.current;
                       const canvasEl = canvasRef.current;
                       const ctx = canvasEl.getContext('2d');
                       if(!ctx) return;
                       
                       frameIntervalRef.current = window.setInterval(() => {
                           canvasEl.width = videoEl.videoWidth;
                           canvasEl.height = videoEl.videoHeight;
                           ctx.drawImage(videoEl, 0, 0, videoEl.videoWidth, videoEl.videoHeight);
                           canvasEl.toBlob(async (blob) => {
                               if (blob) {
                                   const base64Data = await blobToBase64(blob);
                                   sessionPromiseRef.current?.then((session) => {
                                       session.sendRealtimeInput({ media: { data: base64Data, mimeType: 'image/jpeg' }});
                                   });
                               }
                           }, 'image/jpeg', JPEG_QUALITY);
                       }, 1000 / FRAME_RATE);
                    }
                },
                onmessage: async (message: LiveServerMessage) => {
                    if (message.toolCall) {
                        for (const fc of message.toolCall.functionCalls) {
                            const args = JSON.stringify(fc.args);
                            addOrUpdateTranscription(MessageRole.TOOL, `Executing ${fc.name}(${args})...`, true);

                            setTimeout(() => {
                                const result = `Successfully executed ${fc.name}.`;
                                addOrUpdateTranscription(MessageRole.TOOL, `✅ ${result}`, true);
                                sessionPromiseRef.current?.then((session) => {
                                    session.sendToolResponse({
                                        functionResponses: { id: fc.id, name: fc.name, response: { result: result }}
                                    });
                                });
                            }, 1500);
                        }
                    }

                    if (message.serverContent?.inputTranscription) addOrUpdateTranscription(MessageRole.USER, message.serverContent.inputTranscription.text, false);
                    if (message.serverContent?.outputTranscription) addOrUpdateTranscription(MessageRole.MODEL, message.serverContent.outputTranscription.text, false);
                    
                    if (message.serverContent?.turnComplete) {
                        setTranscriptions(prev => prev.map(t => (!t.isFinal ? { ...t, isFinal: true } : t)));
                    }
                    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                    if (base64Audio && outputAudioContextRef.current) {
                        nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContextRef.current.currentTime);
                        const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current, 24000, 1);
                        const source = outputAudioContextRef.current.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(outputNode);
                        source.addEventListener('ended', () => sourcesRef.current.delete(source));
                        source.start(nextStartTimeRef.current);
                        nextStartTimeRef.current += audioBuffer.duration;
                        sourcesRef.current.add(source);
                    }
                     if (message.serverContent?.interrupted) {
                        sourcesRef.current.forEach(source => source.stop());
                        sourcesRef.current.clear();
                        nextStartTimeRef.current = 0;
                    }
                },
                onerror: (e: ErrorEvent) => {
                    console.error("Live session error:", e);
                    setError("Connection error. Please try again.");
                    stopConversation();
                },
                onclose: () => {
                    stopConversation();
                },
            };

            const config = {
                responseModalities: [Modality.AUDIO],
                inputAudioTranscription: {},
                outputAudioTranscription: {},
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                tools: [{ functionDeclarations: [controlLightFunctionDeclaration] }],
                systemInstruction,
            };

            sessionPromiseRef.current = liveConnect(callbacks, config);

        } catch (err) {
            console.error("Failed to start live conversation:", err);
            setError("Could not access microphone. Please check permissions and try again.");
            setIsLive(false);
        }
    };
    
    return (
        <div className="flex flex-col h-full bg-gray-900 text-white relative">
            <canvas ref={canvasRef} className="hidden"></canvas>
            <header className="flex items-center justify-between p-4 bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 absolute top-0 left-0 right-0 z-10">
                <h2 className="text-lg font-semibold">Live Conversation</h2>
                <button onClick={() => setIsSettingsOpen(true)} className="p-2 rounded-md hover:bg-gray-700" title="Live Settings">
                    <CogIcon />
                </button>
            </header>

            {isCameraOn && (
                <div className="absolute top-20 right-4 z-10 w-48 h-36 bg-black rounded-lg shadow-lg overflow-hidden">
                    <video ref={videoRef} playsInline muted autoPlay className="w-full h-full object-cover transform -scale-x-100" />
                </div>
            )}
            
            {isSettingsOpen && (
                <div className="absolute inset-0 bg-black/60 z-20 flex items-center justify-center" onClick={() => setIsSettingsOpen(false)}>
                    <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-bold">Live Session Settings</h3>
                            <button onClick={() => setIsSettingsOpen(false)} className="p-2 rounded-full hover:bg-gray-700 -mr-2 -mt-2"><CloseIcon /></button>
                        </div>
                        <div>
                            <label htmlFor="system-prompt" className="block text-sm font-medium text-gray-300 mb-2">System Instruction</label>
                            <textarea id="system-prompt" rows={5} className="w-full bg-gray-700 rounded-md p-2 focus:ring-2 focus:ring-[var(--accent-color-500)] focus:outline-none" value={tempInstruction} onChange={(e) => setTempInstruction(e.target.value)} />
                        </div>
                        <div className="flex justify-end">
                            <button 
                                onClick={() => { setSystemInstruction(tempInstruction); setIsSettingsOpen(false); }}
                                className="px-4 py-2 bg-[var(--accent-color-600)] hover:bg-[var(--accent-color-500)] rounded-md font-semibold"
                            >Save</button>
                        </div>
                    </div>
                </div>
            )}


            <main className="flex-1 overflow-y-auto p-4 md:p-6 pt-24 pb-32">
                <div className="max-w-4xl mx-auto space-y-4">
                    {transcriptions.map((msg) => (
                        <div key={msg.id} className={`flex items-start gap-3 ${msg.role === MessageRole.USER ? 'flex-row-reverse' : ''} ${msg.role === MessageRole.TOOL ? 'justify-center' : ''}`}>
                             {msg.role !== MessageRole.SYSTEM && msg.role !== MessageRole.TOOL && (
                                <div className={`w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center mt-1 ${msg.role === MessageRole.MODEL ? 'bg-gray-600' : 'bg-[var(--accent-color-500)]'}`}>
                                    {msg.role === MessageRole.MODEL ? <ConnectAiIcon className="w-5 h-5"/> : <UserIcon className="w-5 h-5"/>}
                                </div>
                             )}
                            <div className={`p-3 rounded-lg max-w-xl ${
                                msg.role === MessageRole.MODEL ? 'bg-gray-700' : 
                                msg.role === MessageRole.USER ? 'bg-[var(--accent-color-600)]' :
                                msg.role === MessageRole.TOOL ? 'bg-gray-800 text-gray-400 text-sm font-mono flex items-center gap-2' : 
                                'bg-gray-800 text-gray-400 text-center w-full'
                            } ${!msg.isFinal ? 'opacity-70' : ''}`}>
                                {msg.role === MessageRole.TOOL && (msg.text.startsWith('✅') ? <CheckCircleIcon className="w-5 h-5 text-green-400 flex-shrink-0"/> : <CogIcon className="w-5 h-5 text-gray-500 flex-shrink-0 animate-spin"/>)}
                                {msg.text}
                            </div>
                        </div>
                    ))}
                     <div ref={transcriptEndRef} />
                </div>
                 {transcriptions.length === 0 && !isLive && (
                        <div className="flex flex-col items-center justify-center text-gray-400 text-center pt-16">
                            <MicrophoneIcon className="w-16 h-16 mb-4 text-gray-500" />
                            <h2 className="text-2xl font-bold text-gray-300">Live Conversation</h2>
                            <p className="mt-2">Talk directly with the AI in real-time. Try saying "turn on the lights".</p>
                        </div>
                    )}
            </main>
            <div className="bg-gray-800/80 backdrop-blur-sm p-4 border-t border-gray-700 absolute bottom-0 left-0 right-0">
                <div className="max-w-4xl mx-auto flex flex-col items-center justify-center">
                    {error && <p className="text-red-400 mb-4">{error}</p>}
                    <div className="flex items-center gap-6">
                        <button 
                            onClick={isCameraOn ? stopCamera : startCamera}
                            disabled={isLive}
                            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white disabled:opacity-50 disabled:cursor-not-allowed ${isCameraOn ? 'bg-blue-500 text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}
                            title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
                        >
                            <CameraIcon className="w-7 h-7" />
                        </button>
                        <div className="relative">
                            <button
                                onClick={isLive ? stopConversation : startConversation}
                                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-opacity-50 ${
                                    isLive 
                                    ? 'bg-red-600 hover:bg-red-500 ring-red-500' 
                                    : 'bg-[var(--accent-color-600)] hover:bg-[var(--accent-color-500)] ring-[var(--accent-color-500)]'
                                }`}
                                aria-label={isLive ? 'Stop conversation' : 'Start conversation'}
                            >
                                {isLive ? <StopIcon className="w-10 h-10 text-white" /> : <MicrophoneIcon className="w-10 h-10 text-white" />}
                            </button>
                            {isLive && <div className="absolute inset-0 rounded-full border-4 border-[var(--accent-color-500)] animate-pulse -z-10"></div>}
                        </div>
                         {/* Placeholder for symmetry */}
                        <div className="w-14 h-14"></div>
                    </div>
                    <p className="mt-4 text-sm text-gray-400">
                        {isLive ? 'Conversation in progress...' : 'Tap to start talking'}
                    </p>
                </div>
            </div>
        </div>
    );
};
