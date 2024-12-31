import { NextApiRequest, NextApiResponse } from 'next';
import { MessageService } from '@/services/message';
import { RAGEnhancedSearch } from '@/services/search';
import { GeminiService } from '@/services/gemini';
import { FirestoreService } from '@/services/firestore';
import fs from 'fs';

interface Chunk {
  content: string;
  timestamp: string;
  type: string;
  score: number;
  sequenceNumber?: number;
  sectionTitle?: string;
}

interface VisualContent {
  scene: string;
  timestamp: string;
  keyElements: string[];
  score?: number;
}

interface Topic {
  name: string;
  relevance: number;
  context: string;
  timestamp?: string;
}

interface VideoContext {
  title: string;
  summary: string;
  description: string;
  relevantContent: Chunk[];
  audioTranscript: string;
  visualDescriptions: VisualContent[];
  topics: Topic[];
  overallScore: number;
  averageScore: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Initialize all services in parallel
    const [
      messageService,
      searchService,
      geminiService,
      firestoreService
    ] = await Promise.all([
      MessageService.getInstance(),
      RAGEnhancedSearch.getInstance(),
      GeminiService.getInstance(),
      FirestoreService.getInstance()
    ]);

    const { userNS, InstaMsgTxt, MediaType, InstaId, username, name } = req.body;
    console.log('[Message Webhook] Request body:', req.body);

    if (!userNS || !InstaMsgTxt) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Store message in Firestore
    const messageId = await firestoreService.storeMessage(userNS, {
      text: InstaMsgTxt,
      mediaType: MediaType,
      instaId: InstaId,
      username,
      name,
      timestamp: new Date().toISOString()
    });
    console.log('[Message Webhook] Message stored in Firestore:', messageId);

    try {
      // Send acknowledgment
      await messageService.sendSearchAcknowledgment(userNS);
      console.log('[Message Webhook] Sent search acknowledgment to user:', userNS);

      // Classify query intent
      console.log('[Message Webhook] Starting query intent classification');
      const queryIntent = await geminiService.classifyQueryIntent(InstaMsgTxt);
      console.log('[Message Webhook] Query intent:', queryIntent);

      // Process based on intent
      switch (queryIntent.intent) {
        case 'RECALL_VIDEO': {
          // Use existing direct video recall logic
          console.log('[Message Webhook] Processing as video recall request');
          const results = await searchService.search({
            userId: userNS,
            query: InstaMsgTxt,
            topK: 5
          });

          if (results && results.length > 0) {
            const videoUrl = results[0].metadata?.videoUrl;
            if (videoUrl) {
              console.log('[Message Webhook] Preparing to send video:', videoUrl);
              await messageService.sendVideoFoundNotification(userNS);
              await messageService.sendVideo(userNS, videoUrl);
              console.log('[Message Webhook] Successfully sent video');
            } else {
              await messageService.sendNoResultsMessage(userNS);
            }
          } else {
            await messageService.sendNoResultsMessage(userNS);
          }
          break;
        }

        case 'INFORMATION_QUERY': {
          // Generate RAG-based informational response
          console.log('[Message Webhook] Processing as information query');
          const results = await searchService.search({
            userId: userNS,
            query: InstaMsgTxt,
            topK: 5
          });

          if (results && results.length > 0) {
            // Format video information for better context
            const videoContexts = results.map(result => {
              const metadata = result.metadata;
              
              // Extract all relevant content from chunks
              const relevantContent = metadata.relevantChunks
                .filter((chunk: Chunk) => chunk.score > 0.5) // Lower threshold to include more content
                .map((chunk: Chunk) => ({
                  content: chunk.content,
                  timestamp: chunk.timestamp,
                  type: chunk.type,
                  score: chunk.score
                }));

              // Extract and format audio content
              const audioContent = metadata.audioContent || {};
              const audioTranscript = [
                audioContent.speech,
                ...(audioContent.music || []).map((m: string) => `[Music] ${m}`),
                ...(audioContent.soundEffects || []).map((s: string) => `[SFX] ${s}`)
              ].filter(Boolean).join('\n');
              
              // Get all visual descriptions
              const visualDescriptions = (metadata.visualContent || [])
                .map((content: VisualContent) => ({
                  scene: content.scene,
                  timestamp: content.timestamp,
                  keyElements: content.keyElements
                }))
                .sort((a: VisualContent, b: VisualContent) => 
                  (a.timestamp || '').localeCompare(b.timestamp || '')
                );

              // Get all topics with their context
              const topics = (metadata.topics || [])
                .map((topic: Topic) => ({
                  name: topic.name,
                  relevance: topic.relevance,
                  context: topic.context,
                  timestamp: topic.timestamp
                }))
                .sort((a: Topic, b: Topic) => b.relevance - a.relevance);

              return {
                title: metadata.title || '',
                summary: metadata.summary || '',
                description: metadata.description || '',
                relevantContent,
                audioTranscript,
                visualDescriptions,
                topics,
                overallScore: result.score || 0,
                averageScore: result.avgScore || 0
              } as VideoContext;
            });

            // Sort videos by overall relevance
            videoContexts.sort((a, b) => b.overallScore - a.overallScore);

            // Read the response generation prompt template
            const promptTemplate = await fs.readFileSync('prompts/response-generation-prompt.txt', 'utf-8');

            // Construct the complete prompt with replacements
            const completePrompt = promptTemplate
              .replace('${query}', InstaMsgTxt)
              .replace('${videoContexts}', videoContexts.map((ctx, i) => `
                Video ${i + 1} (Relevance Score: ${(ctx.overallScore * 100).toFixed(1)}%):
                
                Title: ${ctx.title}
                Summary: ${ctx.summary}
                Description: ${ctx.description}
                
                Most Relevant Content:
                ${ctx.relevantContent.map(content => `
                  - [${content.timestamp}] ${content.content} (Relevance: ${(content.score * 100).toFixed(1)}%)
                `).join('\n')}
                
                Key Visual Elements:
                ${ctx.visualDescriptions.map(visual => `
                  - [${visual.timestamp}] Scene: ${visual.scene}
                    Elements: ${visual.keyElements.join(', ')}
                `).join('\n')}
                
                Audio Transcript:
                ${ctx.audioTranscript || 'No transcript available'}
                
                Relevant Topics:
                ${ctx.topics.map(topic => `
                  - ${topic.name} (Relevance: ${(topic.relevance * 100).toFixed(1)}%)
                    Context: ${topic.context}
                    ${topic.timestamp ? `Timestamp: ${topic.timestamp}` : ''}
                `).join('\n')}
              `).join('\n\n'));

            // Log the complete prompt
            console.log('[Message Webhook] Complete Prompt:', completePrompt);

            // Generate informative response using Gemini
            const response = await geminiService.generateResponse(completePrompt);

            console.log('[Message Webhook] Gemini Response:', response);
            // Send the response
            await messageService.sendTextResponse(userNS, response);
          } else {
            await messageService.sendNoResultsMessage(userNS);
          }
          break;
        }
      }

      return res.status(200).json({ success: true, messageId });
    } catch (error) {
      console.error('[Message Webhook] Error processing message:', error);
      // Send error message to user
      await messageService.sendMessage(userNS, "I'm sorry, I encountered an error processing your message. Please try again.");
      return res.status(500).json({ error: 'Error processing message' });
    }
  } catch (error) {
    console.error('[Message Webhook] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 