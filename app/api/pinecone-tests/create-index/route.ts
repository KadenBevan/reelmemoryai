import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';

export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log('[CreateIndex] Starting index creation...');
  
  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || ''
    });

    // Check if index already exists
    const indexList = await pinecone.listIndexes();
    console.log('Current indexes:', indexList);

    // In v4, indexes are in indexList.indexes array
    if (indexList.indexes?.find(index => index.name === 'data-index')) {
      return NextResponse.json({ 
        message: 'Index already exists',
        indexes: indexList.indexes 
      }, { status: 200 });
    }

    // Create new index
    await pinecone.createIndex({
      name: 'data-index',
      dimension: 768,  // Updated to match Google AI embedding-001
      metric: 'cosine',
      spec: {
        serverless: {
          cloud: 'gcp',
          region: 'us-central1'
        }
      }
    });

    console.log('[CreateIndex] Index creation initiated');

    return NextResponse.json({ 
      message: 'Index creation started',
      name: 'data-index',
      dimension: 768,
      metric: 'cosine',
      cloud: 'gcp',
      region: 'us-central1'
    }, { status: 200 });
  } catch (error) {
    console.error('[CreateIndex] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to create index',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 