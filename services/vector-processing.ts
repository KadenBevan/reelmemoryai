import { upsertUserData } from '@/lib/pinecone';
import { encode } from '@/lib/encoder';
import { EmbeddingService } from './embeddings';
import { VideoAnalysis } from './gemini';

/**
 * Configuration for the Vector Processing Service
 */
interface VectorProcessingConfig {
  /** Maximum tokens per chunk when splitting text */
  maxChunkTokens: number;
  /** Minimum tokens per chunk to maintain context */
  minChunkTokens: number;
  /** Overlap tokens between chunks for context continuity */
  overlapTokens: number;
}

/**
 * Metadata structure for each vector chunk
 */
interface ChunkMetadata {
  /** Original video URL this chunk is associated with */
  videoUrl: string;
  /** Instagram video ID */
  videoId: string;
  /** Timestamp when this chunk was created */
  timestamp: string;
  /** Sequence number of this chunk in the original text */
  sequenceNumber: number;
  /** Total number of chunks for this video */
  totalChunks: number;
  /** Type of content (e.g., 'video_analysis') */
  contentType: string;
  /** Section title for this chunk */
  sectionTitle: string;
  /** Topic information */
  topics: Array<{
    name: string;
    relevance: number;
  }>;
  /** Keywords for search */
  keywords: string[];
  /** Video metadata */
  videoMetadata: {
    /** Instagram media type */
    mediaType: string;
    /** Instagram user ID */
    instaId: string;
    /** Instagram username */
    username: string;
    /** User's display name */
    name: string;
    /** When the video was processed */
    processedAt: string;
  };
}

/**
 * Structure for a processed chunk with its vector
 */
interface ProcessedChunk {
  /** Unique identifier for the chunk */
  id: string;
  /** The text content of the chunk */
  content: string;
  /** Vector representation of the chunk */
  vector: number[];
  /** Associated metadata */
  metadata: ChunkMetadata;
}

/**
 * Video processing request data
 */
interface VideoProcessingRequest {
  /** User namespace */
  userId: string;
  /** Video analysis data */
  analysisData: VideoAnalysis;
  /** Video URL */
  videoUrl: string;
  /** Video metadata */
  metadata: {
    /** Instagram media type */
    mediaType: string;
    /** Instagram ID */
    instaId: string;
    /** Instagram username */
    username: string;
    /** User's display name */
    name: string;
  };
}

/**
 * Service for processing text into vectors and managing storage
 */
export class VectorProcessingService {
  private config: VectorProcessingConfig;
  private embeddingService: EmbeddingService;

  constructor(config?: Partial<VectorProcessingConfig>) {
    this.config = {
      maxChunkTokens: 512,
      minChunkTokens: 128,
      overlapTokens: 64,
      ...config
    };
    this.embeddingService = new EmbeddingService();
  }

  /**
   * Processes structured video analysis into vectors
   */
  public async processVideoAnalysis({
    userId,
    analysisData,
    videoUrl,
    metadata
  }: VideoProcessingRequest): Promise<void> {
    try {
      console.log('[Vector Processing] Processing video analysis for user:', userId);
      
      // Create semantic chunks from analysis data
      const chunks: Array<Omit<ProcessedChunk, 'vector'>> = [];
      const processedAt = new Date().toISOString();
      const baseMetadata = {
        videoId: `${userId}_video_${Date.now()}`,
        videoUrl,
        timestamp: processedAt,
        videoMetadata: {
          ...metadata,
          processedAt
        },
        processedAt
      };

      // Add title and summary as a high-level overview chunk
      const overviewChunk = {
        id: `${baseMetadata.videoId}_overview`,
        content: `Title: ${analysisData.title}\nSummary: ${analysisData.summary}`,
        metadata: {
          ...baseMetadata,
          contentType: 'video_analysis',
          sectionTitle: 'Overview',
          sequenceNumber: chunks.length + 1,
          totalChunks: 0, // Will be updated after all chunks are created
          topics: analysisData.topics || [],
          keywords: analysisData.searchableKeywords || []
        }
      };
      chunks.push(overviewChunk);

      // Process visual content with temporal context
      if (analysisData.visualContent?.length) {
        for (let i = 0; i < analysisData.visualContent.length; i++) {
          const scene = analysisData.visualContent[i];
          const prevScene = i > 0 ? analysisData.visualContent[i - 1] : null;
          const nextScene = i < analysisData.visualContent.length - 1 ? analysisData.visualContent[i + 1] : null;

          // Create content with temporal context
          const content = [
            prevScene ? `Previous (${prevScene.timestamp}): ${prevScene.scene}` : '',
            `Current (${scene.timestamp}): ${scene.scene}`,
            nextScene ? `Next (${nextScene.timestamp}): ${nextScene.scene}` : '',
            `Key Elements: ${scene.keyElements?.join(', ')}`,
          ].filter(Boolean).join('\n');

          chunks.push({
            id: `${baseMetadata.videoId}_scene_${i + 1}`,
            content,
            metadata: {
              ...baseMetadata,
              contentType: 'video_analysis',
              sectionTitle: 'Visual Content',
              sequenceNumber: chunks.length + 1,
              totalChunks: 0, // Will be updated after all chunks are created
              topics: analysisData.topics || [],
              keywords: [...(analysisData.searchableKeywords || []), ...(scene.keyElements || [])]
            }
          });
        }
      }

      // Process audio content
      if (analysisData.audioContent) {
        const audioChunk = {
          id: `${baseMetadata.videoId}_audio`,
          content: [
            `Speech: ${analysisData.audioContent.speech || 'None'}`,
            `Music: ${analysisData.audioContent.music || 'None'}`,
            `Sound Effects: ${analysisData.audioContent.soundEffects?.join(', ') || 'None'}`
          ].join('\n'),
          metadata: {
            ...baseMetadata,
            contentType: 'video_analysis',
            sectionTitle: 'Audio Content',
            sequenceNumber: chunks.length + 1,
            totalChunks: 0, // Will be updated after all chunks are created
            topics: analysisData.topics || [],
            keywords: analysisData.searchableKeywords || []
          }
        };
        chunks.push(audioChunk);
      }

      // Process topics with context
      if (analysisData.topics?.length) {
        const topicsChunk = {
          id: `${baseMetadata.videoId}_topics`,
          content: analysisData.topics.map(topic => 
            `${topic.name} (Relevance: ${topic.relevance}): ${topic.context}`
          ).join('\n'),
          metadata: {
            ...baseMetadata,
            contentType: 'video_analysis',
            sectionTitle: 'Topics',
            sequenceNumber: chunks.length + 1,
            totalChunks: 0, // Will be updated after all chunks are created
            topics: analysisData.topics,
            keywords: [
              ...(analysisData.searchableKeywords || []),
              ...analysisData.topics.map(t => t.name)
            ]
          }
        };
        chunks.push(topicsChunk);
      }

      // Update totalChunks in all chunks
      const chunksWithTotalCount = chunks.map(chunk => ({
        ...chunk,
        metadata: {
          ...chunk.metadata,
          totalChunks: chunks.length
        }
      }));

      // Generate vectors for each chunk
      console.log(`[Vector Processing] Generating vectors for ${chunksWithTotalCount.length} chunks`);
      const processedChunks = await Promise.all(
        chunksWithTotalCount.map(async chunk => ({
          ...chunk,
          vector: await this.generateVector(chunk.content)
        }))
      );

      // Store vectors in Pinecone
      await this.storeVectors(userId, processedChunks);
      console.log('[Vector Processing] Successfully processed and stored structured video analysis');
    } catch (error) {
      console.error('[Vector Processing] Error processing video analysis:', error);
      throw error;
    }
  }

  /**
   * Generates a vector embedding for a text chunk
   */
  private async generateVector(text: string): Promise<number[]> {
    try {
      console.log('[Vector Processing] Generating vector for text of length:', text.length);
      const vector = await this.embeddingService.generateEmbedding(text);
      console.log('[Vector Processing] Successfully generated vector of length:', vector.length);
      return vector;
    } catch (error) {
      console.error('[Vector Processing] Error generating vector:', error);
      throw error;
    }
  }

  /**
   * Stores processed chunks in Pinecone
   */
  private async storeVectors(userId: string, chunks: ProcessedChunk[]): Promise<void> {
    console.log(`[Vector Processing] Preparing to store ${chunks.length} vectors for user:`, userId);
    
    const items = chunks.map(chunk => ({
      id: chunk.id,
      description: chunk.content,
      url: chunk.metadata.videoUrl,
      vector: chunk.vector,
      metadata: {
        videoId: chunk.metadata.videoId,
        videoUrl: chunk.metadata.videoUrl,
        timestamp: chunk.metadata.timestamp,
        sequenceNumber: chunk.metadata.sequenceNumber,
        totalChunks: chunk.metadata.totalChunks,
        contentType: chunk.metadata.contentType,
        sectionTitle: chunk.metadata.sectionTitle,
        topicsJson: JSON.stringify(chunk.metadata.topics),
        keywords: chunk.metadata.keywords,
        mediaType: chunk.metadata.videoMetadata.mediaType,
        instaId: chunk.metadata.videoMetadata.instaId,
        username: chunk.metadata.videoMetadata.username,
        name: chunk.metadata.videoMetadata.name,
        processedAt: chunk.metadata.videoMetadata.processedAt
      }
    }));

    console.log(`[Vector Processing] Upserting ${items.length} items to Pinecone for user:`, userId);
    console.log('[Vector Processing] Sample metadata:', items[0].metadata);
    
    await upsertUserData(userId, items);
    console.log('[Vector Processing] Successfully stored vectors in Pinecone');
  }
} 