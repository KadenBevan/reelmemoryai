import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';

export async function GET(request: NextRequest): Promise<NextResponse> {
  console.log('[CheckStatus] Checking index status...');
  
  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || ''
    });

    const indexList = await pinecone.listIndexes();
    const dataIndex = indexList.indexes?.find(index => index.name === 'data-index');

    if (!dataIndex) {
      return NextResponse.json({ 
        error: 'Index not found',
        status: 'missing'
      }, { status: 404 });
    }

    return NextResponse.json({ 
      message: 'Index status retrieved',
      name: dataIndex.name,
      status: dataIndex.status,
      host: dataIndex.host,
      dimension: dataIndex.dimension,
      metric: dataIndex.metric,
      spec: dataIndex.spec
    }, { status: 200 });
  } catch (error) {
    console.error('[CheckStatus] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to check index status',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 