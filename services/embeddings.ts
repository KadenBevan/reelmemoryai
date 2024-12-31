import OpenAI from 'openai';

export class EmbeddingService {
  private static instance: EmbeddingService;
  private static instancePromise: Promise<EmbeddingService> | null = null;
  private openai: OpenAI;
  private rateLimiter: {
    requests: number;
    lastReset: number;
    maxRequests: number;
    timeWindow: number;
  };

  private constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.rateLimiter = {
      requests: 0,
      lastReset: Date.now(),
      maxRequests: 500,
      timeWindow: 60000 // 1 minute
    };
  }

  public static async getInstance(): Promise<EmbeddingService> {
    if (!EmbeddingService.instancePromise) {
      EmbeddingService.instancePromise = (async () => {
        if (!EmbeddingService.instance) {
          const instance = new EmbeddingService();
          await instance.initialize();
          EmbeddingService.instance = instance;
        }
        return EmbeddingService.instance;
      })();
    }
    return EmbeddingService.instancePromise;
  }

  private async initialize(): Promise<void> {
    try {
      // Test the embeddings API
      const testResult = await this.openai.embeddings.create({
        model: 'text-embedding-3-large',
        input: 'test'
      });
      if (!testResult?.data?.[0]?.embedding) {
        throw new Error('Failed to initialize OpenAI embeddings');
      }
      console.log('[Embedding Service] Successfully initialized');
    } catch (error) {
      console.error('[Embedding Service] Initialization error:', error);
      throw error;
    }
  }

  private checkRateLimit(): boolean {
    const now = Date.now();
    const timeElapsed = now - this.rateLimiter.lastReset;

    // Reset counter if time window has passed
    if (timeElapsed >= this.rateLimiter.timeWindow) {
      console.log('[Embedding Service] Resetting rate limit counter');
      this.rateLimiter.requests = 0;
      this.rateLimiter.lastReset = now;
    }

    console.log('[Embedding Service] Rate limit check - Current requests:', this.rateLimiter.requests, 'Time window:', timeElapsed);

    return this.rateLimiter.requests < this.rateLimiter.maxRequests;
  }

  private updateRateLimit(): void {
    this.rateLimiter.requests++;
    console.log('[Embedding Service] Updated request count:', this.rateLimiter.requests);
  }

  public async generateEmbedding(text: string, maxAttempts: number = 3): Promise<number[]> {
    console.log('[Embedding Service] Starting embedding generation for text length:', text.length);

    // Check token limit (roughly 4 characters per token)
    const estimatedTokens = Math.ceil(text.length / 4);
    const MAX_TOKENS = 8191;
    console.log('[Embedding Service] Checking token limit. Count:', estimatedTokens, 'Max:', MAX_TOKENS);

    if (estimatedTokens > MAX_TOKENS) {
      throw new Error(`Text exceeds maximum token limit of ${MAX_TOKENS}`);
    }

    let attempt = 1;
    let lastError: Error | null = null;

    while (attempt <= maxAttempts) {
      try {
        console.log(`[Embedding Service] Generating embedding, attempt ${attempt}`);

        if (!this.checkRateLimit()) {
          const waitTime = this.rateLimiter.timeWindow - (Date.now() - this.rateLimiter.lastReset);
          throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)} seconds`);
        }

        this.updateRateLimit();
        console.log('[Embedding Service] Making API request to OpenAI');

        const response = await this.openai.embeddings.create({
          model: 'text-embedding-3-large',
          input: text
        });

        if (!response?.data?.[0]?.embedding) {
          throw new Error('Invalid response from OpenAI API');
        }

        console.log('[Embedding Service] Successfully generated embedding of length:', response.data[0].embedding.length);
        return response.data[0].embedding;
      } catch (error) {
        console.error(`[Embedding Service] Attempt ${attempt} failed:`, error);
        lastError = error as Error;

        if (attempt < maxAttempts) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
          console.log(`[Embedding Service] Retrying in ${backoffMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }

        attempt++;
      }
    }

    console.log('[Embedding Service] All attempts failed');
    throw new Error(`Failed to generate embedding after ${maxAttempts} attempts: ${lastError?.message}`);
  }
} 