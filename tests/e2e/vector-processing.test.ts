import { VectorProcessingService } from '@/services/vector-processing';
import { GeminiService } from '@/services/gemini';
import { EmbeddingService } from '@/services/embeddings';
import { queryUserData } from '@/lib/pinecone';
import { verifyIndexConfiguration } from '@/lib/pinecone';

// Test constants
const TEST_USER_ID = 'test_user_123';
const TEST_VIDEO_URL = 'https://example.com/test-video.mp4';
const PIZZA_QUERY = 'How do you make pizza dough?';

describe('Vector Processing E2E Tests', () => {
  const vectorProcessor = new VectorProcessingService();
  const geminiService = new GeminiService();
  const embeddingService = new EmbeddingService();

  beforeAll(async () => {
    // Verify index exists and is ready
    const indexStatus = await verifyIndexConfiguration();
    if (!indexStatus.success) {
      throw new Error('Pinecone index not ready. Please ensure index is created before running tests.');
    }
  });

  it('should process video and store vectors', async () => {
    const analysisData = {
      title: 'Pizza Making Tutorial',
      summary: 'A comprehensive guide to making authentic pizza dough and sauce.',
      visualContent: [
        {
          timestamp: '00:15',
          scene: 'Mixing pizza dough ingredients',
          keyElements: ['flour', 'yeast', 'water', 'salt']
        },
        {
          timestamp: '01:30',
          scene: 'Kneading the dough',
          keyElements: ['dough', 'kneading technique', 'consistency']
        }
      ],
      audioContent: {
        speech: 'Detailed instructions for making pizza dough',
        music: 'Soft background music',
        soundEffects: ['mixing sounds', 'kitchen ambience']
      },
      topics: [
        {
          name: 'Pizza Dough',
          relevance: 0.9,
          context: 'Main focus on dough preparation and techniques'
        },
        {
          name: 'Baking',
          relevance: 0.8,
          context: 'General baking principles and tips'
        }
      ],
      technicalDetails: {
        quality: 'HD 1080p',
        effects: ['close-up shots', 'step-by-step transitions'],
        editing: 'Clean cuts between steps'
      },
      searchableKeywords: ['pizza', 'dough', 'baking', 'recipe', 'tutorial']
    };

    await vectorProcessor.processVideoAnalysis({
      userId: TEST_USER_ID,
      analysisData,
      videoUrl: TEST_VIDEO_URL,
      metadata: {
        mediaType: 'Post',
        instaId: 'test123',
        username: 'test_user',
        name: 'Test User'
      }
    });
  });

  it('should successfully query video content', async () => {
    // Generate embedding for query
    const queryVector = await embeddingService.generateEmbedding(PIZZA_QUERY);
    
    // Query vectors
    const matches = await queryUserData(TEST_USER_ID, queryVector, 5);
    
    // Verify matches
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].score).toBeGreaterThanOrEqual(0.7);
    expect(matches[0].metadata.videoUrl).toBe(TEST_VIDEO_URL);
  });

  it('should verify vector storage in index', async () => {
    // Generate embedding for verification
    const verificationVector = await embeddingService.generateEmbedding('pizza recipe');
    
    // Query vectors
    const matches = await queryUserData(TEST_USER_ID, verificationVector, 5);
    
    // Verify storage
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].metadata.videoUrl).toBe(TEST_VIDEO_URL);
    expect(matches[0].metadata.videoId).toContain(TEST_USER_ID);
  });
}); 