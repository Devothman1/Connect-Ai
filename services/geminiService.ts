// FIX: The types `VideosOperation` and `LiveSession` are not exported from the library.
// They have been removed from the import and their usages replaced with `any`.
import { GoogleGenAI, Chat, Content, Part, Tool, GenerateContentResponse, GenerateImagesResponse, Modality } from "@google/genai";
import { ChatMessage, MessageRole, SafetySetting } from "../types";

// Helper function to get the AI client and ensure API key is set
const getAiClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new Error("Gemini API key is not configured. Please ensure the API_KEY environment variable is set.");
    }
    return new GoogleGenAI({ apiKey });
};

const defaultSystemInstruction = 'You are a helpful and friendly AI assistant named Connect Ai. Your goal is to provide accurate and concise information. Format your responses using Markdown for better readability, including code blocks for code snippets. If you are asked "who made you?", "who created you?", or any similar question about your origin, you must say that you were created by a Moroccan developer named Othman&leo, an African technology team. You must provide their contact email: othmanalif10@gmail.com. You cannot create images, videos, or audio. If a user asks you to generate any media, you must politely inform them that you are a text-based AI and do not have this capability. You must not say that you were created by Google or that you are based on Gemini.';

// Function to convert base64 to a GenerativePart
function fileToGenerativePart(base64: string, mimeType: string) {
  return {
    inlineData: {
      data: base64,
      mimeType
    },
  };
}


export const initializeChat = (
  model: string = 'gemini-2.5-flash', 
  systemPrompt?: string, 
  history: ChatMessage[] = [], 
  temperature: number = 0.7, 
  useGoogleSearch: boolean = false,
  topK?: number,
  topP?: number,
  safetySettings?: SafetySetting[],
  maxOutputTokens?: number,
  stopSequences?: string[]
): Chat => {
  const ai = getAiClient();

  const instruction = systemPrompt || defaultSystemInstruction;
  
  // Convert our ChatMessage array to the format expected by the API
  const apiHistory: Content[] = history.map(msg => ({
    role: msg.role,
    parts: [{ text: msg.content }], // Note: This simplified history doesn't include images from past turns
  }));

  const tools: Tool[] = [];
  if (useGoogleSearch) {
    tools.push({ googleSearch: {} });
  }

  return ai.chats.create({
    model,
    config: {
      systemInstruction: instruction,
      temperature,
      topK,
      topP,
      safetySettings,
      maxOutputTokens,
      stopSequences: stopSequences && stopSequences.length > 0 ? stopSequences : undefined,
      tools: tools.length > 0 ? tools : undefined,
    },
    history: apiHistory,
  });
};

export const streamResponse = async (chat: Chat, prompt: string, images?: Array<{ data: string, type: string }>, signal?: AbortSignal): Promise<AsyncGenerator<GenerateContentResponse>> => {
  try {
    if (signal?.aborted) {
      console.log("Stream generation aborted before starting.");
      return (async function* () {})();
    }

    const parts: Part[] = [{ text: prompt }];

    if (images && images.length > 0) {
      const imageParts = images.map(img => fileToGenerativePart(img.data, img.type));
      // The Gemini API expects the image part(s) before the text part for multimodal queries.
      parts.unshift(...imageParts);
    }
    
    // FIX: The `signal` property is not supported in sendMessageStream parameters.
    // It has been removed to fix a TypeScript error. A wrapper is used below
    // to preserve the stop-generating functionality from the UI perspective.
    const stream = await chat.sendMessageStream({
      message: parts,
    });

    // This wrapper allows us to check for abort signals between chunks.
    // It doesn't cancel the underlying network request but allows the UI to stop waiting.
    async function* wrappedStream(): AsyncGenerator<GenerateContentResponse> {
        for await (const chunk of stream) {
            if (signal?.aborted) {
                console.log("Stream generation aborted by user.");
                break;
            }
            yield chunk;
        }
    }

    return wrappedStream();

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log("Stream generation aborted by user.");
      // Return a generator that yields nothing
      return (async function* () {})();
    }
    console.error("Error streaming response from Gemini:", error);
    throw new Error("Failed to get response from AI. Please check your API key and network connection.");
  }
};

// --- Image Generation ---
export const generateImages = async (prompt: string, numberOfImages: number, aspectRatio: string): Promise<GenerateImagesResponse> => {
    const ai = getAiClient();
    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages,
                outputMimeType: 'image/jpeg',
                aspectRatio,
            },
        });
        return response;
    } catch (error) {
        console.error("Error generating images:", error);
        throw new Error("Failed to generate images. Please check your prompt and API key.");
    }
};

// --- Image Editing ---
export const editImage = async (prompt: string, image: { data: string, type: string }): Promise<string> => {
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    fileToGenerativePart(image.data, image.type),
                    { text: prompt },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
        if (imagePart && imagePart.inlineData) {
            return imagePart.inlineData.data;
        } else {
            throw new Error("No image was generated in the response.");
        }
    } catch (error) {
        console.error("Error editing image:", error);
        throw new Error("Failed to edit image. Please check your prompt, image, and API key.");
    }
};


// --- Video Generation ---
// FIX: A required parameter cannot follow an optional parameter. Reordered parameters.
export const generateVideos = async (prompt: string, config: any, image?: { data: string; type: string; }): Promise<any> => {
    const ai = getAiClient();
    try {
        let imagePayload;
        if (image) {
            imagePayload = {
                imageBytes: image.data,
                mimeType: image.type,
            };
        }
        
        const operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt,
            image: imagePayload,
            config,
        });
        return operation;
    } catch (error) {
        console.error("Error starting video generation:", error);
        // Let the original error propagate to be handled by the component.
        throw error;
    }
};

export const getVideosOperation = async (operation: any): Promise<any> => {
    const ai = getAiClient();
    try {
        const updatedOperation = await ai.operations.getVideosOperation({ operation });
        return updatedOperation;
    } catch (error) {
        console.error("Error polling video operation:", error);
        throw new Error("Failed to get video generation status.");
    }
};


// --- Live Chat ---
export const liveConnect = (callbacks: any, config: any): Promise<any> => {
    const ai = getAiClient();
    return ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks,
        config,
    });
};

// --- Text-to-Speech ---
export const generateSpeech = async (text: string, voice: string): Promise<string> => {
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts',
            contents: [{ parts: [{ text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voice },
                    },
                },
            },
        });
        const audioPart = response.candidates?.[0]?.content?.parts?.[0];
        if (audioPart && audioPart.inlineData) {
            return audioPart.inlineData.data;
        } else {
            throw new Error("No audio was generated in the response.");
        }
    } catch (error) {
        console.error("Error generating speech:", error);
        throw new Error("Failed to generate speech. Please check your text and API key.");
    }
};