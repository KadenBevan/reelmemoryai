import { GoogleGenerativeAI, GenerativeModel} from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import * as fs from 'node:fs/promises';

export enum AnalysisMode {
  PARAGRAPH = 'PARAGRAPH',
  RECIPE = 'RECIPE'
}

const ANALYSIS_PROMPTS = {
  [AnalysisMode.PARAGRAPH]: await fs.readFile('prompts/paragraph-prompt.txt', 'utf8'), 
  [AnalysisMode.RECIPE]: await fs.readFile('prompts/recipe-prompt.txt', 'utf8'),
};

const MODEL_NAME = "gemini-2.0-flash-exp";

const GENERATION_CONFIG = {
  temperature: 1,
  maxOutputTokens: 8192,
  responseMimeType: "text/plain",
};


export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private fileManager: GoogleAIFileManager;
  private apiKey: string;
  private readonly MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB in bytes

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
   * Analyzes a video using the chat session approach with file upload
   */
  public async analyzeVideoWithUpload(localFilePath: string, mimeType: string, mode: AnalysisMode): Promise<string> {
    try {
      // Check if file exists and size
      const stats = await fs.stat(localFilePath);
      if (stats.size > this.MAX_FILE_SIZE) {
        throw new Error(`File size (${stats.size} bytes) exceeds maximum allowed size (${this.MAX_FILE_SIZE} bytes)`);
      }

      // 1. Upload the file to Gemini
      const uploadedFile = await this.uploadToGemini(localFilePath, mimeType);

      // 2. Wait for file to be active
      await this.waitForFilesActive([uploadedFile]);

      // 3. Start a chat session with the uploaded file
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

      // 4. Send the analysis prompt
      const result = await chatSession.sendMessage([
        "Analyze the video and generate a response based on the mode specified.",
        ANALYSIS_PROMPTS[mode]
      ]);

      return result.response.text();
    } catch (error: any) {
      console.error('Error analyzing video:', error);
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
    console.log(`Uploaded file ${file.displayName} as: ${file.name}`);
    return file;
  }

  /**
   * Waits for all files to become active
   */
  private async waitForFilesActive(files: any[]) {
    console.log("Waiting for file processing...");
    for (const name of files.map((file) => file.name)) {
      let file = await this.fileManager.getFile(name);
      let attempts = 0;
      const maxAttempts = 30; // Maximum 5 minutes of waiting (30 attempts * 10 seconds)

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
    console.log("...all files ready\n");
  }
} 