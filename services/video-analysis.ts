import { GeminiService } from './gemini';
import { downloadVideo } from '@/lib/video';
import { VideoAnalysis } from './gemini';
import { VectorProcessingService } from './vector-processing';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * Service for handling video analysis
 */
export class VideoAnalysisService {
  private static instance: VideoAnalysisService;
  private static instancePromise: Promise<VideoAnalysisService> | null = null;
  private geminiService!: GeminiService;
  private vectorProcessingService!: VectorProcessingService;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static async getInstance(): Promise<VideoAnalysisService> {
    if (!VideoAnalysisService.instancePromise) {
      VideoAnalysisService.instancePromise = (async () => {
        if (!VideoAnalysisService.instance) {
          const instance = new VideoAnalysisService();
          // Initialize services asynchronously
          instance.geminiService = await GeminiService.getInstance();
          instance.vectorProcessingService = await VectorProcessingService.getInstance();
          VideoAnalysisService.instance = instance;
        }
        return VideoAnalysisService.instance;
      })();
    }
    return VideoAnalysisService.instancePromise;
  }

  /**
   * Analyzes a video from a URL and stores the analysis in Pinecone
   */
  public async analyzeVideoFromUrl(
    videoUrl: string,
    metadata: {
      userId: string;
      mediaType: string;
      instaId: string;
      username: string;
      name: string;
    }
  ): Promise<VideoAnalysis> {
    try {
      console.log('[Video Analysis] Starting analysis:', {
        timestamp: new Date().toISOString(),
        videoUrl,
        userId: metadata.userId,
        status: 'downloading'
      });

      // Download video to temp directory
      const tempDir = path.join(process.cwd(), 'temp_videos');
      await fs.mkdir(tempDir, { recursive: true });
      
      const videoPath = await downloadVideo(videoUrl);
      console.log('[Video Analysis] Video downloaded to:', videoPath);

      // Analyze video
      const result = await this.geminiService.analyzeVideoWithStructuredOutput(videoPath, 'video/mp4');
      console.log('[Video Analysis] Analysis complete');

      // Store analysis in vector database
      console.log('[Video Analysis] Storing analysis in vector database');
      await this.vectorProcessingService.processVideoAnalysis({
        userId: metadata.userId,
        analysisData: result,
        videoUrl,
        metadata: {
          mediaType: metadata.mediaType,
          instaId: metadata.instaId,
          username: metadata.username,
          name: metadata.name
        }
      });
      console.log('[Video Analysis] Analysis stored in vector database');

      // Clean up temp file
      await fs.unlink(videoPath).catch(console.error);

      return result;
    } catch (error) {
      console.error('[Video Analysis] Error analyzing video:', error);
      throw error;
    }
  }
}

// Export singleton instance getter
export const getVideoAnalysisService = VideoAnalysisService.getInstance; 