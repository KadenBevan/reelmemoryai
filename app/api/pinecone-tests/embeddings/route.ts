import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log('[Embeddings] Creating test embeddings...');
  
  try {
    const model = genAI.getGenerativeModel({ model: "embedding-001" });
    
    const testText = "A comprehensive guide to summer recipes and outdoor cooking";
    const embeddingResult = await model.embedContent(testText);
    
    // Extract the values array from the embedding
    const vector = embeddingResult.embedding.values;
    
    return NextResponse.json({ 
      message: 'Embedding created successfully',
      text: testText,
      vectorDimension: vector.length,
      vectorPreview: vector.slice(0, 5),
      isCorrectDimension: vector.length === 768,
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