import { NextRequest, NextResponse } from 'next/server';
import { EmbeddingService } from '@/services/embeddings';

export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log('[Embeddings] Creating test embeddings...');
  
  try {
    const embeddingService = new EmbeddingService();
    
    const testText = "A comprehensive guide to summer recipes and outdoor cooking";
    console.log('[Embeddings] Generating embedding for test text...');
    const vector = await embeddingService.generateEmbedding(testText);
    
    console.log('[Embeddings] Generated vector of length:', vector.length);
    
    return NextResponse.json({ 
      message: 'Embedding created successfully',
      text: testText,
      vectorDimension: vector.length,
      vectorPreview: vector.slice(0, 5),
      isCorrectDimension: vector.length === 3072,
      readyForPinecone: true
    }, { status: 200 });
  } catch (error) {
    console.error('[Embeddings] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to create embedding',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 