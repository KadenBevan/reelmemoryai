import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { EmbeddingService } from '@/services/embeddings';

export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log('[Query] Starting similarity search...');

  try {
    // Get the search query from request body
    const { searchQuery } = await request.json();
    if (!searchQuery) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
    }

    // Initialize services
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || ''
    });
    const embeddingService = new EmbeddingService();
    
    // Get index and namespace
    const index = pinecone.index('data-index');
    const namespace = request.nextUrl.searchParams.get('namespace') || 'f131667u184732093';
    
    // Create query vector using OpenAI embeddings
    console.log('[Query] Generating query embedding...');
    const queryVector = await embeddingService.generateEmbedding(searchQuery);
    console.log('[Query] Generated vector of length:', queryVector.length);
    
    // Perform the query
    console.log('[Query] Querying namespace:', namespace);
    const queryResponse = await index.namespace(namespace).query({
      vector: queryVector,
      topK: 2,
      includeMetadata: true
    });

    return NextResponse.json({ 
      message: 'Query completed successfully',
      searchQuery,
      matches: queryResponse.matches,
      namespace,
      vectorDimension: queryVector.length
    }, { status: 200 });
  } catch (error) {
    console.error('[Query] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to perform query',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 