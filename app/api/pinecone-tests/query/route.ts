import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log('[Query] Starting similarity search...');

  try {
    // Get the search query from request body
    const { searchQuery } = await request.json();
    if (!searchQuery) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
    }

    // Initialize Pinecone
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || ''
    });
    
    // Get index and namespace
    const index = pinecone.index('data-index');
    const namespace = 'test-namespace';
    
    // Create query vector
    const model = genAI.getGenerativeModel({ model: "embedding-001" });
    const queryEmbedding = await model.embedContent(searchQuery);
    
    // Perform the query
    const queryResponse = await index.namespace(namespace).query({
      vector: queryEmbedding.embedding.values,
      topK: 2,
      includeMetadata: true
    });

    return NextResponse.json({ 
      message: 'Query completed successfully',
      searchQuery,
      matches: queryResponse.matches,
      namespace
    }, { status: 200 });
  } catch (error) {
    console.error('[Query] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to perform query',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 