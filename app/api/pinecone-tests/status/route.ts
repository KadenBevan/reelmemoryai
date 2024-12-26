import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';

export async function GET(request: NextRequest): Promise<NextResponse> {
  console.log('[Status] Checking index status...');
  
  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || ''
    });

    const index = pinecone.index('data-index');
    const stats = await index.describeIndexStats();
    
    console.log('[Status] Index stats retrieved successfully');
    return NextResponse.json({ 
      message: 'Index stats retrieved',
      stats 
    }, { status: 200 });
  } catch (error) {
    console.error('[Status] Error:', error);
    return NextResponse.json({ error: 'Failed to get index stats' }, { status: 500 });
  }
} 