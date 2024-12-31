import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';

export class GeminiService {
  private static instance: GeminiService;
  private static instancePromise: Promise<GeminiService> | null = null;
  private model: any;
  private gemini: GoogleGenerativeAI;

  private constructor() {
    if (!process.env.GOOGLE_AI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    this.gemini = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
    this.model = this.gemini.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8191
      }
    });
  }

  public static async getInstance(): Promise<GeminiService> {
    if (!GeminiService.instancePromise) {
      GeminiService.instancePromise = (async () => {
        if (!GeminiService.instance) {
          const instance = new GeminiService();
          await instance.initialize();
          GeminiService.instance = instance;
        }
        return GeminiService.instance;
      })();
    }
    return GeminiService.instancePromise;
  }

  private async initialize(): Promise<void> {
    try {
      // Test the model to ensure it's working
      const testPrompt = 'Test initialization';
      const result = await this.model.generateContent(testPrompt);
      if (!result) {
        throw new Error('Failed to initialize Gemini model');
      }
      console.log('[Gemini Service] Successfully initialized');
    } catch (error) {
      console.error('[Gemini Service] Initialization error:', error);
      throw error;
    }
  }

  public async generateResponse(prompt: string): Promise<string> {
    try {
      console.log('[Gemini Service] Generating response for prompt', prompt.substring(0, 100) + '...');
      
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8191,
        }
      });

      const response = await result.response;
      if (!response) {
        throw new Error('Empty response from Gemini');
      }

      const text = response.text();
      if (!text) {
        throw new Error('Empty response text from Gemini');
      }

      console.log('[Gemini Service] Generated response:', text);
      return text.trim();
    } catch (error) {
      console.error('[Gemini Service] Error generating response:', error);
      throw error;
    }
  }

  public async analyzeVideoWithStructuredOutput(videoPath: string): Promise<any> {
    try {
      console.log('[Gemini Service] Starting structured video analysis');
      
      // Read video file as base64
      const videoData = await fs.readFile(videoPath);
      const base64Data = videoData.toString('base64');
      const mimeType = 'video/mp4';

      // Read the analysis prompt
      const prompt = await fs.readFile('prompts/video-analysis-prompt.txt', 'utf-8');

      // Define the response schema
      const responseSchema = {
        type: "object",
        properties: {
          title: { type: "string" },
          summary: { type: "string" },
          visualContent: {
            type: "array",
            items: {
              type: "object",
              properties: {
                timestamp: { type: "string" },
                scene: { type: "string" },
                text: { type: "string" },
                instructions: { type: "string" },
                keyElements: { 
                  type: "array",
                  items: { type: "string" },
                  minItems: 1
                }
              },
              required: ["timestamp", "scene", "text", "instructions", "keyElements"]
            }
          },
          audioContent: {
            type: "array",
            items: {
              type: "object",
              properties: {
                timestamp: { type: "string" },
                speech: { type: "string" },
                music: { type: "string" },
                soundEffects: {
                  type: "array",
                  items: { type: "string" }
                },
                instructions: { type: "string" }
              },
              required: ["timestamp", "speech", "music", "soundEffects", "instructions"]
            }
          },
          topics: {
            type: "array",
            items: {
              type: "object",
              properties: {
                timestamp: { type: "string" },
                name: { type: "string" },
                relevance: { type: "number" },
                context: { type: "string" }
              },
              required: ["timestamp", "name", "relevance", "context"]
            }
          },
          technicalDetails: {
            type: "array",
            items: {
              type: "object",
              properties: {
                timestamp: { type: "string" },
                quality: { type: "string" },
                effects: {
                  type: "array",
                  items: { type: "string" }
                },
                editing: { type: "string" }
              },
              required: ["timestamp", "quality", "effects", "editing"]
            }
          },
          searchableKeywords: {
            type: "array",
            items: { type: "string" },
            minItems: 3
          }
        },
        required: ["title", "summary", "visualContent", "audioContent", "topics", "technicalDetails", "searchableKeywords"]
      };

      // Create the request for Gemini with structured output configuration
      const request = {
        contents: [{
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8191,
          responseSchema: responseSchema,
          responseMimeType: "application/json"
        }
      };

      // Generate content with structured output
      const result = await this.model.generateContent(request);
      const response = await result.response;
      const text = response.text();
      
      console.log('[Gemini Service] Complete raw response:', text);
      console.log('[Gemini Service] Response object:', JSON.stringify(response, null, 2));
      console.log('[Gemini Service] Result object:', JSON.stringify(result, null, 2));
      
      try {
        // Clean any potential markdown formatting
        const cleanedText = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        const parsed = JSON.parse(cleanedText);
        
        console.log('[Gemini Service] Successfully parsed response structure:', {
          hasTitle: !!parsed.title,
          hasSummary: !!parsed.summary,
          visualContentCount: parsed.visualContent?.length,
          audioContentCount: parsed.audioContent?.length,
          topicsCount: parsed.topics?.length,
          technicalDetailsCount: parsed.technicalDetails?.length,
          keywordsCount: parsed.searchableKeywords?.length
        });
        return parsed;
      } catch (parseError) {
        console.error('[Gemini Service] Error parsing structured output:', parseError);
        throw new Error('Failed to parse Gemini response as JSON');
      }
    } catch (error) {
      console.error('[Gemini Service] Error analyzing video:', error);
      throw error;
    }
  }

  public async classifyQueryIntent(query: string): Promise<{ intent: 'RECALL_VIDEO' | 'INFORMATION_QUERY' }> {
    try {
      // Read the query intent prompt
      const prompt = await fs.readFile('prompts/query-intent-prompt.txt', 'utf-8');
      
      // Define the response schema with more specific structure
      const responseSchema = {
        type: "object",
        properties: {
          intent: { 
            type: "string",
            enum: ["RECALL_VIDEO", "INFORMATION_QUERY"]
          },
          confidence: { 
            type: "number",
            minimum: 0,
            maximum: 1
          },
          explanation: { type: "string" },
          entities: {
            type: "object",
            properties: {
              topics: { 
                type: "array",
                items: { type: "string" }
              },
              timeContext: { 
                type: "object",
                properties: {
                  period: { type: "string" },
                  specific: { type: "string" }
                }
              },
              attributes: { 
                type: "object",
                properties: {
                  action: { type: "string" },
                  subject: { type: "string" },
                  context: { type: "string" }
                }
              }
            },
            required: ["topics"]
          }
        },
        required: ["intent", "confidence", "explanation", "entities"]
      };

      // Generate structured response
      const parsed = await this.generateStructuredResponse(
        prompt.replace('${query}', query),
        responseSchema
      );
      
      return { intent: parsed.intent as 'RECALL_VIDEO' | 'INFORMATION_QUERY' };
    } catch (error) {
      console.error('[Gemini Service] Error classifying query intent:', error);
      return { intent: 'INFORMATION_QUERY' }; // Default to information query on error
    }
  }

  public async generateStructuredResponse(prompt: string, responseSchema: any): Promise<any> {
    try {
      console.log('[Gemini Service] Generating structured response with schema');
      
      const request = {
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8191,
          responseSchema: responseSchema,
          responseMimeType: "application/json"
        }
      };

      const result = await this.model.generateContent(request);
      const response = await result.response;
      const text = response.text();

      try {
        // Clean any potential markdown formatting
        const cleanedText = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        return JSON.parse(cleanedText);
      } catch (parseError) {
        console.error('[Gemini Service] Error parsing structured response:', parseError);
        throw new Error('Failed to parse structured response');
      }
    } catch (error) {
      console.error('[Gemini Service] Error generating structured response:', error);
      throw error;
    }
  }
} 