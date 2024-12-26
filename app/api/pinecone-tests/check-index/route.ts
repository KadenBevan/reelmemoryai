import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';

export async function GET(request: NextRequest): Promise<NextResponse> {
  console.log('[Check Index] Verifying index exists...');
  
  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || ''
    });

    // List all indexes
    const indexList = await pinecone.listIndexes();
    
    // Get our specific index
    const index = pinecone.index('data-index');
    const indexStats = await index.describeIndexStats();
    
    return NextResponse.json({ 
      message: 'Index verified',
      indexes: indexList,
      stats: indexStats,
      host: 'data-index-dfp3t1f.svc.gcp-us-central1-4a9f.pinecone.io',
      dimension: 3072,
      metric: 'cosine'
    }, { status: 200 });
  } catch (error) {
    console.error('[Check Index] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to check index',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 