import OpenAI from 'openai';
import { getTokenCount } from '@/lib/encoder';

/**
 * Configuration for rate limiting and token management
 */
interface RateLimitConfig {
  /** Maximum requests per minute */
  maxRequestsPerMinute: number;
  /** Maximum tokens per request */
  maxTokensPerRequest: number;
  /** Cool down period in ms when rate limit is hit */
  coolDownPeriod: number;
}

/**
 * Service for generating embeddings using OpenAI's API
 */
export class EmbeddingService {
  private openai: OpenAI;
  private readonly model = 'text-embedding-3-large';
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second
  private requestCount = 0;
  private lastRequestTime = Date.now();
  private readonly rateLimitConfig: RateLimitConfig = {
    maxRequestsPerMinute: 150, // OpenAI's default rate limit
    maxTokensPerRequest: 8191, // OpenAI's token limit
    coolDownPeriod: 60000 // 1 minute
  };

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set in environment variables');
    }

    this.openai = new OpenAI({
      apiKey: apiKey
    });
  }

  /**
   * Checks if the text exceeds token limits
   * @param text - The text to check
   * @throws Error if token limit is exceeded
   */
  private async checkTokenLimit(text: string): Promise<void> {
    try {
      const tokenCount = await getTokenCount(text);
      console.log('[Embedding Service] Checking token limit. Count:', tokenCount, 'Max:', this.rateLimitConfig.maxTokensPerRequest);
      
      if (tokenCount > this.rateLimitConfig.maxTokensPerRequest) {
        console.error('[Embedding Service] Token limit exceeded:', tokenCount);
        throw new Error(
          `Text exceeds token limit of ${this.rateLimitConfig.maxTokensPerRequest} tokens. ` +
          `Current count: ${tokenCount}`
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('token limit')) {
        throw error;
      }
      console.warn('[Embedding Service] Token count check failed, proceeding with request:', error);
    }
  }

  /**
   * Handles rate limiting for API requests
   * @throws Error if rate limit is exceeded
   */
  private async handleRateLimit(): Promise<void> {
    const now = Date.now();
    const timeWindow = now - this.lastRequestTime;
    console.log('[Embedding Service] Rate limit check - Current requests:', this.requestCount, 'Time window:', timeWindow);

    // Reset counter if we're in a new time window
    if (timeWindow >= this.rateLimitConfig.coolDownPeriod) {
      console.log('[Embedding Service] Resetting rate limit counter');
      this.requestCount = 0;
      this.lastRequestTime = now;
    }

    // Check if we've exceeded the rate limit
    if (this.requestCount >= this.rateLimitConfig.maxRequestsPerMinute) {
      const waitTime = this.rateLimitConfig.coolDownPeriod - timeWindow;
      console.log(`[Embedding Service] Rate limit reached, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.lastRequestTime = Date.now();
    }

    this.requestCount++;
    console.log('[Embedding Service] Updated request count:', this.requestCount);
  }

  /**
   * Generates an embedding vector for the given text
   * @param text - The text to generate an embedding for
   * @returns A vector of numbers representing the embedding
   */
  public async generateEmbedding(text: string): Promise<number[]> {
    console.log('[Embedding Service] Starting embedding generation for text length:', text.length);
    
    // Check token limit before making the request
    await this.checkTokenLimit(text);

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`[Embedding Service] Generating embedding, attempt ${attempt}`);
        
        // Handle rate limiting
        await this.handleRateLimit();

        console.log('[Embedding Service] Making API request to OpenAI');
        const response = await this.openai.embeddings.create({
          model: this.model,
          input: text,
          encoding_format: 'float'
        });

        console.log('[Embedding Service] Successfully generated embedding of length:', response.data[0].embedding.length);
        return response.data[0].embedding;
      } catch (error) {
        lastError = error as Error;
        console.error(`[Embedding Service] Attempt ${attempt} failed:`, error);
        
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * attempt;
          console.log(`[Embedding Service] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error('[Embedding Service] All attempts failed');
    throw new Error(`Failed to generate embedding after ${this.maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Generates embeddings for multiple texts in parallel, respecting rate limits
   * @param texts - Array of texts to generate embeddings for
   * @returns Array of embedding vectors
   */
  public async generateEmbeddings(texts: string[]): Promise<number[][]> {
    console.log(`[Embedding Service] Generating embeddings for ${texts.length} texts`);
    
    // Process in batches to respect rate limits
    const batchSize = Math.floor(this.rateLimitConfig.maxRequestsPerMinute / 2); // Conservative batch size
    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      console.log(`[Embedding Service] Processing batch ${i / batchSize + 1}`);

      const batchEmbeddings = await Promise.all(
        batch.map(text => this.generateEmbedding(text))
      );

      embeddings.push(...batchEmbeddings);

      // If there are more batches, wait before processing the next one
      if (i + batchSize < texts.length) {
        console.log('[Embedding Service] Waiting between batches...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('[Embedding Service] Successfully generated all embeddings');
    return embeddings;
  }
} 