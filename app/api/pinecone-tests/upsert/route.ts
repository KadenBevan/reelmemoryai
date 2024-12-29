import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { EmbeddingService } from '@/services/embeddings';

export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log('[Upsert] Starting vector upsert test...');
  
  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || ''
    });
    
    const index = pinecone.index('data-index');
    const embeddingService = new EmbeddingService();
    
    // Get namespace from request or use test namespace
    const namespace = request.nextUrl.searchParams.get('namespace') || 'f131667u184732093';
    console.log('[Upsert] Using namespace:', namespace);
    
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

    // Generate embeddings for each test item
    console.log('[Upsert] Generating embeddings using OpenAI text-embedding-3-large...');
    const records = await Promise.all(
      testData.map(async (item) => {
        console.log('[Upsert] Generating embedding for:', item.id);
        const vector = await embeddingService.generateEmbedding(item.text);
        console.log('[Upsert] Generated vector of length:', vector.length);
        
        return {
          id: item.id,
          values: vector,
          metadata: item.metadata
        };
      })
    );

    // Get namespace reference and upsert
    const namespaceIndex = index.namespace(namespace);
    console.log('[Upsert] Upserting vectors with dimensions:', records[0].values.length);
    await namespaceIndex.upsert(records);

    // Verify the upsert by checking namespace stats
    const stats = await index.describeIndexStats();
    const namespaceStats = stats.namespaces?.[namespace];
    const vectorsStored = (namespaceStats?.recordCount ?? 0) > 0;

    console.log('[Upsert] Namespace stats:', {
      namespace,
      vectorCount: namespaceStats?.recordCount ?? 0,
      vectorsStored
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Test vectors upserted successfully',
      namespace,
      count: records.length,
      dimensions: records[0].values.length,
      vectorsStored,
      stats: {
        namespace: namespaceStats,
        totalVectors: stats.totalRecordCount
      }
    });
  } catch (error) {
    console.error('[Upsert] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to upsert test vectors',
        details: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    );
  }
} 