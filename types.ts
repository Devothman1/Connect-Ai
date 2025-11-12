
export enum AppMode {
  CHAT = 'chat',
  LIVE = 'live',
  IMAGE = 'image',
  VIDEO = 'video',
  VISION = 'vision',
  EDIT_IMAGE = 'edit_image',
  TTS = 'tts',
  CODE = 'code',
  SUMMARIZE = 'summarize',
  DATA_ANALYSIS = 'data_analysis',
}

export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system',
  TOOL = 'tool',
}

export interface GroundingSource {
  uri: string;
  title: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  imageUrls?: string[];
  groundingSources?: GroundingSource[];
}

export interface TranscriptionMessage {
  id:string;
  role: MessageRole;
  text: string;
  isFinal: boolean;
}

export enum HarmCategory {
  HARM_CATEGORY_HARASSMENT = 'HARM_CATEGORY_HARASSMENT',
  HARM_CATEGORY_HATE_SPEECH = 'HARM_CATEGORY_HATE_SPEECH',
  HARM_CATEGORY_SEXUALLY_EXPLICIT = 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  HARM_CATEGORY_DANGEROUS_CONTENT = 'HARM_CATEGORY_DANGEROUS_CONTENT',
}

export enum HarmBlockThreshold {
  BLOCK_NONE = 'BLOCK_NONE',
  BLOCK_ONLY_HIGH = 'BLOCK_ONLY_HIGH',
  BLOCK_MEDIUM_AND_ABOVE = 'BLOCK_MEDIUM_AND_ABOVE',
  BLOCK_LOW_AND_ABOVE = 'BLOCK_LOW_AND_ABOVE',
  HARM_BLOCK_THRESHOLD_UNSPECIFIED = 'HARM_BLOCK_THRESHOLD_UNSPECIFIED',
}

export interface SafetySetting {
  category: HarmCategory;
  threshold: HarmBlockThreshold;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  systemPrompt: string;
  temperature?: number;
  topK?: number;
  topP?: number;
  safetySettings?: SafetySetting[];
  maxOutputTokens?: number;
  stopSequences?: string[];
  useGoogleSearch?: boolean;
  pinned?: boolean;
  model: string;
}

export interface Folder {
  id: string;
  name: string;
  chatIds: string[];
  isOpen: boolean;
}