import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import * as fs from 'node:fs/promises';

export enum AnalysisMode {
  STRUCTURED = 'STRUCTURED'
}

const MODEL_NAME = "gemini-2.0-flash-exp";

const GENERATION_CONFIG = {
  temperature: 0.7,
  topP: 0.8,
  topK: 40,
  maxOutputTokens: 8192,
};

export interface VideoAnalysis {
  title: string;
  summary: string;
  visualContent: Array<{
    timestamp: string;
    scene: string;
    keyElements: string[];
  }>;
  audioContent: {
    speech: string;
    music: string;
    soundEffects: string[];
  };
  topics: Array<{
    name: string;
    relevance: number;
    context: string;
  }>;
  technicalDetails: {
    quality: string;
    effects: string[];
    editing: string;
  };
  searchableKeywords: string[];
}

// Analysis prompt for structured output
const STRUCTURED_ANALYSIS_PROMPT = await fs.readFile('./prompts/paragraph-prompt.txt', 'utf8');

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private fileManager: GoogleAIFileManager;
  private apiKey: string;
  private readonly MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB in bytes (Gemini File API limit)

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY (or GOOGLE_AI_API_KEY) is not set in environment variables');
    }

    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.fileManager = new GoogleAIFileManager(this.apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: GENERATION_CONFIG,
    });
  }

  /**
   * Analyzes a video using structured output
   */
  public async analyzeVideoWithStructuredOutput(localFilePath: string, mimeType: string): Promise<VideoAnalysis> {
    try {
      console.log('[Gemini Service] Starting structured video analysis');

      // Check file size
      const stats = await fs.stat(localFilePath);
      if (stats.size > this.MAX_FILE_SIZE) {
        throw new Error(`File size (${stats.size} bytes) exceeds maximum allowed size (${this.MAX_FILE_SIZE} bytes)`);
      }

      // Upload file to Gemini
      console.log('[Gemini Service] Uploading file to Gemini');
      const uploadedFile = await this.uploadToGemini(localFilePath, mimeType);
      await this.waitForFilesActive([uploadedFile]);
      console.log('[Gemini Service] File uploaded and active');

      // Start chat session with the uploaded file
      const chatSession = this.model.startChat({
        history: [
          {
            role: "user",
            parts: [
              {
                fileData: {
                  mimeType: uploadedFile.mimeType,
                  fileUri: uploadedFile.uri,
                },
              },
            ],
          },
        ],
      });

      // Send analysis prompt
      console.log('[Gemini Service] Sending analysis prompt');
      const result = await chatSession.sendMessage(STRUCTURED_ANALYSIS_PROMPT);
      const response = await result.response;
      
      try {
        // Extract JSON from markdown code block if present
        const text = response.text();
        const jsonMatch = text.match(/```json\s*(\{[\s\S]*\})\s*```/) || text.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
          console.error('[Gemini Service] No JSON found in response:', text);
          throw new Error('No JSON found in Gemini response');
        }

        const jsonStr = jsonMatch[1] || jsonMatch[0];
        const structuredResponse = JSON.parse(jsonStr) as VideoAnalysis;
        console.log('[Gemini Service] Analysis output:', JSON.stringify(structuredResponse, null, 2));
        console.log('[Gemini Service] Successfully generated structured analysis');
        return structuredResponse;
      } catch (error) {
        console.error('[Gemini Service] Error parsing JSON response:', error);
        throw new Error('Failed to parse structured response from Gemini');
      }
    } catch (error: any) {
      console.error('[Gemini Service] Error in video analysis:', error);
      throw new Error(`Gemini API error: ${error.message}`);
    }
  }

  /**
   * Uploads a file to Gemini and returns the file object
   */
  private async uploadToGemini(path: string, mimeType: string) {
    const uploadResult = await this.fileManager.uploadFile(path, {
      mimeType,
      displayName: path,
    });
    const file = uploadResult.file;
    console.log(`[Gemini Service] Uploaded file ${file.displayName} as: ${file.name}`);
    return file;
  }

  /**
   * Waits for all files to become active
   */
  private async waitForFilesActive(files: any[]) {
    console.log("[Gemini Service] Waiting for file processing...");
    for (const name of files.map((file) => file.name)) {
      let file = await this.fileManager.getFile(name);
      let attempts = 0;
      const maxAttempts = 30;

      while (file.state === "PROCESSING" && attempts < maxAttempts) {
        process.stdout.write(".");
        await new Promise((resolve) => setTimeout(resolve, 10_000));
        file = await this.fileManager.getFile(name);
        attempts++;
      }

      if (file.state !== "ACTIVE") {
        throw Error(`File ${file.name} failed to process (state=${file.state})`);
      }
    }
    console.log("[Gemini Service] All files ready");
  }

  /**
   * Generates a text response using the Gemini model
   */
  public async generateResponse(prompt: string): Promise<string> {
    try {
      console.log('[Gemini Service] Generating response for prompt length:', prompt.length);

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      console.log('[Gemini Service] Successfully generated response of length:', text.length);
      return text;
    } catch (error: any) {
      console.error('[Gemini Service] Error generating response:', error);
      throw new Error(`Gemini API error: ${error.message}`);
    }
  }
} 