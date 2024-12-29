import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';

export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log('[CreateIndex] Starting index creation...');
  
  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || ''
    });

    const INDEX_NAME = 'data-index';
    const VECTOR_DIMENSION = 3072;
    const EMBEDDING_MODEL = 'text-embedding-3-large';

    // Force delete existing index if it exists
    try {
      console.log('[CreateIndex] Attempting to delete existing index...');
      await pinecone.deleteIndex(INDEX_NAME);
      console.log('[CreateIndex] Existing index deleted');
      // Wait a few seconds for deletion to complete
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error) {
      console.log('[CreateIndex] No existing index to delete or deletion failed');
    }

    // Create new index with correct configuration
    console.log('[CreateIndex] Creating new index with dimension:', VECTOR_DIMENSION);
    await pinecone.createIndex({
      name: INDEX_NAME,
      dimension: VECTOR_DIMENSION,
      metric: 'cosine',
      spec: {
        serverless: {
          cloud: 'gcp',
          region: 'us-central1'
        }
      },
      waitUntilReady: true
    });

    // Wait for index to be ready
    console.log('[CreateIndex] Waiting for index to be ready...');
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      const indexDescription = await pinecone.describeIndex(INDEX_NAME);
      const status = (indexDescription as any)?.status?.state;
      console.log(`[CreateIndex] Attempt ${attempts + 1}: Status = ${status}`);
      
      if (status === 'Ready') {
        // Verify configuration
        const dimension = (indexDescription as any)?.spec?.dimension;
        const cloud = (indexDescription as any)?.spec?.serverless?.cloud;
        const region = (indexDescription as any)?.spec?.serverless?.region;
        
        console.log('[CreateIndex] Index ready with configuration:', {
          dimension,
          cloud,
          region
        });
        
        return NextResponse.json({ 
          message: 'Index created successfully',
          name: INDEX_NAME,
          status: 'Ready',
          configuration: {
            dimension,
            cloud,
            region
          }
        }, { status: 200 });
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    }

    throw new Error('Index creation timeout');
  } catch (error) {
    console.error('[CreateIndex] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to create index',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 