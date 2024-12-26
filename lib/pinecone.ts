import { Pinecone } from '@pinecone-database/pinecone';

// 1. Initialize the client (singleton pattern)
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || ''
});

// Get the index instance
const index = pinecone.index('data-index');

interface UpsertItem {
  id: string;
  description: string;
  url: string;
  vector: number[];
}

/**
 * Upserts vectors for a specific user into their namespace
 */
export async function upsertUserData(userId: string, items: UpsertItem[]): Promise<void> {
  console.log('[Pinecone Upsert] Starting upsert for user:', userId);
  
  const vectors = items.map((item) => ({
    id: item.id,
    values: item.vector,
    metadata: {
      description: item.description,
      url: item.url
    }
  }));

  await index.upsert({
    vectors,
    namespace: userId
  });
}

/**
 * Get index statistics
 */
export async function getIndexStats() {
  return await index.describeIndexStats();
}

/**
 * Queries vectors within a user's namespace
 */
export async function queryUserData(
  userId: string,
  queryVector: number[],
  topK: number
): Promise<any> {
  console.log('[Pinecone Query] Querying for user:', userId);
  
  return await index.query({
    vector: queryVector,
    topK,
    namespace: userId,
    includeValues: true,
    includeMetadata: true
  });
} 