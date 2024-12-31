import { Pinecone, type RecordMetadata, type QueryResponse, Index } from '@pinecone-database/pinecone';

/**
 * Singleton Pinecone client instance
 */
let pineconeInstance: Pinecone | null = null;

/**
 * Gets or initializes the Pinecone client
 * @returns Initialized Pinecone client
 */
function getPineconeClient(): Pinecone {
  if (!pineconeInstance) {
    console.log('[Pinecone] Initializing Pinecone client');
    pineconeInstance = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || ''
    });
  }
  return pineconeInstance;
}

// Constants
const INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'data-index';
const VECTOR_DIMENSION = 3072; // OpenAI text-embedding-3-large dimension
const EMBEDDING_MODEL = 'text-embedding-3-large';

/**
 * Topic information
 */
export interface TopicInfo {
  name: string;
  relevance: number;
  context?: string;
}

/**
 * Metadata for vector records
 */
export interface VectorMetadata extends RecordMetadata {
  /** Unique video identifier */
  videoId: string;
  /** URL of the video */
  videoUrl: string;
  /** When the chunk was created */
  timestamp: string;
  /** Position in chunk sequence */
  sequenceNumber: number;
  /** Total chunks for this video */
  totalChunks: number;
  /** Type of content */
  contentType: string;
  /** Section title */
  sectionTitle: string;
  /** Video title */
  title: string;
  /** Video summary */
  summary: string;
  /** Visual content analysis */
  visualContent: string;
  /** Audio content analysis */
  audioContent: string;
  /** Topics discussed */
  topics: string;
  /** Search keywords */
  keywords: string[];
  /** Instagram media type */
  mediaType: string;
  /** Instagram ID */
  instaId: string;
  /** Instagram username */
  username: string;
  /** User's display name */
  name: string;
  /** When video was processed */
  processedAt: string;
  /** Combined searchable text */
  searchableText: string;
}

/**
 * Item for upserting into Pinecone
 */
interface UpsertItem {
  /** Unique identifier */
  id: string;
  /** Text content */
  description: string;
  /** Video URL */
  url: string;
  /** Vector embedding */
  vector: number[];
  /** Associated metadata */
  metadata: VectorMetadata;
}

/**
 * Verifies index configuration
 * @returns Promise resolving to verification result
 */
export async function verifyIndexConfiguration(): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[Pinecone] Verifying index configuration...');
    const client = getPineconeClient();
    const indexDescription = await client.describeIndex(INDEX_NAME);
    
    if (!indexDescription.dimension) {
      const error = new Error(
        `Pinecone index "${INDEX_NAME}" not found or missing dimension configuration.`
      );
      console.error('[Pinecone] Configuration error:', error.message);
      return { success: false, error: error.message };
    }

    if (indexDescription.dimension !== VECTOR_DIMENSION) {
      const error = new Error(
        `Pinecone index "${INDEX_NAME}" has incorrect dimension. Expected: ${VECTOR_DIMENSION}, Found: ${indexDescription.dimension}`
      );
      console.error('[Pinecone] Configuration error:', error.message);
      return { success: false, error: error.message };
    }
    
    console.log('[Pinecone] Index configuration verified successfully:', {
      name: INDEX_NAME,
      dimension: indexDescription.dimension,
      model: EMBEDDING_MODEL
    });

    return { success: true };
  } catch (error) {
    console.error('[Pinecone] Error verifying index:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// Run verification on module load
verifyIndexConfiguration().catch(console.error);

/**
 * Upserts vectors for a specific user into their namespace
 * @param userId - User namespace
 * @param items - Items to upsert
 */
export async function upsertUserData(userId: string, items: UpsertItem[]): Promise<void> {
  console.log('[Pinecone] Starting upsert for user:', userId, 'with', items.length, 'items');
  
  const records = items.map((item) => ({
    id: item.id,
    values: item.vector,
    metadata: item.metadata
  }));

  console.log('[Pinecone] Created vector records with metadata');
  console.log('[Pinecone] Sample metadata:', records[0].metadata);
  
  const client = getPineconeClient();
  const index = client.index<VectorMetadata>(INDEX_NAME);
  const namespaceIndex = index.namespace(userId);
  
  try {
    await namespaceIndex.upsert(records);
    console.log('[Pinecone] Successfully upserted vectors for user:', userId);
  } catch (error) {
    console.error('[Pinecone] Error upserting vectors:', error);
    throw error;
  }
}

/**
 * Get index statistics
 * @returns Promise resolving to index statistics
 */
export async function getIndexStats() {
  console.log('[Pinecone] Getting index statistics');
  const client = getPineconeClient();
  const index = client.index<VectorMetadata>(INDEX_NAME);
  const stats = await index.describeIndexStats();
  console.log('[Pinecone] Index statistics:', stats);
  return stats;
}

/**
 * Query user data from Pinecone
 */
export async function queryUserData(
  userNS: string,
  queryVector: number[],
  topK: number,
  options: {
    filter?: Record<string, any>;
  } = {}
): Promise<QueryResponse<VectorMetadata>> {
  const index = await getIndex();
  
  console.log('[Pinecone] Querying data for user:', userNS);
  console.log('[Pinecone] Query options:', {
    topK,
    filter: options.filter
  });
  
  const queryOptions = {
    vector: queryVector,
    topK,
    includeMetadata: true,
    filter: options.filter
  };

  // Query within the user's namespace
  const namespaceIndex = index.namespace(userNS);
  const response = await namespaceIndex.query(queryOptions);
  
  console.log(`[Pinecone] Query returned ${response.matches?.length || 0} matches`);
  if (response.matches?.length) {
    console.log('[Pinecone] Top match:', {
      score: response.matches[0].score,
      metadata: response.matches[0].metadata
    });
  }
  
  return response as QueryResponse<VectorMetadata>;
}

/**
 * Checks if a video has already been processed for a user
 */
export async function isVideoAlreadyProcessed(userId: string, videoUrl: string): Promise<boolean> {
  console.log(`[Pinecone] Checking if video already processed for user: ${userId}, URL: ${videoUrl}`);
  
  const client = getPineconeClient();
  const index = client.index<VectorMetadata>(INDEX_NAME);
  const namespaceIndex = index.namespace(userId);
  
  try {
    // Clean the URL by trimming whitespace
    const cleanUrl = videoUrl.trim();
    
    // Query by exact URL match using metadata filter only
    const response = await namespaceIndex.query({
      vector: new Array(VECTOR_DIMENSION).fill(0), // Dummy vector since we're only using filter
      topK: 1,
      includeMetadata: true,
      filter: {
        videoUrl: cleanUrl
      }
    });

    const exists = response.matches && response.matches.length > 0;
    
    console.log(`[Pinecone] Video ${exists ? 'found' : 'not found'} in user's namespace`);
    if (exists) {
      console.log('[Pinecone] Existing video metadata:', {
        videoId: response.matches[0].metadata?.videoId,
        timestamp: response.matches[0].metadata?.timestamp
      });
    }
    
    return exists;
  } catch (error) {
    console.error('[Pinecone] Error checking for duplicate video:', error);
    // On error, assume not processed to ensure video gets processed
    return false;
  }
}

let pineconeIndex: Index | null = null;

/**
 * Get or initialize Pinecone index
 */
async function getIndex(): Promise<Index> {
  if (pineconeIndex) return pineconeIndex;
  
  const pinecone = new Pinecone();
  pineconeIndex = pinecone.Index<VectorMetadata>(INDEX_NAME);
  
  return pineconeIndex;
} 