import { upsertUserData } from '@/lib/pinecone';
import { TopicInfo } from '@/lib/pinecone';
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
  analysisData?: {
    title?: string;
    summary?: string;
    visualContent?: any[];
    audioContent?: Record<string, any>;
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
  metadata: {
    videoId: string;
    videoUrl: string;
    timestamp: string;
    sequenceNumber: number;
    totalChunks: number;
    contentType: string;
    sectionTitle: string;
    topics: TopicInfo[];
    keywords: string[];
    videoMetadata: {
      mediaType: string;
      instaId: string;
      username: string;
      name: string;
      processedAt: string;
      title: string;
      summary: string;
      visualContent: any[];
      audioContent: any;
      topics: TopicInfo[];
      technicalDetails: any;
      searchableKeywords: string[];
    };
  };
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

interface VisualContentItem {
  timestamp: string;
  scene: string;
  text?: string;
  keyElements?: string[];
}

/**
 * Service for processing text into vectors and managing storage
 */
export class VectorProcessingService {
  private static instance: VectorProcessingService;
  private static instancePromise: Promise<VectorProcessingService> | null = null;
  private config: VectorProcessingConfig;
  private embeddingService!: EmbeddingService;

  private constructor(config?: Partial<VectorProcessingConfig>) {
    this.config = {
      maxChunkTokens: 512,
      minChunkTokens: 128,
      overlapTokens: 64,
      ...config
    };
  }

  /**
   * Get singleton instance
   */
  public static async getInstance(config?: Partial<VectorProcessingConfig>): Promise<VectorProcessingService> {
    if (!VectorProcessingService.instancePromise) {
      VectorProcessingService.instancePromise = (async () => {
        if (!VectorProcessingService.instance) {
          const instance = new VectorProcessingService(config);
          // Initialize dependencies asynchronously
          instance.embeddingService = await EmbeddingService.getInstance();
          VectorProcessingService.instance = instance;
        } else if (config) {
          // Update existing instance's config if provided
          await VectorProcessingService.instance.updateConfig(config);
        }
        return VectorProcessingService.instance;
      })();
    }
    return VectorProcessingService.instancePromise;
  }

  /**
   * Updates the service configuration
   */
  private async updateConfig(config: Partial<VectorProcessingConfig>): Promise<void> {
    this.config = {
      ...this.config,
      ...config
    };
    console.log('[Vector Processing] Updated configuration:', this.config);
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
      
      const processedAt = new Date().toISOString();
      const videoId = `${userId}_video_${Date.now()}`;

      // Create a single comprehensive content string
      const contentSections = [
        // Overview Section
        `Title: ${analysisData.title || ''}`,
        `Summary: ${analysisData.summary || ''}`,

        // Visual Content Section
        analysisData.visualContent?.length ? [
          '\nVisual Content Analysis:',
          ...analysisData.visualContent.map((scene, index) => [
            `\nScene ${index + 1} (${scene.timestamp}):`,
            `Description: ${scene.scene}`,
            `Key Elements: ${scene.keyElements?.join(', ')}`
          ].join('\n'))
        ].join('\n') : '',

        // Audio Content Section
        analysisData.audioContent ? [
          '\nAudio Analysis:',
          `Speech: ${analysisData.audioContent.speech || 'None'}`,
          `Music: ${analysisData.audioContent.music || 'None'}`,
          `Sound Effects: ${analysisData.audioContent.soundEffects?.join(', ') || 'None'}`
        ].join('\n') : '',

        // Topics Section
        analysisData.topics?.length ? [
          '\nTopics Analysis:',
          ...analysisData.topics.map(topic => 
            `${topic.name} (Relevance: ${topic.relevance}): ${topic.context}`
          )
        ].join('\n') : '',

        // Technical Details Section
        analysisData.technicalDetails ? [
          '\nTechnical Analysis:',
          `Quality: ${analysisData.technicalDetails.quality}`,
          `Effects: ${analysisData.technicalDetails.effects?.join(', ') || 'None'}`,
          `Editing: ${analysisData.technicalDetails.editing}`
        ].join('\n') : ''
      ].filter(Boolean).join('\n\n');

      // Collect all keywords
      const allKeywords = [
        ...(analysisData.searchableKeywords || []),
        ...(analysisData.visualContent?.flatMap(scene => scene.keyElements || []) || []),
        ...(analysisData.topics?.map(t => t.name) || []),
        ...(analysisData.technicalDetails?.effects || [])
      ];

      // Create a single chunk with all information
      const comprehensiveChunk = {
        id: videoId,
        content: contentSections,
        metadata: {
          videoId,
          videoUrl,
          timestamp: processedAt,
          sequenceNumber: 1,
          totalChunks: 1,
          contentType: 'video_analysis',
          sectionTitle: 'Complete Analysis',
          topics: analysisData.topics || [],
          keywords: allKeywords,
          videoMetadata: {
            ...metadata,
            processedAt,
            title: analysisData.title || '',
            summary: analysisData.summary || '',
            visualContent: analysisData.visualContent || [],
            audioContent: analysisData.audioContent || {},
            topics: analysisData.topics || [],
            technicalDetails: analysisData.technicalDetails || {},
            searchableKeywords: allKeywords
          }
        }
      };

      // Generate vector once
      console.log('[Vector Processing] Generating vector for comprehensive analysis');
      const processedChunk = {
        ...comprehensiveChunk,
        vector: await this.generateVector(comprehensiveChunk.content)
      };

      // Store the single vector
      await this.storeVectors(userId, [processedChunk]);
      console.log('[Vector Processing] Successfully processed and stored video analysis');
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
    
    const allVectors = [];
    
    for (const chunk of chunks) {
      const baseId = chunk.id;
      const visualContent = chunk.metadata.videoMetadata.visualContent || [];
      const audioContent = chunk.metadata.videoMetadata.audioContent || {};
      const topics = chunk.metadata.videoMetadata.topics || [];
      const keywords = chunk.metadata.videoMetadata.searchableKeywords || [];

      // Main content vector with minimal metadata
      const mainVector = {
        id: baseId,
        vector: chunk.vector,
        description: chunk.content,
        url: chunk.metadata.videoUrl,
        metadata: {
          videoId: chunk.metadata.videoId,
          videoUrl: chunk.metadata.videoUrl.trim(),
          timestamp: chunk.metadata.timestamp,
          sequenceNumber: chunk.metadata.sequenceNumber,
          totalChunks: chunk.metadata.totalChunks,
          contentType: chunk.metadata.contentType,
          sectionTitle: chunk.metadata.sectionTitle,
          title: chunk.metadata.videoMetadata.title,
          summary: chunk.metadata.videoMetadata.summary,
          mediaType: chunk.metadata.videoMetadata.mediaType,
          instaId: chunk.metadata.videoMetadata.instaId,
          username: chunk.metadata.videoMetadata.username,
          name: chunk.metadata.videoMetadata.name,
          processedAt: new Date().toISOString(),
          // Reference IDs for related content
          visualContentId: `${baseId}_visual`,
          audioContentId: `${baseId}_audio`,
          topicsId: `${baseId}_topics`,
          // Essential metadata fields
          visualContent: '[]',
          audioContent: '{}',
          topics: '[]',
          keywords: keywords.slice(0, 10), // Limit keywords for main vector
          searchableText: [
            chunk.metadata.videoMetadata.title,
            chunk.metadata.videoMetadata.summary
          ].filter(Boolean).join(' ').toLowerCase()
        }
      };

      // Store full visual content in chunks to stay within size limits
      const visualChunks: any[] = [];
      let currentChunk: any[] = [];
      let currentSize = 0;

      for (const scene of visualContent) {
        const sceneJson = JSON.stringify(scene);
        if (currentSize + sceneJson.length > 35000) { // Leave buffer for other metadata
          if (currentChunk.length > 0) {
            visualChunks.push([...currentChunk]);
          }
          currentChunk = [scene];
          currentSize = sceneJson.length;
        } else {
          currentChunk.push(scene);
          currentSize += sceneJson.length;
        }
      }
      if (currentChunk.length > 0) {
        visualChunks.push(currentChunk);
      }

      // Create vectors for visual content chunks
      for (let i = 0; i < visualChunks.length; i++) {
        const chunk = visualChunks[i];
        const chunkText = chunk.map((v: VisualContentItem) => 
          `${v.timestamp} ${v.scene} ${v.text || ''} ${(v.keyElements || []).join(' ')}`
        ).join(' ');
        
        const visualVector = await this.generateVector(chunkText);
        allVectors.push({
          id: `${baseId}_visual_${i}`,
          vector: visualVector,
          description: chunkText,
          url: chunk.metadata?.videoUrl || mainVector.url,
          metadata: {
            videoId: chunk.metadata?.videoId || mainVector.metadata.videoId,
            videoUrl: (chunk.metadata?.videoUrl || mainVector.url).trim(),
            timestamp: chunk.metadata?.timestamp || mainVector.metadata.timestamp,
            sequenceNumber: i + 1,
            totalChunks: visualChunks.length,
            contentType: 'visual_content',
            sectionTitle: `Visual Analysis Part ${i + 1}`,
            title: chunk.metadata?.videoMetadata?.title || mainVector.metadata.title,
            summary: '',
            visualContent: JSON.stringify(chunk),
            audioContent: '{}',
            topics: '[]',
            keywords: [],
            mediaType: chunk.metadata?.videoMetadata?.mediaType || mainVector.metadata.mediaType,
            instaId: chunk.metadata?.videoMetadata?.instaId || mainVector.metadata.instaId,
            username: chunk.metadata?.videoMetadata?.username || mainVector.metadata.username,
            name: chunk.metadata?.videoMetadata?.name || mainVector.metadata.name,
            processedAt: new Date().toISOString(),
            parentId: baseId,
            searchableText: chunkText.toLowerCase()
          }
        });
      }

      // Audio content vector
      const audioText = `${audioContent.speech || ''} ${audioContent.instructions || ''} ${(audioContent.soundEffects || []).join(' ')}`;
      const audioVector = await this.generateVector(audioText);
      allVectors.push({
        id: `${baseId}_audio`,
        vector: audioVector,
        description: audioText,
        url: mainVector.url,
        metadata: {
          videoId: mainVector.metadata.videoId,
          videoUrl: mainVector.metadata.videoUrl,
          timestamp: mainVector.metadata.timestamp,
          sequenceNumber: 1,
          totalChunks: 1,
          contentType: 'audio_content',
          sectionTitle: 'Audio Analysis',
          title: mainVector.metadata.title,
          summary: '',
          visualContent: '[]',
          audioContent: JSON.stringify(audioContent),
          topics: '[]',
          keywords: [],
          mediaType: mainVector.metadata.mediaType,
          instaId: mainVector.metadata.instaId,
          username: mainVector.metadata.username,
          name: mainVector.metadata.name,
          processedAt: new Date().toISOString(),
          parentId: baseId,
          searchableText: audioText.toLowerCase()
        }
      });

      // Topics vector
      const topicsText = topics.map(t => `${t.name} ${t.context}`).join(' ');
      const topicsVector = await this.generateVector(topicsText);
      allVectors.push({
        id: `${baseId}_topics`,
        vector: topicsVector,
        description: topicsText,
        url: mainVector.url,
        metadata: {
          videoId: mainVector.metadata.videoId,
          videoUrl: mainVector.metadata.videoUrl,
          timestamp: mainVector.metadata.timestamp,
          sequenceNumber: 1,
          totalChunks: 1,
          contentType: 'topics',
          sectionTitle: 'Topics Analysis',
          title: mainVector.metadata.title,
          summary: '',
          visualContent: '[]',
          audioContent: '{}',
          topics: JSON.stringify(topics),
          keywords: keywords,
          mediaType: mainVector.metadata.mediaType,
          instaId: mainVector.metadata.instaId,
          username: mainVector.metadata.username,
          name: mainVector.metadata.name,
          processedAt: new Date().toISOString(),
          parentId: baseId,
          searchableText: topicsText.toLowerCase()
        }
      });

      allVectors.push(mainVector);
    }

    try {
      // Store vectors in batches
      const BATCH_SIZE = 100;
      for (let i = 0; i < allVectors.length; i += BATCH_SIZE) {
        const batch = allVectors.slice(i, i + BATCH_SIZE);
        await upsertUserData(userId, batch);
        console.log(`[Vector Processing] Stored batch ${i / BATCH_SIZE + 1} of ${Math.ceil(allVectors.length / BATCH_SIZE)}`);
      }
      
      console.log(`[Vector Processing] Successfully stored ${allVectors.length} vectors for user:`, userId);
    } catch (error) {
      console.error('[Vector Processing] Error storing vectors:', error);
      throw error;
    }
  }
} 