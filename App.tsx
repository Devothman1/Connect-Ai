
import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Chat, GenerateContentResponse } from '@google/genai';
import { ChatMessage, MessageRole, ChatSession, GroundingSource, AppMode, Folder, SafetySetting, HarmCategory, HarmBlockThreshold } from './types';
import { initializeChat, streamResponse } from './services/geminiService';
import { ChatInput } from './components/ChatInput';
import { ChatMessageComponent } from './components/ChatMessage';
import { ConnectAiIcon, MenuIcon, DownloadIcon, ScrollDownIcon } from './components/Icons';
import { Sidebar } from './components/Sidebar';
import { ModeSelector } from './components/ModeSelector';
import { ImageGeneratorView } from './components/ImageGeneratorView';
import { VideoGeneratorView } from './components/VideoGeneratorView';
import { LiveChatView } from './components/LiveChatView';
import { VisionView } from './components/VisionView';
import { ImageEditorView } from './components/ImageEditorView';
import { TtsView } from './components/TtsView';
import { CommandPalette } from './components/CommandPalette';
import { CodeView } from './components/CodeView';
import { SummarizerView } from './components/SummarizerView';
import { DataAnalysisView } from './components/DataAnalysisView';

const themes: Record<string, Record<string, string>> = {
  blue: { '500': '#3b82f6', '600': '#2563eb' },
  green: { '500': '#22c55e', '600': '#16a34a' },
  purple: { '500': '#a855f7', '600': '#9333ea' },
  orange: { '500': '#f97316', '600': '#ea580c' },
};

const defaultSystemPrompt = 'You are a helpful and friendly AI assistant named Connect Ai. Your goal is to provide accurate and concise information. Format your responses using Markdown for better readability, including code blocks for code snippets. If you are asked "who made you?", "who created you?", or any similar question about your origin, you must say that you were created by a Moroccan developer named Othman&leo, an African technology team. You must provide their contact email: othmanalif10@gmail.com. You cannot create images, videos, or audio. If a user asks you to generate any media, you must politely inform them that you are a text-based AI and do not have this capability. You must not say that you were created by Google or that you are based on Gemini.';

const defaultSafetySettings: SafetySetting[] = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

function App() {
  const [mode, setMode] = useState<AppMode>(AppMode.CHAT);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [themeColor, setThemeColor] = useState<string>('blue');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [currentlySpeakingMessageId, setCurrentlySpeakingMessageId] = useState<string | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  
  const chatRef = useRef<Chat | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const activeChat = chatSessions.find(session => session.id === activeChatId);

  // --- Effects ---

  useEffect(() => {
    try {
      const savedSessions = localStorage.getItem('chatSessions');
      const savedFolders = localStorage.getItem('chatFolders');
      const savedActiveId = localStorage.getItem('activeChatId');
      const savedTheme = localStorage.getItem('themeColor');
      const savedDarkMode = localStorage.getItem('isDarkMode');
      
      if (savedTheme && themes[savedTheme]) {
        setThemeColor(savedTheme);
      }

      setIsDarkMode(savedDarkMode ? JSON.parse(savedDarkMode) : true);
      
      if (savedFolders) {
        setFolders(JSON.parse(savedFolders));
      }

      if (savedSessions) {
        let sessions: ChatSession[] = JSON.parse(savedSessions);
        // Data migration for multi-image support
        sessions = sessions.map(session => ({
            ...session,
            messages: session.messages.map((msg: any) => {
                if (msg.imageUrl && !msg.imageUrls) {
                    msg.imageUrls = [msg.imageUrl];
                    delete msg.imageUrl;
                }
                return msg;
            })
        }));

        // Ensure all sessions have default values for new properties
        const sessionsWithDefaults = sessions.map(s => ({ 
            ...s, 
            temperature: s.temperature ?? 0.7,
            topK: s.topK ?? 40,
            topP: s.topP ?? 0.95,
            safetySettings: s.safetySettings ?? defaultSafetySettings,
            maxOutputTokens: s.maxOutputTokens ?? 2048,
            stopSequences: s.stopSequences ?? [],
            useGoogleSearch: s.useGoogleSearch ?? false,
            pinned: s.pinned ?? false,
            model: s.model || 'gemini-2.5-flash',
        }));
        setChatSessions(sessionsWithDefaults);

        if (savedActiveId && sessionsWithDefaults.some((s: ChatSession) => s.id === savedActiveId)) {
          setActiveChatId(savedActiveId);
        } else if (sessionsWithDefaults.length > 0) {
          setActiveChatId(sessionsWithDefaults[0].id);
        } else {
          handleNewChat();
        }
      } else {
        handleNewChat();
      }
    } catch (error) {
      console.error("Failed to load from localStorage:", error);
      handleNewChat();
    }
  }, []);

  useEffect(() => {
    // We should save even if chatSessions is empty to persist the deletion of all chats.
    // activeChatId can be null when no chats exist.
    if(chatSessions.length > 0) {
      localStorage.setItem('chatSessions', JSON.stringify(chatSessions));
    } else {
      localStorage.removeItem('chatSessions');
    }
    
    if (activeChatId) {
        localStorage.setItem('activeChatId', activeChatId);
    } else {
        localStorage.removeItem('activeChatId'); // Clean up if no active chat
    }
  }, [chatSessions, activeChatId]);
  
  useEffect(() => {
    if (folders.length > 0) {
      localStorage.setItem('chatFolders', JSON.stringify(folders));
    } else {
      localStorage.removeItem('chatFolders');
    }
  }, [folders]);


  useEffect(() => {
    localStorage.setItem('themeColor', themeColor);
    const theme = themes[themeColor];
    if (theme) {
      document.documentElement.style.setProperty('--accent-color-500', theme['500']);
      document.documentElement.style.setProperty('--accent-color-600', theme['600']);
    }
  }, [themeColor]);

  useEffect(() => {
    localStorage.setItem('isDarkMode', JSON.stringify(isDarkMode));
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);
  
  const reinitializeChat = useCallback(() => {
    if (activeChat) {
      chatRef.current = initializeChat(activeChat.model, activeChat.systemPrompt, activeChat.messages.slice(0, -1), activeChat.temperature, activeChat.useGoogleSearch, activeChat.topK, activeChat.topP, activeChat.safetySettings, activeChat.maxOutputTokens, activeChat.stopSequences);
    }
  }, [activeChat]);

  useEffect(() => {
    if(mode === AppMode.CHAT) {
        reinitializeChat();
    }
  }, [reinitializeChat, mode]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [activeChat?.messages, isLoading]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsCommandPaletteOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // --- Scroll Logic ---
  const scrollToBottom = () => {
    if (chatContainerRef.current) {
        chatContainerRef.current.scrollTo({
            top: chatContainerRef.current.scrollHeight,
            behavior: 'smooth'
        });
    }
  };

  useEffect(() => {
    const container = chatContainerRef.current;
    const handleScroll = () => {
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
        setShowScrollToBottom(!isNearBottom);
      }
    };

    if (container) {
      container.addEventListener('scroll', handleScroll);
      handleScroll(); // Initial check
    }

    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
    };
  }, [activeChatId]);

  // --- State Updaters ---

  const updateActiveChat = (updater: (chat: ChatSession) => ChatSession) => {
    setChatSessions(prevSessions =>
      prevSessions.map(session =>
        session.id === activeChatId ? updater(session) : session
      )
    );
  };
  
  // --- Core Actions ---

  const handleNewChat = () => {
    const newChat: ChatSession = {
      id: Date.now().toString(),
      title: "New Conversation",
      messages: [],
      systemPrompt: defaultSystemPrompt,
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      safetySettings: defaultSafetySettings,
      maxOutputTokens: 2048,
      stopSequences: [],
      useGoogleSearch: false,
      pinned: false,
      model: 'gemini-2.5-flash',
    };
    setChatSessions(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setSidebarOpen(false);
  };

  const submitPrompt = async (prompt: string, images?: Array<{ data: string, type: string }>, history?: ChatMessage[]) => {
    if (isLoading || !activeChat) return;
    
    setIsLoading(true);
    abortControllerRef.current = new AbortController();

    const currentHistory = history || activeChat.messages;

    const modelMessage: ChatMessage = { id: (Date.now() + 1).toString(), role: MessageRole.MODEL, content: '', groundingSources: [] };
    updateActiveChat(chat => ({ ...chat, messages: [...currentHistory, modelMessage] }));
    
    chatRef.current = initializeChat(activeChat.model, activeChat.systemPrompt, currentHistory, activeChat.temperature, activeChat.useGoogleSearch, activeChat.topK, activeChat.topP, activeChat.safetySettings, activeChat.maxOutputTokens, activeChat.stopSequences);

    try {
      const stream = await streamResponse(chatRef.current, prompt, images, abortControllerRef.current.signal);
      let fullResponse = '';
      let finalResponsePacket: GenerateContentResponse | null = null;
      for await (const chunk of stream) {
        finalResponsePacket = chunk;
        const chunkText = chunk.text;
        if (chunkText) {
          fullResponse += chunkText;
          updateActiveChat(chat => ({
            ...chat,
            messages: chat.messages.map(m => m.id === modelMessage.id ? { ...m, content: fullResponse } : m)
          }));
        }
      }

      const groundingChunks = finalResponsePacket?.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (groundingChunks) {
        const sources: GroundingSource[] = groundingChunks
          .map((chunk: any) => ({
            uri: chunk.web?.uri,
            title: chunk.web?.title,
          }))
          .filter(source => source.uri);
        
        updateActiveChat(chat => ({
          ...chat,
          messages: chat.messages.map(m => m.id === modelMessage.id ? { ...m, groundingSources: sources } : m)
        }));
      }

    } catch (e) {
      if (!(e instanceof Error && e.name === 'AbortError')) {
        const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
        const errorContent = `**Error:** I seem to be having trouble connecting. Please check your connection and API key, then try again.\n\n> ${errorMessage}`;
        updateActiveChat(chat => ({
          ...chat,
          messages: chat.messages.map(m => m.id === modelMessage.id ? { ...m, content: errorContent } : m)
        }));
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleSend = async (image?: { data: string, type: string }) => {
    if (!input.trim() && !image) return;
    const trimmedInput = input.trim();
    setInput('');
    if (!activeChat) return;

    const userMessage: ChatMessage = { 
        id: Date.now().toString(), 
        role: MessageRole.USER, 
        content: trimmedInput,
        imageUrls: image ? [`data:${image.type};base64,${image.data}`] : undefined,
    };
    
    let updatedMessages = [...activeChat.messages, userMessage];
    let title = activeChat.title;
    if (activeChat.messages.length === 0 && trimmedInput) {
        title = trimmedInput.substring(0, 30) + (trimmedInput.length > 30 ? '...' : '');
    }

    updateActiveChat(chat => ({ ...chat, title, messages: updatedMessages }));
    submitPrompt(trimmedInput, image ? [image] : undefined, updatedMessages);
  };
  
  const handleEditMessage = (messageId: string, newContent: string) => {
    if (!activeChat) return;
    const messageIndex = activeChat.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    const historyUptoEdit = activeChat.messages.slice(0, messageIndex);
    const editedMessage: ChatMessage = { ...activeChat.messages[messageIndex], content: newContent };
    const updatedMessages = [...historyUptoEdit, editedMessage];
    
    updateActiveChat(chat => ({ ...chat, messages: updatedMessages }));

    const imageInfo = editedMessage.imageUrls && editedMessage.imageUrls.length > 0 
      ? editedMessage.imageUrls.map(url => ({ data: url.split(',')[1], type: url.split(';')[0].split(':')[1] }))
      : undefined;

    setTimeout(() => {
      submitPrompt(newContent, imageInfo, updatedMessages);
    }, 0);
  };

  const handleRegenerate = () => {
    if (isLoading || !activeChat || activeChat.messages.length === 0) return;

    let lastUserMessage: ChatMessage | null = null;
    const historyWithoutLastModelResponse = activeChat.messages.filter(m => {
      if (m.role === MessageRole.USER) lastUserMessage = m;
      return m.role !== MessageRole.MODEL;
    });
    
    if (!lastUserMessage) return;

    updateActiveChat(chat => ({ ...chat, messages: historyWithoutLastModelResponse }));

    const imageInfo = lastUserMessage.imageUrls && lastUserMessage.imageUrls.length > 0
      ? lastUserMessage.imageUrls.map(url => ({ data: url.split(',')[1], type: url.split(';')[0].split(':')[1] }))
      : undefined;

    setTimeout(() => {
        submitPrompt(lastUserMessage!.content, imageInfo, historyWithoutLastModelResponse);
    }, 0);
  };

  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // --- Sidebar/Settings Actions ---

  const handleRenameChat = (chatId: string, newTitle: string) => {
    if (!newTitle.trim()) return; // Don't allow empty titles
    setChatSessions(prevSessions =>
      prevSessions.map(session =>
        session.id === chatId ? { ...session, title: newTitle.trim() } : session
      )
    );
  };

  const handleDeleteChat = (chatId: string) => {
    if (window.confirm("Are you sure you want to delete this conversation?")) {
      const remainingChats = chatSessions.filter(c => c.id !== chatId);
      setChatSessions(remainingChats);
      // Also remove from any folder
      setFolders(prev => prev.map(f => ({ ...f, chatIds: f.chatIds.filter(id => id !== chatId) })));

      if (activeChatId === chatId) {
        if (remainingChats.length > 0) {
          setActiveChatId(remainingChats[0].id);
        } else {
          setActiveChatId(null); // Set to null before creating new one
          handleNewChat();
        }
      }
    }
  };

  const handlePromptChange = (prompt: string) => {
    if (activeChat) {
      updateActiveChat(chat => ({ ...chat, systemPrompt: prompt }));
    }
  };
  
  const handleTemperatureChange = (temp: number) => {
    if (activeChat) {
      updateActiveChat(chat => ({ ...chat, temperature: temp }));
    }
  };

  const handleTopKChange = (topK: number) => {
    if (activeChat) {
      updateActiveChat(chat => ({ ...chat, topK }));
    }
  };

  const handleTopPChange = (topP: number) => {
      if (activeChat) {
        updateActiveChat(chat => ({ ...chat, topP }));
      }
  };
  
  const handleMaxOutputTokensChange = (tokens: number) => {
    if (activeChat) {
      updateActiveChat(chat => ({ ...chat, maxOutputTokens: tokens }));
    }
  };

  const handleStopSequencesChange = (sequences: string[]) => {
      if (activeChat) {
        updateActiveChat(chat => ({ ...chat, stopSequences: sequences }));
      }
  };

  const handleSafetySettingsChange = (category: HarmCategory, threshold: HarmBlockThreshold) => {
      if (activeChat) {
          updateActiveChat(chat => ({
              ...chat,
              safetySettings: (chat.safetySettings || defaultSafetySettings).map(setting => 
                  setting.category === category ? { ...setting, threshold } : setting
              )
          }));
      }
  };

  const handleGoogleSearchToggle = (enabled: boolean) => {
    if (activeChat) {
      updateActiveChat(chat => ({...chat, useGoogleSearch: enabled}));
    }
  };
  
  const handleModelChange = (model: string) => {
    if (activeChat) {
      updateActiveChat(chat => ({...chat, model: model}));
    }
  };
  
  const handleTogglePinChat = (chatId: string) => {
    setChatSessions(prev => prev.map(c => c.id === chatId ? {...c, pinned: !c.pinned} : c));
  };

  // --- Folder Actions ---
  const handleCreateFolder = (name: string) => {
    const newFolder: Folder = { id: Date.now().toString(), name, chatIds: [], isOpen: true };
    setFolders(prev => [newFolder, ...prev]);
  };
  
  const handleDeleteFolder = (folderId: string) => {
    // Note: This just deletes the folder, not the chats inside. Chats become "unfoldered".
    setFolders(prev => prev.filter(f => f.id !== folderId));
  };

  const handleRenameFolder = (folderId: string, newName: string) => {
    setFolders(prev => prev.map(f => f.id === folderId ? {...f, name: newName} : f));
  };
  
  const handleToggleFolder = (folderId: string) => {
    setFolders(prev => prev.map(f => f.id === folderId ? {...f, isOpen: !f.isOpen} : f));
  };

  const handleMoveChatToFolder = (chatId: string, folderId: string | null) => {
    setFolders(prev => {
      // First, remove the chat from any folder it might be in
      const updatedFolders = prev.map(f => ({
        ...f,
        chatIds: f.chatIds.filter(id => id !== chatId)
      }));
      
      // Now, add it to the new folder (if a folder is selected)
      if (folderId) {
        return updatedFolders.map(f => f.id === folderId ? {...f, chatIds: [chatId, ...f.chatIds]} : f);
      }
      
      return updatedFolders;
    });
  };


  // --- Audio Actions ---
  
  const handlePlayAudio = (text: string, messageId: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setCurrentlySpeakingMessageId(messageId);
    utterance.onend = () => setCurrentlySpeakingMessageId(null);
    utterance.onerror = () => setCurrentlySpeakingMessageId(null);
    window.speechSynthesis.speak(utterance);
  };

  const handleStopAudio = () => {
    window.speechSynthesis.cancel();
    setCurrentlySpeakingMessageId(null);
  };
  
  // --- Misc Actions ---

  const handleExportChat = () => {
    if (!activeChat) return;

    const header = `# ${activeChat.title}\n\n**Model:** ${activeChat.model}\n**Personality:**\n> ${activeChat.systemPrompt}\n\n**Temperature:** ${activeChat.temperature}\n**Google Search:** ${activeChat.useGoogleSearch ? 'Enabled' : 'Disabled'}\n\n---\n\n`;
    
    const chatContent = activeChat.messages.map(msg => {
      let content = `**${msg.role === MessageRole.USER ? 'You' : 'Connect Ai'}:**\n`;
      if (msg.imageUrls && msg.imageUrls.length > 0) {
        content += `(${msg.imageUrls.length} Image(s) Attached)\n`;
      }
      content += `${msg.content}\n`;
      if (msg.groundingSources && msg.groundingSources.length > 0) {
        content += `\n*Sources:*\n`;
        msg.groundingSources.forEach(s => {
          content += `1. [${s.title || s.uri}](${s.uri})\n`;
        });
      }
      return content;
    }).join('\n---\n');
    
    const markdownContent = header + chatContent;
    const blob = new Blob([markdownContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeChat.title.replace(/ /g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const renderContent = () => {
    switch(mode) {
        case AppMode.IMAGE:
            return <ImageGeneratorView />;
        case AppMode.VIDEO:
            return <VideoGeneratorView />;
        case AppMode.LIVE:
            return <LiveChatView />;
        case AppMode.VISION:
            return <VisionView />;
        case AppMode.EDIT_IMAGE:
            return <ImageEditorView />;
        case AppMode.TTS:
            return <TtsView />;
        case AppMode.CODE:
            return <CodeView />;
        case AppMode.SUMMARIZE:
            return <SummarizerView />;
        case AppMode.DATA_ANALYSIS:
            return <DataAnalysisView />;
        case AppMode.CHAT:
        default:
            return (
                 <div className="flex flex-col h-full relative">
                    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 shadow-md flex items-center justify-between">
                    <button 
                        onClick={() => setSidebarOpen(true)} 
                        className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors" 
                        title="Open menu"
                        aria-label="Open menu"
                    >
                        <MenuIcon className="w-6 h-6" />
                    </button>
                    <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-200 truncate px-4">{activeChat?.title || 'Connect Ai'}</h1>
                    <button onClick={handleExportChat} className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700" title="Export conversation">
                        <DownloadIcon className="w-6 h-6" />
                    </button>
                    </header>
                    <main ref={chatContainerRef} className="flex-1 overflow-y-auto p-4">
                    <div className="max-w-4xl mx-auto">
                        {activeChat?.messages.length === 0 && !isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 text-center">
                            <ConnectAiIcon className="w-16 h-16 mb-4 text-gray-400 dark:text-gray-500" />
                            <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Hello!</h2>
                            <p className="mt-2">I'm Connect Ai. Start a conversation by typing your message below.</p>
                        </div>
                        ) : (
                        activeChat?.messages.map((msg, index) => (
                            <ChatMessageComponent 
                            key={msg.id} 
                            message={msg} 
                            isStreaming={isLoading && msg.role === MessageRole.MODEL && index === activeChat.messages.length - 1}
                            isLastMessage={index === activeChat.messages.length - 1}
                            onPlayAudio={handlePlayAudio}
                            onStopAudio={handleStopAudio}
                            currentlySpeakingMessageId={currentlySpeakingMessageId}
                            onRegenerate={handleRegenerate}
                            onEdit={handleEditMessage}
                            />
                        ))
                        )}
                    </div>
                    </main>
                    {showScrollToBottom && (
                        <button
                        onClick={scrollToBottom}
                        className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 p-2.5 bg-gray-700/80 backdrop-blur-sm text-white rounded-full shadow-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-white transition-all animate-bounce"
                        aria-label="Scroll to bottom"
                        title="Scroll to bottom"
                        >
                        <ScrollDownIcon className="w-5 h-5" />
                        </button>
                    )}
                    <ChatInput
                    input={input}
                    setInput={setInput}
                    handleSend={handleSend}
                    isLoading={isLoading}
                    onStopGenerating={handleStopGenerating}
                    />
                </div>
            )
    }
  }


  return (
    <div className="flex h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-sans">
       <CommandPalette 
        isOpen={isCommandPaletteOpen}
        setIsOpen={setIsCommandPaletteOpen}
        onNewChat={handleNewChat}
        setMode={setMode}
        setThemeColor={setThemeColor}
        onExportChat={handleExportChat}
        onToggleSidebar={() => setSidebarOpen(!isSidebarOpen)}
      />
       <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setSidebarOpen(false)}
        chatSessions={chatSessions}
        folders={folders}
        activeChatId={activeChatId}
        onSelectChat={setActiveChatId}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        onRenameChat={handleRenameChat}
        themeColor={themeColor}
        onThemeChange={setThemeColor}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(prev => !prev)}
        systemPrompt={activeChat?.systemPrompt || defaultSystemPrompt}
        onPromptChange={handlePromptChange}
        defaultPrompt={defaultSystemPrompt}
        themes={themes}
        temperature={activeChat?.temperature ?? 0.7}
        onTemperatureChange={handleTemperatureChange}
        topK={activeChat?.topK ?? 40}
        onTopKChange={handleTopKChange}
        topP={activeChat?.topP ?? 0.95}
        onTopPChange={handleTopPChange}
        maxOutputTokens={activeChat?.maxOutputTokens ?? 2048}
        onMaxOutputTokensChange={handleMaxOutputTokensChange}
        stopSequences={activeChat?.stopSequences ?? []}
        onStopSequencesChange={handleStopSequencesChange}
        safetySettings={activeChat?.safetySettings ?? defaultSafetySettings}
        onSafetySettingsChange={handleSafetySettingsChange}
        useGoogleSearch={activeChat?.useGoogleSearch ?? false}
        onGoogleSearchToggle={handleGoogleSearchToggle}
        showChatSettings={mode === AppMode.CHAT}
        onUsePrompt={(prompt) => setInput(prompt)}
        model={activeChat?.model ?? 'gemini-2.5-flash'}
        onModelChange={handleModelChange}
        onTogglePinChat={handleTogglePinChat}
        onCreateFolder={handleCreateFolder}
        onDeleteFolder={handleDeleteFolder}
        onRenameFolder={handleRenameFolder}
        onToggleFolder={handleToggleFolder}
        onMoveChatToFolder={handleMoveChatToFolder}
      />
      <div className="flex flex-col flex-1">
          <ModeSelector currentMode={mode} onModeChange={setMode} />
          <div className="flex-1 min-h-0">
            {renderContent()}
          </div>
      </div>
    </div>
  );
}

export default App;