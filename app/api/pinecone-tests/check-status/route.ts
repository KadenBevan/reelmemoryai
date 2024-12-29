import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';

export async function GET(request: NextRequest): Promise<NextResponse> {
  console.log('[CheckStatus] Checking index status...');
  
  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || ''
    });

    // Get direct index description
    const indexDescription = await pinecone.describeIndex('data-index');
    console.log('[CheckStatus] Raw index description:', JSON.stringify(indexDescription, null, 2));

    // Get index stats
    const index = pinecone.index('data-index');
    const indexStats = await index.describeIndexStats();
    
    return NextResponse.json({ 
      message: 'Index status retrieved',
      name: 'data-index',
      status: indexDescription.status,
      host: indexDescription.host,
      dimension: indexDescription.dimension,
      metric: indexDescription.metric,
      spec: indexDescription.spec,
      stats: indexStats,
      rawDescription: indexDescription // Include raw description for debugging
    }, { status: 200 });
  } catch (error) {
    console.error('[CheckStatus] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to check index status',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 