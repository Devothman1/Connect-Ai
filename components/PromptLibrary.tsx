
import React, { useState } from 'react';

interface Prompt {
  title: string;
  prompt: string;
  category: string;
}

const prompts: Prompt[] = [
  // Productivity
  { title: 'Summarize Text', prompt: 'Summarize the following text into 3 key bullet points:\n\n[PASTE TEXT HERE]', category: 'Productivity' },
  { title: 'Email Writer', prompt: 'Write a professional email to [RECIPIENT] about [SUBJECT]. The tone should be [TONE] and the key points to include are:\n\n- \n- \n-', category: 'Productivity' },
  { title: 'Meeting Agenda', prompt: 'Create a meeting agenda for a 1-hour meeting about [TOPIC]. Include time slots, topics, and speakers.', category: 'Productivity' },
  // Creativity
  { title: 'Brainstorm Ideas', prompt: 'Brainstorm 10 creative ideas for a new marketing campaign for a [PRODUCT/SERVICE].', category: 'Creativity' },
  { title: 'Write a Story', prompt: 'Write a short story (around 300 words) in the [GENRE] genre. The story should be about a [PROTAGONIST] who discovers a [MYSTERIOUS_OBJECT].', category: 'Creativity' },
  { title: 'Song Lyrics', prompt: 'Write lyrics for a song about [THEME]. The mood should be [MOOD] and the style similar to [ARTIST].', category: 'Creativity' },
  // Business
  { title: 'SWOT Analysis', prompt: 'Conduct a SWOT analysis (Strengths, Weaknesses, Opportunities, Threats) for a company like [COMPANY] in the [INDUSTRY] industry.', category: 'Business' },
  { title: 'Elevator Pitch', prompt: 'Craft a 30-second elevator pitch for a startup that [DESCRIBE_STARTUP_IDEA].', category: 'Business' },
  // Fun
  { title: 'Travel Itinerary', prompt: 'Create a 3-day travel itinerary for a trip to [CITY]. The traveler is interested in [INTERESTS].', category: 'Fun' },
  { title: 'Recipe Generator', prompt: 'Give me a recipe for [DISH] that includes [INGREDIENT_1] and [INGREDIENT_2].', category: 'Fun' },
];

const categories = [...new Set(prompts.map(p => p.category))];

interface PromptLibraryProps {
    onSelectPrompt: (prompt: string) => void;
}

export const PromptLibrary: React.FC<PromptLibraryProps> = ({ onSelectPrompt }) => {
  return (
    <div className="flex-1 overflow-y-auto space-y-4 pr-2 -mr-2">
      {categories.map(category => (
        <div key={category}>
          <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">{category}</h4>
          <div className="space-y-2">
            {prompts.filter(p => p.category === category).map(prompt => (
              <button 
                key={prompt.title}
                onClick={() => onSelectPrompt(prompt.prompt)}
                className="w-full text-left p-3 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-color-500)]"
                title="Use this prompt"
              >
                <p className="text-sm font-medium text-gray-900 dark:text-white">{prompt.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">{prompt.prompt}</p>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};