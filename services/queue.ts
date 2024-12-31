import { MessageService } from './message';
import { VideoAnalysisService, getVideoAnalysisService } from './video-analysis';
import { isVideoAlreadyProcessed } from '@/lib/pinecone';
import { MESSAGES } from '@/lib/messages/constants';

interface QueueJob {
  id: string;
  userId: string;
  type: 'VIDEO_PROCESSING';
  data: any;
  attempts: number;
  maxAttempts: number;
  lastAttempt?: number;
  error?: string;
}

export class QueueService {
  private static instance: QueueService;
  private static instancePromise: Promise<QueueService> | null = null;
  private jobs: Map<string, QueueJob>;
  private processing: boolean;
  private videoAnalysisService!: VideoAnalysisService;
  private messageService!: MessageService;
  private readonly RETRY_DELAY = 5000; // 5 seconds
  private readonly MAX_ATTEMPTS = 3;

  private constructor() {
    this.jobs = new Map();
    this.processing = false;
  }

  public static async getInstance(): Promise<QueueService> {
    if (!QueueService.instancePromise) {
      QueueService.instancePromise = (async () => {
        if (!QueueService.instance) {
          const instance = new QueueService();
          await instance.initialize();
          QueueService.instance = instance;
        }
        return QueueService.instance;
      })();
    }
    return QueueService.instancePromise;
  }

  private async initialize(): Promise<void> {
    try {
      this.videoAnalysisService = await getVideoAnalysisService();
      this.messageService = await MessageService.getInstance();
      console.log('[Queue Service] Successfully initialized');
    } catch (error) {
      console.error('[Queue Service] Initialization error:', error);
      throw error;
    }
  }

  public async enqueueVideoProcessing(
    userId: string,
    videoUrl: string,
    metadata: {
      mediaType: string;
      instaId: string;
      username: string;
      name: string;
    }
  ): Promise<string> {
    try {
      // Check if video is already processed
      const isProcessed = await isVideoAlreadyProcessed(userId, videoUrl);
      if (isProcessed) {
        console.log('[Queue Service] Video already processed, skipping:', videoUrl);
        return 'Video already processed';
      }

      // Generate unique job ID
      const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create job
      const job: QueueJob = {
        id: jobId,
        userId,
        type: 'VIDEO_PROCESSING',
        data: {
          videoUrl,
          metadata
        },
        attempts: 0,
        maxAttempts: this.MAX_ATTEMPTS
      };

      // Add to queue
      this.jobs.set(jobId, job);
      console.log('[Queue Service] Enqueued job', jobId, 'for user', userId);

      // Start processing if not already running
      if (!this.processing) {
        this.processJobs();
      }

      // Send acknowledgment message
      await this.messageService.sendMessage(userId, MESSAGES.VIDEO_PROCESSING);

      return jobId;
    } catch (error) {
      console.error('[Queue Service] Error enqueueing job:', error);
      throw error;
    }
  }

  private async processJobs(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      while (this.jobs.size > 0) {
        // Get next job
        const [jobId, job] = Array.from(this.jobs.entries())[0];
        
        // Check if we should retry
        if (job.lastAttempt) {
          const timeSinceLastAttempt = Date.now() - job.lastAttempt;
          if (timeSinceLastAttempt < this.RETRY_DELAY) {
            console.log(`[Queue Service] Waiting ${this.RETRY_DELAY - timeSinceLastAttempt}ms before retry for job ${jobId}`);
            await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY - timeSinceLastAttempt));
          }
        }

        console.log('[Queue Service] Processing job', jobId);
        
        try {
          // Check if video is already processed before each attempt
          const isProcessed = await isVideoAlreadyProcessed(job.userId, job.data.videoUrl);
          if (isProcessed) {
            console.log('[Queue Service] Video already processed during retry, removing job:', jobId);
            this.jobs.delete(jobId);
            continue;
          }

          // Process video
          await this.videoAnalysisService.analyzeVideoFromUrl(
            job.data.videoUrl,
            {
              userId: job.userId,
              ...job.data.metadata
            }
          );

          // Job completed successfully
          console.log('[Queue Service] Job completed successfully:', jobId);
          this.jobs.delete(jobId);
        } catch (error) {
          console.error('[Queue Service] Error processing job:', jobId, error);
          
          // Update job attempts
          job.attempts++;
          job.lastAttempt = Date.now();
          job.error = error instanceof Error ? error.message : String(error);

          if (job.attempts >= job.maxAttempts) {
            console.log('[Queue Service] Job failed after max attempts:', jobId);
            // Send error message to user
            await this.messageService.sendMessage(
              job.userId,
              MESSAGES.VIDEO_PROCESSING_ERROR
            );
            this.jobs.delete(jobId);
          } else {
            console.log(`[Queue Service] Retrying job ${jobId} (attempt ${job.attempts}/${job.maxAttempts})`);
            this.jobs.set(jobId, job);
          }
        }
      }
    } finally {
      this.processing = false;
    }
  }
} 