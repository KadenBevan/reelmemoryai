import { Pinecone } from '@pinecone-database/pinecone';
import { EmbeddingService } from './embeddings';
import { GeminiService } from './gemini';
import fs from 'fs';


interface RAGSearchOptions {
  userId: string;
  query: string;
  topK?: number;
  includeMetadata?: boolean;
}

interface EnhancedQuery {
  originalQuery: string;
  searchText: string;
  searchTerms: string[];
  visualElements: string[];
  temporalContext: {
    timeframe?: string;
    recency?: 'recent' | 'old';
  };
  topics: string[];
}

export class RAGEnhancedSearch {
  private static instance: RAGEnhancedSearch;
  private static instancePromise: Promise<RAGEnhancedSearch> | null = null;

  private pinecone!: Pinecone;
  private embeddingService!: EmbeddingService;
  private geminiService!: GeminiService;

  private constructor() {}

  private async initialize(): Promise<void> {
    try {
      this.embeddingService = await EmbeddingService.getInstance();
      this.geminiService = await GeminiService.getInstance();
      
      // Initialize Pinecone with correct configuration
      console.log('[Pinecone] Initializing client...');
      this.pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY || ''
      });
      console.log('[Pinecone] Successfully initialized');
    } catch (error) {
      console.error('[RAGEnhancedSearch] Initialization error:', error);
      throw error;
    }
  }

  public static async getInstance(): Promise<RAGEnhancedSearch> {
    if (!RAGEnhancedSearch.instancePromise) {
      RAGEnhancedSearch.instancePromise = (async () => {
        if (!RAGEnhancedSearch.instance) {
          const instance = new RAGEnhancedSearch();
          await instance.initialize();
          RAGEnhancedSearch.instance = instance;
        }
        return RAGEnhancedSearch.instance;
      })();
    }
    return RAGEnhancedSearch.instancePromise;
  }

  async search({ userId, query, topK = 5, includeMetadata = true }: RAGSearchOptions) {
    try {
      console.log('[RAG Search] Processing query:', query, 'for user:', userId);

      // 1. Analyze and enhance the query using Gemini
      const enhancedQuery = await this.enhanceQuery(query);
      console.log('[RAG Search] Enhanced query:', JSON.stringify(enhancedQuery, null, 2));

      // 2. Generate embeddings for the enhanced query
      const queryEmbedding = await this.embeddingService.generateEmbedding(enhancedQuery.searchText);
      console.log('[RAG Search] Generated embedding of length:', queryEmbedding.length);

      // 3. Build search context with expanded terms
      const searchContext = this.buildSearchContext(enhancedQuery);
      console.log('[RAG Search] Built search context:', JSON.stringify(searchContext, null, 2));

      // 4. Multi-stage retrieval
      const results = await this.multiStageRetrieval({
        userId,
        embedding: queryEmbedding,
        context: searchContext,
        topK
      });

      console.log('[RAG Search] Retrieved results:', results.length);
      if (results.length > 0) {
        console.log('[RAG Search] Top result:', {
          score: results[0].score,
          metadata: results[0].metadata
        });
      }

      // 5. Re-rank results based on relevance
      const rankedResults = this.reRankResults(results, enhancedQuery);
      console.log('[RAG Search] Re-ranked results:', rankedResults.length);

      return rankedResults;
    } catch (error) {
      console.error('[RAG Search] Error during search:', error);
      throw error;
    }
  }

  private async enhanceQuery(query: string): Promise<EnhancedQuery> {
    const promptTemplate = await fs.readFileSync('./prompts/enhanced-query.txt', 'utf8');
    const prompt = promptTemplate.replace('${query}', query);
    try {
      // Define a more specific response schema
      const responseSchema = {
        type: "object",
        properties: {
          searchText: { 
            type: "string",
            description: "Enhanced search text optimized for retrieval"
          },
          searchTerms: {
            type: "array",
            items: { 
              type: "string",
              description: "Individual search terms extracted from the query"
            },
            minItems: 1
          },
          visualElements: {
            type: "array",
            items: { 
              type: "object",
              properties: {
                type: { 
                  type: "string",
                  enum: ["object", "action", "scene", "person"]
                },
                value: { type: "string" }
              },
              required: ["type", "value"]
            }
          },
          temporalContext: {
            type: "object",
            properties: {
              timeframe: { 
                type: "string",
                description: "Specific time period mentioned in the query"
              },
              recency: { 
                type: "string",
                enum: ["recent", "old", "any"],
                description: "Whether the query implies temporal recency"
              }
            }
          },
          topics: {
            type: "array",
            items: { 
              type: "object",
              properties: {
                name: { type: "string" },
                relevance: { 
                  type: "number",
                  minimum: 0,
                  maximum: 1
                }
              },
              required: ["name", "relevance"]
            }
          }
        },
        required: ["searchText", "searchTerms"]
      };

      try {
        // Generate structured response with improved error handling
        const parsed = await this.geminiService.generateStructuredResponse(prompt, responseSchema);
        
        // Validate and transform the response
        return {
          originalQuery: query,
          searchText: parsed.searchText || query,
          searchTerms: Array.isArray(parsed.searchTerms) ? parsed.searchTerms : query.toLowerCase().split(/\s+/),
          visualElements: Array.isArray(parsed.visualElements) ? 
            parsed.visualElements.map((el: { type: string; value: string }) => el.value) : [],
          temporalContext: parsed.temporalContext || {},
          topics: Array.isArray(parsed.topics) ? 
            parsed.topics.map((t: { name: string; relevance: number }) => t.name) : []
        };
      } catch (parseError) {
        console.error('[RAG Search] Error parsing enhanced query response:', parseError);
        // Provide a valid fallback
        return {
          originalQuery: query,
          searchText: query,
          searchTerms: query.toLowerCase().split(/\s+/),
          visualElements: [],
          temporalContext: {},
          topics: []
        };
      }
    } catch (error) {
      console.error('[RAG Search] Error enhancing query:', error);
      // Return basic query structure on error
      return {
        originalQuery: query,
        searchText: query,
        searchTerms: query.toLowerCase().split(/\s+/),
        visualElements: [],
        temporalContext: {},
        topics: []
      };
    }
  }

  private buildSearchContext(enhancedQuery: EnhancedQuery) {
    const { searchTerms, visualElements, topics } = enhancedQuery;

    // Build filter conditions as an array
    const filterConditions = [];

    // Add topic filters
    if (topics && topics.length > 0) {
      filterConditions.push({
        "$or": [
          { "metadata.topics.name": { "$in": topics } },
          { "metadata.searchableKeywords": { "$in": topics } }
        ]
      });
    }

    // Add visual element filters
    if (visualElements && visualElements.length > 0) {
      filterConditions.push({
        "$or": [
          { "metadata.visualContent.keyElements": { "$in": visualElements } },
          { "metadata.searchableKeywords": { "$in": visualElements } }
        ]
      });
    }

    // Add search term filters
    if (searchTerms && searchTerms.length > 0) {
      filterConditions.push({
        "metadata.searchableKeywords": { "$in": searchTerms }
      });
    }

    // Combine all conditions with $or if there are any
    const filters = filterConditions.length > 0 ? { "$or": filterConditions } : {};

    return {
      filters,
      weights: {
        titleMatch: 1.5,
        topicMatch: 1.2,
        visualMatch: 1.0,
        temporalMatch: 0.8
      }
    };
  }

  private buildTemporalFilter(context: EnhancedQuery['temporalContext']) {
    if (!context || (!context.timeframe && !context.recency)) return null;
    
    const now = new Date().toISOString();
    if (context.recency === 'recent') {
      return {
        "metadata.processedAt": {
          $gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        }
      };
    }
    
    return null;
  }

  private async multiStageRetrieval({ 
    userId, 
    embedding, 
    context, 
    topK 
  }: { 
    userId: string;
    embedding: number[];
    context: {
      filters: Record<string, any>;
      weights: Record<string, number>;
    };
    topK: number;
  }) {
    // First stage: Semantic search with context-aware filtering
    const index = this.pinecone.index('data-index');
    const namespaceIndex = index.namespace(userId);
    
    console.log('[RAG Search] Querying namespace:', userId, 'with filters:', JSON.stringify(context.filters, null, 2));
    
    try {
      // First try with metadata filters
      const baseQueryOptions = {
        vector: embedding,
        topK: topK * 4, // Increased to get more chunks from same videos
        includeMetadata: true,
        includeValues: false
      };

      // Apply filters if they exist
      if (Object.keys(context.filters).length > 0) {
        const semanticResults = await namespaceIndex.query({
          ...baseQueryOptions,
          filter: {
            $and: [
              // Ensure we have non-empty metadata
              { title: { $exists: true } },
              { summary: { $exists: true } },
              // Apply user's context filters
              ...Object.entries(context.filters).map(([key, value]) => ({
                [key]: value
              }))
            ]
          }
        });

        if (semanticResults.matches?.length) {
          console.log('[RAG Search] Found matches with filters:', semanticResults.matches.length);
          console.log('[RAG Search] Sample match metadata:', semanticResults.matches[0].metadata);
          return this.aggregateVideoChunks(semanticResults.matches, topK);
        }
      }

      // Fallback: Try with just metadata existence check
      console.log('[RAG Search] No matches found with filters, trying with metadata existence check');
      const fallbackResults = await namespaceIndex.query({
        ...baseQueryOptions,
        filter: {
          $and: [
            { title: { $exists: true } },
            { summary: { $exists: true } }
          ]
        }
      });
      
      if (fallbackResults.matches?.length) {
        console.log('[RAG Search] Found matches with metadata check:', fallbackResults.matches.length);
        console.log('[RAG Search] Sample match metadata:', fallbackResults.matches[0].metadata);
        return this.aggregateVideoChunks(fallbackResults.matches, topK);
      }

      // Final fallback: Pure vector search
      console.log('[RAG Search] No matches found with metadata check, trying pure vector search');
      const pureVectorResults = await namespaceIndex.query(baseQueryOptions);
      
      console.log('[RAG Search] Found matches with pure vector search:', pureVectorResults.matches?.length || 0);
      if (pureVectorResults.matches?.length) {
        console.log('[RAG Search] Sample match metadata:', pureVectorResults.matches[0].metadata);
      }
      
      return this.aggregateVideoChunks(pureVectorResults.matches || [], topK);
    } catch (error) {
      console.error('[RAG Search] Error during query:', error);
      // Final fallback: Try a pure vector search without any filters
      console.log('[RAG Search] Error with filters, trying pure vector search');
      const pureVectorResults = await namespaceIndex.query({
        vector: embedding,
        topK: topK * 4,
        includeMetadata: true,
        includeValues: false
      });
      return this.aggregateVideoChunks(pureVectorResults.matches || [], topK);
    }
  }

  private aggregateVideoChunks(matches: any[], topK: number) {
    // Group matches by videoId instead of URL for more reliable grouping
    const videoGroups = new Map<string, any[]>();
    
    matches.forEach(match => {
      const videoId = match.metadata?.videoId;
      if (!videoId) return;
      
      if (!videoGroups.has(videoId)) {
        videoGroups.set(videoId, []);
      }
      videoGroups.get(videoId)?.push(match);
    });

    // Combine chunks for each video with improved aggregation
    const aggregatedResults = Array.from(videoGroups.entries()).map(([videoId, chunks]) => {
      // Sort chunks by sequence number and timestamp
      chunks.sort((a, b) => {
        const seqA = a.metadata?.sequenceNumber || 0;
        const seqB = b.metadata?.sequenceNumber || 0;
        if (seqA !== seqB) return seqA - seqB;
        
        const timeA = a.metadata?.timestamp || '';
        const timeB = b.metadata?.timestamp || '';
        return timeA.localeCompare(timeB);
      });

      // Find the overview chunk (usually sequenceNumber 1)
      const overviewChunk = chunks.find(chunk => 
        chunk.metadata?.sequenceNumber === 1 || 
        chunk.metadata?.sectionTitle?.toLowerCase().includes('overview')
      ) || chunks[0];
      
      // Get the highest score among chunks
      const maxScore = Math.max(...chunks.map(chunk => chunk.score || 0));
      const avgScore = chunks.reduce((sum, chunk) => sum + (chunk.score || 0), 0) / chunks.length;

      // Parse stringified JSON fields with improved error handling
      const parseJsonSafely = (str: string | any) => {
        if (typeof str !== 'string') return str;
        try {
          return JSON.parse(str);
        } catch {
          return str;
        }
      };

      // Combine metadata with improved structure
      const combinedMetadata = {
        videoId,
        videoUrl: overviewChunk.metadata?.videoUrl,
        title: overviewChunk.metadata?.title || '',
        summary: overviewChunk.metadata?.summary || '',
        description: overviewChunk.metadata?.description || '',
        
        // Aggregate visual content with timestamps and deduplication
        visualContent: Array.from(new Map(
          chunks.reduce((acc: any[], chunk) => {
            const content = parseJsonSafely(chunk.metadata?.visualContent);
            if (Array.isArray(content)) {
              return [...acc, ...content.map(item => [
                `${item.timestamp}-${item.scene}`,
                {
                  ...item,
                  timestamp: item.timestamp || chunk.metadata?.timestamp || '',
                  sequenceNumber: chunk.metadata?.sequenceNumber
                }
              ])];
            }
            return acc;
          }, [])
        ).values()),

        // Aggregate audio content with improved structure and deduplication
        audioContent: chunks.reduce((acc: any, chunk) => {
          const content = parseJsonSafely(chunk.metadata?.audioContent);
          if (content) {
            // Deduplicate speech by timestamp
            const speechMap = new Map();
            const newSpeech = content.speech || '';
            if (newSpeech) {
              const timestamp = content.timestamp || chunk.metadata?.timestamp;
              speechMap.set(timestamp, newSpeech);
            }

            return {
              speech: Array.from(speechMap.values()).join('\n'),
              music: [...new Set([...(acc.music || []), ...(Array.isArray(content.music) ? content.music : [content.music].filter(Boolean))])],
              soundEffects: [...new Set([...(acc.soundEffects || []), ...(content.soundEffects || [])])],
              timestamps: [...new Set([...(acc.timestamps || []), chunk.metadata?.timestamp].filter(Boolean))]
            };
          }
          return acc;
        }, { speech: '', music: [], soundEffects: [], timestamps: [] }),

        // Aggregate topics with relevance scores and deduplication
        topics: Array.from(
          chunks.reduce((topicMap: Map<string, any>, chunk) => {
            const topics = parseJsonSafely(chunk.metadata?.topics);
            if (Array.isArray(topics)) {
              topics.forEach(topic => {
                const existing = topicMap.get(topic.name);
                if (!existing || topic.relevance > existing.relevance) {
                  topicMap.set(topic.name, {
                    ...topic,
                    timestamp: topic.timestamp || chunk.metadata?.timestamp || '',
                    sequenceNumber: chunk.metadata?.sequenceNumber
                  });
                }
              });
            }
            return topicMap;
          }, new Map()).values()
        ),

        // Technical details from all chunks
        technicalDetails: chunks.reduce((acc: any, chunk) => {
          const details = parseJsonSafely(chunk.metadata?.technicalDetails);
          return { ...acc, ...details };
        }, {}),

        // Aggregate all searchable keywords with deduplication
        searchableKeywords: Array.from(new Set(
          chunks.reduce((acc: string[], chunk) => {
            const keywords = Array.isArray(chunk.metadata?.searchableKeywords) 
              ? chunk.metadata.searchableKeywords 
              : [];
            return [...acc, ...keywords];
          }, [])
        )),

        // Store relevant chunks with improved metadata and deduplication
        relevantChunks: Array.from(
          new Map(
            chunks.map(chunk => [
              `${chunk.metadata?.timestamp}-${chunk.metadata?.sequenceNumber}`,
              {
                content: chunk.metadata?.content || chunk.metadata?.searchableText || '',
                score: chunk.score || 0,
                timestamp: chunk.metadata?.timestamp || '',
                sequenceNumber: chunk.metadata?.sequenceNumber || 0,
                sectionTitle: chunk.metadata?.sectionTitle || '',
                type: chunk.metadata?.type || 'text'
              }
            ])
          ).values()
        ).sort((a, b) => b.score - a.score)
      };

      return {
        id: videoId,
        score: maxScore,
        avgScore,
        metadata: combinedMetadata
      };
    });

    // Sort by score and limit to topK
    return aggregatedResults
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, topK);
  }

  private reRankResults(results: any[], enhancedQuery: EnhancedQuery) {
    return results
      .map(result => ({
        ...result,
        score: this.calculateHybridScore(result, enhancedQuery)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  private calculateHybridScore(
    match: any,
    enhancedQuery: EnhancedQuery
  ): number {
    let score = match.score || 0; // Base vector similarity score

    const metadata = match.metadata || {};
    
    // Boost score based on keyword matches
    const keywordMatches = enhancedQuery.searchTerms.filter(term => 
      metadata.keywords?.includes(term) ||
      metadata.title?.toLowerCase().includes(term) ||
      metadata.summary?.toLowerCase().includes(term)
    ).length;
    
    // Boost score based on visual element matches
    const visualMatches = enhancedQuery.visualElements.filter(elem =>
      metadata.keyElements?.includes(elem)
    ).length;
    
    // Boost score based on topic matches
    const topicMatches = enhancedQuery.topics.filter(topic =>
      metadata.topics?.includes(topic)
    ).length;

    // Calculate final score with boosts
    return score * (
      1 + // Base score
      (keywordMatches * 0.2) + // Keyword boost
      (visualMatches * 0.15) + // Visual match boost
      (topicMatches * 0.1) // Topic match boost
    );
  }
} 