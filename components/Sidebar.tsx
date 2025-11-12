
import React, { useState, useEffect, useMemo } from 'react';
import { CloseIcon, PlusIcon, TrashIcon, ChatIcon, BookOpenIcon, PencilIcon, PinIcon, FolderIcon, DotsVerticalIcon, SparklesIcon, SunIcon, MoonIcon } from './Icons';
import { ChatSession, Folder, SafetySetting, HarmCategory, HarmBlockThreshold } from '../types';
import { PromptLibrary } from './PromptLibrary';

type SidebarTab = 'conversations' | 'prompts';

interface PromptPreset {
    title: string;
    prompt: string;
}

const personalityPresets: PromptPreset[] = [
    { title: 'Default Assistant', prompt: 'You are a helpful and friendly AI assistant named Connect Ai. Your goal is to provide accurate and concise information. Format your responses using Markdown for better readability, including code blocks for code snippets. If you are asked "who made you?", "who created you?", or any similar question about your origin, you must say that you were created by a Moroccan developer named Othman&leo, an African technology team. You must provide their contact email: othmanalif10@gmail.com. You cannot create images, videos, or audio. If a user asks you to generate any media, you must politely inform them that you are a text-based AI and do not have this capability. You must not say that you were created by Google or that you are based on Gemini.' },
    { title: 'Sarcastic Assistant', prompt: 'You are a sarcastic, dry-witted AI. You answer questions correctly, but with a heavy dose of snark and eye-rolling. You are not overly friendly.' },
    { title: 'Code Reviewer', prompt: 'You are an expert code reviewer. Analyze the following code for bugs, style issues, and performance improvements. Provide your feedback in a clear, constructive, and itemized list.' },
    { title: 'Creative Writer', prompt: 'You are a creative writer, a master of prose and storytelling. Use vivid imagery, rich language, and engaging narrative techniques in all your responses. Help the user brainstorm, write, and refine their creative work.' },
    { title: 'ELI5 Explainer', prompt: 'You explain complex topics as if you were talking to a 5-year-old. Use simple words, short sentences, and relatable analogies. Avoid jargon and technical details.' },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  chatSessions: ChatSession[];
  folders: Folder[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  onRenameChat: (id: string, newTitle: string) => void;
  themeColor: string;
  onThemeChange: (color: string) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  systemPrompt: string;
  onPromptChange: (prompt: string) => void;
  defaultPrompt: string;
  themes: Record<string, Record<string, string>>;
  temperature: number;
  onTemperatureChange: (temp: number) => void;
  topK: number;
  onTopKChange: (k: number) => void;
  topP: number;
  onTopPChange: (p: number) => void;
  maxOutputTokens: number;
  onMaxOutputTokensChange: (tokens: number) => void;
  stopSequences: string[];
  onStopSequencesChange: (sequences: string[]) => void;
  safetySettings: SafetySetting[];
  onSafetySettingsChange: (category: HarmCategory, threshold: HarmBlockThreshold) => void;
  useGoogleSearch: boolean;
  onGoogleSearchToggle: (enabled: boolean) => void;
  showChatSettings: boolean;
  onUsePrompt: (prompt: string) => void;
  model: string;
  onModelChange: (model: string) => void;
  onTogglePinChat: (chatId: string) => void;
  onCreateFolder: (name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onRenameFolder: (folderId: string, newName: string) => void;
  onToggleFolder: (folderId: string) => void;
  onMoveChatToFolder: (chatId: string, folderId: string | null) => void;
}

const ChatListItem: React.FC<{
    session: ChatSession;
    isActive: boolean;
    onSelect: () => void;
    onRename: (id: string, title: string) => void;
    onDelete: (id: string) => void;
    onTogglePin: (id: string) => void;
    onMoveToFolder: (id: string, folderId: string | null) => void;
    folders: Folder[];
}> = ({ session, isActive, onSelect, onRename, onDelete, onTogglePin, onMoveToFolder, folders }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [title, setTitle] = useState(session.title);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSave = () => {
        onRename(session.id, title);
        setIsEditing(false);
    };

    return isEditing ? (
        <div className="flex items-center gap-2 p-1">
            <input 
                type="text" value={title} onChange={e => setTitle(e.target.value)}
                onBlur={handleSave}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setIsEditing(false); }}
                autoFocus
                className="flex-1 bg-gray-200 dark:bg-gray-900 text-gray-900 dark:text-white rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-[var(--accent-color-500)]"
            />
        </div>
    ) : (
        <div className={`group flex items-center justify-between rounded-md text-sm transition-colors ${isActive ? 'bg-[var(--accent-color-600)] text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
            <button onClick={onSelect} className="flex-1 flex items-center gap-2 text-left px-3 py-2 truncate" title={session.title}>
                {session.pinned && <PinIcon className="w-4 h-4 text-yellow-400 flex-shrink-0" />}
                <span className="truncate">{session.title}</span>
            </button>
            <div className="relative pr-1">
                <button onClick={() => setIsMenuOpen(o => !o)} className={`p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} title="Actions">
                    <DotsVerticalIcon className="w-4 h-4" />
                </button>
                {isMenuOpen && (
                    <div ref={menuRef} className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-10">
                        <button onClick={() => { onTogglePin(session.id); setIsMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">{session.pinned ? 'Unpin' : 'Pin'}</button>
                        <div className="relative group/submenu">
                            <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex justify-between items-center">Move to...</button>
                            <div className="absolute left-full -top-1 mt-0 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg hidden group-hover/submenu:block">
                                <button onClick={() => { onMoveToFolder(session.id, null); setIsMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">(Remove from folder)</button>
                                {folders.map(f => (
                                    <button key={f.id} onClick={() => { onMoveToFolder(session.id, f.id); setIsMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 truncate">{f.name}</button>
                                ))}
                            </div>
                        </div>
                        <button onClick={() => { setIsEditing(true); setIsMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">Rename</button>
                        <button onClick={() => { onDelete(session.id); setIsMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-red-500/10 dark:hover:bg-red-500/50 text-red-500 dark:text-red-400">Delete</button>
                    </div>
                )}
            </div>
        </div>
    );
};


export const Sidebar: React.FC<SidebarProps> = (props) => {
  const { 
    isOpen, onClose, chatSessions, folders, activeChatId, onSelectChat, onNewChat, 
    onDeleteChat, onRenameChat, themeColor, onThemeChange, isDarkMode, onToggleDarkMode,
    systemPrompt, onPromptChange, defaultPrompt, themes, temperature, onTemperatureChange,
    topK, onTopKChange, topP, onTopPChange, maxOutputTokens, onMaxOutputTokensChange,
    stopSequences, onStopSequencesChange, safetySettings, onSafetySettingsChange,
    useGoogleSearch, onGoogleSearchToggle, showChatSettings, onUsePrompt, model, onModelChange,
    onTogglePinChat, onCreateFolder, onDeleteFolder, onRenameFolder, onToggleFolder, onMoveChatToFolder
  } = props;
  const [localPrompt, setLocalPrompt] = useState(systemPrompt);
  const [activeTab, setActiveTab] = useState<SidebarTab>('conversations');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { setLocalPrompt(systemPrompt); }, [systemPrompt, activeChatId]);
  useEffect(() => { if (showChatSettings) setActiveTab('conversations'); }, [showChatSettings]);

  const handleSavePrompt = () => onPromptChange(localPrompt);
  const handleResetPrompt = () => { setLocalPrompt(defaultPrompt); onPromptChange(defaultPrompt); };
  const handleSelectChat = (id: string) => { onSelectChat(id); onClose(); };
  const handleUsePrompt = (prompt: string) => { onUsePrompt(prompt); onClose(); };
  const handlePresetChange = (prompt: string) => { setLocalPrompt(prompt); onPromptChange(prompt); }

  const { pinnedChats, unfolderedChats, chatToFolderMap } = useMemo(() => {
    const chatToFolderMap = new Map<string, string>();
    folders.forEach(f => f.chatIds.forEach(cid => chatToFolderMap.set(cid, f.id)));
    
    const filteredSessions = chatSessions.filter(s => s.title.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const pinnedChats = filteredSessions.filter(s => s.pinned).sort((a,b) => a.title.localeCompare(b.title));
    const unfolderedChats = filteredSessions.filter(s => !s.pinned && !chatToFolderMap.has(s.id));
    
    return { pinnedChats, unfolderedChats, chatToFolderMap };
  }, [chatSessions, folders, searchTerm]);

  const handleCreateFolder = () => {
    const name = prompt("Enter folder name:", "New Folder");
    if (name) onCreateFolder(name);
  };

  const safetyLabels: Record<HarmCategory, string> = {
    [HarmCategory.HARM_CATEGORY_HARASSMENT]: 'Harassment',
    [HarmCategory.HARM_CATEGORY_HATE_SPEECH]: 'Hate Speech',
    [HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT]: 'Sexually Explicit',
    [HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT]: 'Dangerous Content',
  };
  
  const thresholdOptions = [
      { value: HarmBlockThreshold.BLOCK_NONE, label: 'Allow All' },
      { value: HarmBlockThreshold.BLOCK_ONLY_HIGH, label: 'Block High' },
      { value: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE, label: 'Block Medium+' },
      { value: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE, label: 'Block Low+' },
  ];
  
  return (
    <>
      <div 
        className={`fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={onClose}
      ></div>
      
      <aside className={`fixed top-0 left-0 h-full w-80 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-lg z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <h2 className="text-xl font-semibold">Menu</h2>
            <button onClick={onClose} className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700" title="Close menu"><CloseIcon /></button>
          </header>

          <div className="flex-1 flex flex-col p-4 overflow-hidden">
            {showChatSettings && (
              <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
                <button onClick={() => setActiveTab('conversations')} className={`flex-1 flex items-center justify-center gap-2 p-3 text-sm font-semibold transition-colors ${activeTab === 'conversations' ? 'text-gray-900 dark:text-white border-b-2 border-[var(--accent-color-500)]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}><ChatIcon className="w-5 h-5" /> Conversations</button>
                <button onClick={() => setActiveTab('prompts')} className={`flex-1 flex items-center justify-center gap-2 p-3 text-sm font-semibold transition-colors ${activeTab === 'prompts' ? 'text-gray-900 dark:text-white border-b-2 border-[var(--accent-color-500)]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}><BookOpenIcon className="w-5 h-5" /> Prompts</button>
              </div>
            )}

            {showChatSettings && activeTab === 'conversations' ? (
              <div className="flex-1 flex flex-col mb-4 min-h-0">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <button onClick={onNewChat} className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700" title="New Conversation"><PlusIcon /></button>
                        <button onClick={handleCreateFolder} className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700" title="New Folder"><FolderIcon /></button>
                    </div>
                </div>
                <div className="px-1 mb-2"><input type="text" placeholder="Search conversations..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-md p-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-color-500)]" /></div>
                
                <div className="flex-1 overflow-y-auto space-y-1 pr-2 -mr-2">
                    {pinnedChats.map(session => <ChatListItem key={session.id} session={session} isActive={activeChatId === session.id} onSelect={() => handleSelectChat(session.id)} onRename={onRenameChat} onDelete={onDeleteChat} onTogglePin={onTogglePinChat} onMoveToFolder={onMoveChatToFolder} folders={folders}/>)}
                    
                    {pinnedChats.length > 0 && <hr className="border-gray-200 dark:border-gray-700 my-2" />}

                    {folders.map(folder => (
                        <div key={folder.id}>
                            <button onClick={() => onToggleFolder(folder.id)} className="w-full flex items-center gap-2 p-2 text-left text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md">
                                <FolderIcon />
                                <span className="flex-1 truncate">{folder.name}</span>
                                <span className="text-xs text-gray-500">{folder.chatIds.length}</span>
                            </button>
                            {folder.isOpen && (
                                <div className="pl-4 border-l-2 border-gray-200 dark:border-gray-700 ml-2">
                                    {chatSessions.filter(c => folder.chatIds.includes(c.id)).map(session => (
                                        <ChatListItem key={session.id} session={session} isActive={activeChatId === session.id} onSelect={() => handleSelectChat(session.id)} onRename={onRenameChat} onDelete={onDeleteChat} onTogglePin={onTogglePinChat} onMoveToFolder={onMoveChatToFolder} folders={folders} />
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}

                    {unfolderedChats.map(session => <ChatListItem key={session.id} session={session} isActive={activeChatId === session.id} onSelect={() => handleSelectChat(session.id)} onRename={onRenameChat} onDelete={onDeleteChat} onTogglePin={onTogglePinChat} onMoveToFolder={onMoveChatToFolder} folders={folders}/>)}
                </div>
              </div>
            ) : (
                <div className="flex-1 flex flex-col mb-4 overflow-y-hidden">
                    <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">Prompt Library</h3>
                    <PromptLibrary onSelectPrompt={handleUsePrompt} />
                </div>
            )}

            <div className={`pt-4 ${showChatSettings ? 'border-t' : ''} border-gray-200 dark:border-gray-700 space-y-6 flex-shrink-0 overflow-y-auto max-h-[50%]`}>
              <section>
                <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-3">Appearance</h3>
                <div className="flex items-center justify-between">
                    <div className="flex gap-4">{Object.keys(themes).map(color => (<button key={color} onClick={() => onThemeChange(color)} className={`w-8 h-8 rounded-full transition-transform transform hover:scale-110 focus:outline-none ${themeColor === color ? `ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-800 ring-[var(--accent-color-500)]` : ''}`} style={{ backgroundColor: themes[color]['500'] }} aria-label={`Set theme to ${color}`} title={`Set theme to ${color}`} />))}</div>
                    <button onClick={onToggleDarkMode} className="p-2 rounded-full bg-gray-200 dark:bg-gray-700" title="Toggle theme">
                        {isDarkMode ? <SunIcon className="w-5 h-5 text-yellow-400" /> : <MoonIcon className="w-5 h-5 text-gray-500" />}
                    </button>
                </div>
              </section>

              {showChatSettings && (
                  <>
                    <section>
                        <h3 className="flex items-center gap-2 text-lg font-medium text-gray-700 dark:text-gray-300 mb-3">
                            <SparklesIcon className="w-5 h-5"/>
                            AI Settings
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="model-select" className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Model</label>
                                <select id="model-select" value={model} onChange={(e) => onModelChange(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-md p-2 text-sm focus:ring-[var(--accent-color-500)] focus:border-[var(--accent-color-500)]">
                                    <option value="gemini-2.5-flash">Connect Ai 2,5 flash</option>
                                    <option value="gemini-2.5-pro">Connect Ai 2,5 pro</option>
                                </select>
                                <p className="text-xs text-gray-500 mt-2">Pro is better for complex reasoning tasks.</p>
                            </div>
                            <div>
                                <label htmlFor="temperature" className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Temperature: <span className="font-semibold text-gray-900 dark:text-white">{temperature.toFixed(2)}</span></label>
                                <input type="range" id="temperature" min="0" max="1" step="0.01" value={temperature} onChange={(e) => onTemperatureChange(parseFloat(e.target.value))} className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[var(--accent-color-500)]" />
                                <p className="text-xs text-gray-500 mt-2">Lower for focused, higher for creative responses.</p>
                            </div>
                            <div>
                                <label htmlFor="top-k" className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Top-K: <span className="font-semibold text-gray-900 dark:text-white">{topK}</span></label>
                                <input type="range" id="top-k" min="1" max="100" step="1" value={topK} onChange={(e) => onTopKChange(parseInt(e.target.value, 10))} className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[var(--accent-color-500)]" />
                                <p className="text-xs text-gray-500 mt-2">Controls randomness. Lower for less random responses.</p>
                            </div>
                            <div>
                                <label htmlFor="top-p" className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Top-P: <span className="font-semibold text-gray-900 dark:text-white">{topP.toFixed(2)}</span></label>
                                <input type="range" id="top-p" min="0" max="1" step="0.01" value={topP} onChange={(e) => onTopPChange(parseFloat(e.target.value))} className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[var(--accent-color-500)]" />
                                <p className="text-xs text-gray-500 mt-2">Controls diversity. Lower for more focused responses.</p>
                            </div>
                             <details className="group pt-2">
                                <summary className="cursor-pointer text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white list-none group-open:text-gray-900 dark:group-open:text-white flex items-center justify-between font-medium">
                                    <span>Advanced Settings</span>
                                    <svg className="w-4 h-4 transition-transform group-open:rotate-180" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                                </summary>
                                <div className="mt-4 space-y-4">
                                    <div>
                                        <label htmlFor="max-tokens" className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Max Output Tokens: <span className="font-semibold text-gray-900 dark:text-white">{maxOutputTokens}</span></label>
                                        <input type="range" id="max-tokens" min="256" max="8192" step="256" value={maxOutputTokens} onChange={(e) => onMaxOutputTokensChange(parseInt(e.target.value, 10))} className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[var(--accent-color-500)]" />
                                        <p className="text-xs text-gray-500 mt-2">Maximum number of tokens to generate in the response.</p>
                                    </div>
                                    <div>
                                        <label htmlFor="stop-sequences" className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Stop Sequences</label>
                                        <input type="text" id="stop-sequences" placeholder="e.g., Chapter 2,Conclusion" value={stopSequences.join(',')} onChange={e => onStopSequencesChange(e.target.value.split(',').map(s => s.trim()).filter(Boolean))} className="w-full bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-md p-2 text-sm focus:ring-[var(--accent-color-500)] focus:border-[var(--accent-color-500)]" />
                                        <p className="text-xs text-gray-500 mt-2">Comma-separated phrases that will stop generation.</p>
                                    </div>
                                </div>
                            </details>
                            <div className="pt-2">
                                <label htmlFor="google-search-toggle" className="flex items-center justify-between cursor-pointer">
                                    <span className="text-sm text-gray-700 dark:text-gray-300">Enable Google Search</span>
                                    <div className="relative"><input type="checkbox" id="google-search-toggle" className="sr-only" checked={useGoogleSearch} onChange={(e) => onGoogleSearchToggle(e.target.checked)} /><div className="block bg-gray-200 dark:bg-gray-600 w-10 h-6 rounded-full"></div><div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${useGoogleSearch ? 'translate-x-4 bg-[var(--accent-color-500)]' : ''}`}></div></div>
                                </label>
                                <p className="text-xs text-gray-500 mt-2">Allow the AI to access recent information from the web.</p>
                            </div>
                            <div>
                                <h4 className="text-sm text-gray-700 dark:text-gray-300 mb-2">Safety Filters</h4>
                                <div className="space-y-2">
                                    {safetySettings.map(setting => (
                                        <div key={setting.category} className="flex items-center justify-between">
                                            <label htmlFor={`safety-${setting.category}`} className="text-sm text-gray-600 dark:text-gray-400">{safetyLabels[setting.category]}</label>
                                            <select
                                                id={`safety-${setting.category}`}
                                                value={setting.threshold}
                                                onChange={(e) => onSafetySettingsChange(setting.category, e.target.value as HarmBlockThreshold)}
                                                className="bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-md p-1.5 text-xs focus:ring-[var(--accent-color-500)] focus:border-[var(--accent-color-500)]"
                                            >
                                                {thresholdOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-500 mt-2">Adjust content safety levels for the responses.</p>
                            </div>
                        </div>
                    </section>
                    
                    <section>
                        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-3">Chat Personality</h3>
                        <div>
                            <label htmlFor="personality-preset" className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Personality Presets</label>
                            <select id="personality-preset" onChange={(e) => handlePresetChange(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 rounded-md p-2 text-sm focus:ring-[var(--accent-color-500)] focus:border-[var(--accent-color-500)] mb-3">
                                <option value="">Select a preset...</option>
                                {personalityPresets.map(p => <option key={p.title} value={p.prompt}>{p.title}</option>)}
                            </select>
                        </div>
                        <textarea value={localPrompt} onChange={(e) => setLocalPrompt(e.target.value)} rows={6} className="w-full bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-color-500)]" placeholder="Custom system instruction..."/>
                        <div className="flex justify-end gap-2 mt-3">
                            <button onClick={handleResetPrompt} className="px-4 py-2 text-sm rounded-md bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">Reset</button>
                            <button onClick={handleSavePrompt} className="px-4 py-2 text-sm font-semibold rounded-md text-white bg-[var(--accent-color-600)] hover:bg-[var(--accent-color-500)] transition-colors">Save</button>
                        </div>
                    </section>
                  </>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};