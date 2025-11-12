
import React from 'react';
import { AppMode } from '../types';
import { ChatIcon, ImageIcon, VideoIcon, WaveformIcon, EyeIcon, SparklesIcon, TextToSpeechIcon, CommandLineIcon, DocumentTextIcon, ChartBarIcon } from './Icons';

interface ModeSelectorProps {
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

const modes = [
  { id: AppMode.CHAT, label: 'Chat', icon: ChatIcon },
  { id: AppMode.VISION, label: 'Vision', icon: EyeIcon },
  { id: AppMode.LIVE, label: 'Live', icon: WaveformIcon },
  { id: AppMode.IMAGE, label: 'Image Gen', icon: ImageIcon },
  { id: AppMode.EDIT_IMAGE, label: 'Image Edit', icon: SparklesIcon },
  { id: AppMode.VIDEO, label: 'Video', icon: VideoIcon },
  { id: AppMode.TTS, label: 'TTS', icon: TextToSpeechIcon },
  { id: AppMode.CODE, label: 'Code Gen', icon: CommandLineIcon },
  { id: AppMode.SUMMARIZE, label: 'Summarize', icon: DocumentTextIcon },
  { id: AppMode.DATA_ANALYSIS, label: 'Data', icon: ChartBarIcon },
];

export const ModeSelector: React.FC<ModeSelectorProps> = ({ currentMode, onModeChange }) => {
  return (
    <div className="bg-white dark:bg-gray-800 p-2 flex justify-center items-center gap-1.5 border-b border-gray-200 dark:border-gray-700 flex-wrap">
      {modes.map(mode => {
        const Icon = mode.icon;
        const isActive = currentMode === mode.id;
        return (
          <button
            key={mode.id}
            onClick={() => onModeChange(mode.id)}
            className={`flex flex-col items-center justify-center w-20 h-16 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800 focus:ring-black dark:focus:ring-white ${
              isActive ? 'bg-[var(--accent-color-600)] text-white shadow-lg' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-white'
            }`}
            aria-current={isActive ? 'page' : undefined}
            title={`Switch to ${mode.label} mode`}
          >
            <Icon className="w-6 h-6 mb-1" />
            <span className="text-xs font-semibold">{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
};