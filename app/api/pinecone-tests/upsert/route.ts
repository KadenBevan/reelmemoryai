import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log('[Upsert] Starting vector upsert test...');
  
  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || ''
    });
    
    const index = pinecone.index('data-index');
    const model = genAI.getGenerativeModel({ model: "embedding-001" });
    
    // Test data
    const testData = [
      {
        id: 'test1',
        text: "A comprehensive guide to summer recipes and outdoor cooking",
        metadata: {
          url: "https://example.com/recipes/summer",
          description: "Summer cooking guide"
        }
      },
      {
        id: 'test2',
        text: "Travel destinations in Europe: Hidden gems and popular attractions",
        metadata: {
          url: "https://example.com/travel/europe",
          description: "European travel guide"
        }
      }
    ];

    // Create embeddings and prepare vectors
    const records = await Promise.all(
      testData.map(async (item) => {
        const embedding = await model.embedContent(item.text);
        return {
          id: item.id,
          values: embedding.embedding.values,
          metadata: item.metadata
        };
      })
    );

    // Get namespace reference and upsert
    const namespace = 'test-namespace';
    const namespaceIndex = index.namespace(namespace);
    await namespaceIndex.upsert(records);

    return NextResponse.json({ 
      message: 'Vectors upserted successfully',
      namespace,
      count: records.length,
      preview: {
        ids: records.map(v => v.id),
        firstVectorDimension: records[0].values.length
      }
    }, { status: 200 });
  } catch (error) {
    console.error('[Upsert] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to upsert vectors',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 