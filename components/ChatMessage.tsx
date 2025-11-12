

import React, { useEffect, useRef, useState } from 'react';
import { ChatMessage, MessageRole } from '../types';
import { UserIcon, ConnectAiIcon, SpeakerIcon, StopIcon, CopyIcon, RegenerateIcon, PencilIcon, BookOpenIcon } from './Icons';

// Since we are loading marked and DOMPurify from a CDN, we need to declare them for TypeScript
declare const marked: {
  parse: (text: string) => string;
};
declare const DOMPurify: {
  sanitize: (html: string) => string;
};
declare const hljs: {
  highlightElement: (element: HTMLElement) => void;
};

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

interface ChatMessageComponentProps {
  message: ChatMessage;
  isStreaming?: boolean;
  isLastMessage: boolean;
  onPlayAudio: (text: string, messageId: string) => void;
  onStopAudio: () => void;
  onRegenerate: () => void;
  onEdit: (messageId: string, newContent: string) => void;
  currentlySpeakingMessageId: string | null;
}

export const ChatMessageComponent: React.FC<ChatMessageComponentProps> = ({ message, isStreaming = false, isLastMessage, onPlayAudio, onStopAudio, onRegenerate, onEdit, currentlySpeakingMessageId }) => {
  const isModel = message.role === MessageRole.MODEL;
  const messageRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isSpeaking = currentlySpeakingMessageId === message.id;
  const [isCopied, setIsCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);

  const containerClasses = `flex items-start gap-3 my-4 relative group ${!isModel ? 'flex-row-reverse' : ''}`;
  
  const bubbleClasses = `shadow-md p-4 max-w-xl lg:max-w-3xl prose dark:prose-invert prose-p:my-0 prose-pre:my-1 prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800/80 prose-pre:rounded-md prose-pre:p-3 prose-pre:text-sm prose-code:bg-transparent prose-code:p-0 prose-code:font-mono ${
    isModel 
    ? 'bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-tr-2xl rounded-bl-2xl rounded-br-2xl rounded-tl-md text-gray-900 dark:text-white' 
    : 'bg-gradient-to-br from-[var(--accent-color-600)] to-[var(--accent-color-500)] rounded-tl-2xl rounded-br-2xl rounded-bl-2xl rounded-tr-md text-white'
  }`;

  const iconClasses = `w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center mt-1 shadow-inner text-white ${isModel ? 'bg-gray-500 dark:bg-gray-600' : 'bg-[var(--accent-color-500)]'}`;
  
  useEffect(() => {
    if (messageRef.current && !isStreaming && !isEditing && typeof hljs !== 'undefined') {
      messageRef.current.querySelectorAll('pre').forEach((preBlock) => {
        const codeBlock = preBlock.querySelector('code');
        if (codeBlock) {
            hljs.highlightElement(codeBlock as HTMLElement);
        }

        // Avoid adding duplicate buttons
        if (preBlock.querySelector('.code-copy-button')) {
            return;
        }

        preBlock.style.position = 'relative';

        const button = document.createElement('button');
        button.className = 'code-copy-button absolute top-2 right-2 p-1.5 bg-white/50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 rounded-md hover:bg-gray-300 dark:hover:bg-gray-700/70 hover:text-gray-900 dark:hover:text-white text-xs flex items-center gap-1 backdrop-blur-sm';
        button.style.opacity = '0';
        button.style.transition = 'opacity 0.2s ease-in-out';
        
        const copyIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;
        const buttonText = document.createElement('span');
        buttonText.innerText = 'Copy';
        button.innerHTML = copyIconSVG;
        button.appendChild(buttonText);

        preBlock.onmouseenter = () => { button.style.opacity = '1'; };
        preBlock.onmouseleave = () => { button.style.opacity = '0'; };

        button.onclick = () => {
            if (codeBlock) {
                navigator.clipboard.writeText(codeBlock.innerText).then(() => {
                    buttonText.innerText = 'Copied!';
                    setTimeout(() => {
                        buttonText.innerText = 'Copy';
                    }, 2000);
                });
            }
        };
        
        preBlock.appendChild(button);
      });
    }
  }, [message.content, isStreaming, isEditing]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const handleAudioToggle = () => {
    if (isSpeaking) {
      onStopAudio();
    } else {
      onPlayAudio(message.content, message.id);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const handleSaveEdit = () => {
    if (editedContent.trim() !== message.content.trim()) {
      onEdit(message.id, editedContent.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditedContent(message.content);
    }
  };

  return (
    <div className={containerClasses}>
      <div className="relative">
        <div className={iconClasses}>
          {isModel ? <ConnectAiIcon className="w-5 h-5" /> : <UserIcon className="w-5 h-5" />}
        </div>
        {isModel && message.content && !isStreaming && (
            <button 
              onClick={handleAudioToggle}
              className="absolute -bottom-2 -right-2 p-1.5 rounded-full bg-gray-500 text-gray-100 dark:bg-gray-600 dark:text-gray-300 hover:bg-gray-600 dark:hover:bg-gray-500 transition-all opacity-0 group-hover:opacity-100"
              aria-label={isSpeaking ? "Stop reading aloud" : "Read message aloud"}
              title={isSpeaking ? "Stop reading aloud" : "Read message aloud"}
            >
              {isSpeaking ? <StopIcon className="w-4 h-4" /> : <SpeakerIcon className="w-4 h-4" />}
            </button>
        )}
      </div>
      <div className={`${bubbleClasses} flex flex-col gap-2 w-full overflow-hidden`} ref={messageRef}>
        {message.imageUrls && (
            <div className={`grid gap-2 ${message.imageUrls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {message.imageUrls.map((url, index) => (
                    <img key={index} src={url} alt={`User upload ${index + 1}`} className="rounded-lg max-w-xs lg:max-w-md max-h-80 object-contain" />
                ))}
            </div>
        )}
        
        {isEditing ? (
          <div className="not-prose">
            <textarea
              ref={textareaRef}
              value={editedContent}
              onChange={(e) => {
                setEditedContent(e.target.value)
                if (textareaRef.current) {
                  textareaRef.current.style.height = 'auto';
                  textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
                }
              }}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent text-gray-900 dark:text-white resize-none focus:outline-none max-h-80"
            />
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => { setIsEditing(false); setEditedContent(message.content); }} className="px-3 py-1 text-sm rounded-md bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500">Cancel</button>
              <button onClick={handleSaveEdit} className="px-3 py-1 text-sm font-semibold rounded-md text-white bg-[var(--accent-color-500)] hover:bg-[var(--accent-color-600)]">Save & Submit</button>
            </div>
          </div>
        ) : (
          <>
            {message.content && (
                <div dangerouslySetInnerHTML={renderMarkdown(message.content)} />
            )}
            {isStreaming && message.content.length === 0 && (
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <ConnectAiIcon className="w-5 h-5 animate-pulse" />
                <span>Thinking...</span>
              </div>
            )}
            {isStreaming && message.content.length > 0 && <span className="inline-block w-2 h-4 bg-gray-800 dark:bg-white animate-pulse ml-1" />}
            
            {message.groundingSources && message.groundingSources.length > 0 && !isStreaming && (
              <div className="mt-4 pt-3 border-t border-[var(--accent-color-500)]/30 bg-black/5 dark:bg-black/20 rounded-b-lg -m-4 p-4">
                <h4 className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                  <BookOpenIcon className="w-4 h-4" />
                  <span>Sources</span>
                </h4>
                <ol className="list-decimal list-inside text-sm space-y-1 not-prose">
                  {message.groundingSources.map((source, index) => (
                    <li key={index} className="truncate">
                      <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-gray-500 dark:text-gray-400 hover:text-[var(--accent-color-500)] transition-colors break-all">
                        {source.title || new URL(source.uri).hostname}
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        )}
      </div>

      <div className={`absolute -bottom-5 flex items-center gap-1 transition-opacity duration-200 opacity-0 group-hover:opacity-100 ${isModel ? 'left-12' : 'right-12'}`}>
        {!isStreaming && message.content && !isEditing && (
          <div className="flex items-center gap-1 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm rounded-md p-0.5 border border-gray-300 dark:border-gray-700">
            <button onClick={handleCopy} title="Copy message" className="p-1 text-gray-600 dark:text-gray-400 rounded-sm hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white">
              {isCopied ? <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-green-500 dark:text-green-400" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> : <CopyIcon />}
            </button>
            {isModel && isLastMessage && (
                <button onClick={onRegenerate} title="Regenerate response" className="p-1 text-gray-600 dark:text-gray-400 rounded-sm hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white">
                    <RegenerateIcon />
                </button>
            )}
          </div>
        )}
        {!isModel && !isStreaming && !isEditing && (
          <div className="flex items-center gap-1 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm rounded-md p-0.5 border border-gray-300 dark:border-gray-700">
            <button onClick={() => setIsEditing(true)} title="Edit message" className="p-1 text-gray-600 dark:text-gray-400 rounded-sm hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white">
              <PencilIcon />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};