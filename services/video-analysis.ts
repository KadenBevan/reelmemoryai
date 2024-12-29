import { GeminiService } from './gemini';
import { downloadVideo } from '@/lib/video';
import { VideoAnalysis } from './gemini';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * Service for handling video analysis
 */
export class VideoAnalysisService {
  private geminiService: GeminiService;

  constructor() {
    this.geminiService = new GeminiService();
  }

  /**
   * Analyzes a video from a URL
   * @param videoUrl - URL of the video to analyze
   * @returns Promise resolving to the analysis result
   */
  public async analyzeVideoFromUrl(videoUrl: string): Promise<VideoAnalysis> {
    try {
      console.log('[Video Analysis] Starting analysis:', {
        timestamp: new Date().toISOString(),
        videoUrl,
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

      // Clean up temp file
      await fs.unlink(videoPath).catch(console.error);

      return result;
    } catch (error) {
      console.error('[Video Analysis] Error analyzing video:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const videoAnalysisService = new VideoAnalysisService(); 