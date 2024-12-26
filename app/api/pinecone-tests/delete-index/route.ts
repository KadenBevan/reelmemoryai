import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  console.log('[DeleteIndex] Deleting index...');
  
  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || ''
    });

    await pinecone.deleteIndex('data-index');
    
    return NextResponse.json({ 
      message: 'Index deleted successfully'
    }, { status: 200 });
  } catch (error) {
    console.error('[DeleteIndex] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to delete index',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 