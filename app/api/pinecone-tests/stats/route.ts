import { NextRequest, NextResponse } from 'next/server';
import { getIndexStats } from '@/lib/pinecone';

export async function GET(request: NextRequest): Promise<NextResponse> {
  console.log('[Stats] Checking index statistics...');
  
  try {
    const stats = await getIndexStats();
    
    return NextResponse.json({ 
      message: 'Index stats retrieved',
      stats
    }, { status: 200 });
  } catch (error) {
    console.error('[Stats] Error:', error);
    return NextResponse.json({ error: 'Failed to get index stats' }, { status: 500 });
  }
} 