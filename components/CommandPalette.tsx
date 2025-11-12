

import React, { useState, useEffect, useRef, Fragment } from 'react';
import { AppMode } from '../types';
import { ChatIcon, VideoIcon, ImageIcon, WaveformIcon, PlusIcon, DownloadIcon, MenuIcon, EyeIcon, SparklesIcon, TextToSpeechIcon, CommandLineIcon, DocumentTextIcon, ChartBarIcon } from './Icons';

interface Command {
  id: string;
  name: string;
  icon: React.FC<{ className?: string }>;
  action: () => void;
  section: 'Navigation' | 'Chat' | 'Theme';
  shortcut?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onNewChat: () => void;
  setMode: (mode: AppMode) => void;
  setThemeColor: (color: string) => void;
  onExportChat: () => void;
  onToggleSidebar: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, setIsOpen, onNewChat, setMode, setThemeColor, onExportChat, onToggleSidebar }) => {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: Command[] = [
    { id: 'newChat', name: 'New Chat', icon: PlusIcon, action: onNewChat, section: 'Chat' },
    { id: 'exportChat', name: 'Export Chat', icon: DownloadIcon, action: onExportChat, section: 'Chat' },
    { id: 'toggleSidebar', name: 'Toggle Sidebar', icon: MenuIcon, action: onToggleSidebar, section: 'Navigation' },
    { id: 'modeChat', name: 'Switch to Chat Mode', icon: ChatIcon, action: () => setMode(AppMode.CHAT), section: 'Navigation' },
    { id: 'modeVision', name: 'Switch to Vision Mode', icon: EyeIcon, action: () => setMode(AppMode.VISION), section: 'Navigation' },
    { id: 'modeLive', name: 'Switch to Live Mode', icon: WaveformIcon, action: () => setMode(AppMode.LIVE), section: 'Navigation' },
    { id: 'modeImage', name: 'Switch to Image Gen Mode', icon: ImageIcon, action: () => setMode(AppMode.IMAGE), section: 'Navigation' },
    { id: 'modeEditImage', name: 'Switch to Image Edit Mode', icon: SparklesIcon, action: () => setMode(AppMode.EDIT_IMAGE), section: 'Navigation' },
    { id: 'modeVideo', name: 'Switch to Video Mode', icon: VideoIcon, action: () => setMode(AppMode.VIDEO), section: 'Navigation' },
    { id: 'modeTts', name: 'Switch to TTS Mode', icon: TextToSpeechIcon, action: () => setMode(AppMode.TTS), section: 'Navigation' },
    { id: 'modeCode', name: 'Switch to Code Gen Mode', icon: CommandLineIcon, action: () => setMode(AppMode.CODE), section: 'Navigation' },
    { id: 'modeSummarize', name: 'Switch to Summarize Mode', icon: DocumentTextIcon, action: () => setMode(AppMode.SUMMARIZE), section: 'Navigation' },
    { id: 'modeData', name: 'Switch to Data Analysis Mode', icon: ChartBarIcon, action: () => setMode(AppMode.DATA_ANALYSIS), section: 'Navigation' },
    { id: 'themeBlue', name: 'Change Theme to Blue', icon: () => <div className="w-4 h-4 rounded-full bg-blue-500"/>, action: () => setThemeColor('blue'), section: 'Theme' },
    { id: 'themeGreen', name: 'Change Theme to Green', icon: () => <div className="w-4 h-4 rounded-full bg-green-500"/>, action: () => setThemeColor('green'), section: 'Theme' },
    { id: 'themePurple', name: 'Change Theme to Purple', icon: () => <div className="w-4 h-4 rounded-full bg-purple-500"/>, action: () => setThemeColor('purple'), section: 'Theme' },
    { id: 'themeOrange', name: 'Change Theme to Orange', icon: () => <div className="w-4 h-4 rounded-full bg-orange-500"/>, action: () => setThemeColor('orange'), section: 'Theme' },
  ];

  const filteredCommands = search
    ? commands.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : commands;

  useEffect(() => {
    if (isOpen) {
        inputRef.current?.focus();
    } else {
        setSearch('');
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const command = filteredCommands[selectedIndex];
        if (command) {
          command.action();
          setIsOpen(false);
        }
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands]);
  
  const groupedCommands = filteredCommands.reduce((acc, command) => {
    (acc[command.section] = acc[command.section] || []).push(command);
    return acc;
  }, {} as Record<string, Command[]>);


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20" onClick={() => setIsOpen(false)}>
      <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm"></div>
      <div 
        className="relative w-full max-w-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Type a command or search..."
          className="w-full p-4 bg-white dark:bg-gray-800 text-lg text-gray-900 dark:text-white focus:outline-none border-b border-gray-200 dark:border-gray-700"
        />
        <div className="max-h-96 overflow-y-auto">
          {Object.entries(groupedCommands).length > 0 ? (
            Object.entries(groupedCommands).map(([section, commands]) => (
              <div key={section} className="p-2">
                <h3 className="px-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400">{section}</h3>
                <ul>
                  {commands.map((command, index) => {
                    // This is a bit complex, but we need the global index for selection
                    const globalIndex = filteredCommands.findIndex(c => c.id === command.id);
                    const Icon = command.icon;
                    return (
                        <li
                            key={command.id}
                            onClick={() => { command.action(); setIsOpen(false); }}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer ${
                            selectedIndex === globalIndex ? 'bg-[var(--accent-color-600)] text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                        >
                            <Icon className="w-5 h-5 text-gray-500 dark:text-gray-300" />
                            <span className="flex-1">{command.name}</span>
                        </li>
                    )
                  })}
                </ul>
              </div>
            ))
          ) : (
            <p className="p-4 text-center text-gray-500 dark:text-gray-400">No commands found.</p>
          )}
        </div>
      </div>
    </div>
  );
};