import { NextApiRequest, NextApiResponse } from 'next';
import { EmbeddingService } from '@/services/embeddings';
import { GeminiService } from '@/services/gemini';
import { queryUserData } from '@/lib/pinecone';
import { VectorMetadata } from '@/lib/pinecone';
import { addIncomingMessage } from '@/lib/firebase/webhook-store';
import { messageService } from '@/lib/messages';
import { MESSAGES } from '@/lib/messages/constants';
import { MessagePayload, VideoPayload } from '@/lib/messages/types';
import { ScoredPineconeRecord } from '@pinecone-database/pinecone';

// Constants
const TOP_K_MATCHES = 5;
const SIMILARITY_THRESHOLD = 0.6;

interface MessageWebhookBody {
  InstaMsgTxt: string;
  name: string;
  username: string;
  InstaId: string;
  userNS?: string;
  MediaType?: string;
}

/**
 * Formats retrieved content for RAG prompt
 */
function formatRetrievedContent(matches: ScoredPineconeRecord<VectorMetadata>[]): string {
  if (!matches.length) return '';

  const sections = matches.reduce((acc: { [key: string]: ScoredPineconeRecord<VectorMetadata>[] }, match) => {
    const section = match.metadata?.sectionTitle || 'Uncategorized';
    if (!acc[section]) {
      acc[section] = [];
    }
    acc[section].push(match);
    return acc;
  }, {});

  let formattedContent = '\nRelevant Content:\n';
  
  for (const [section, matches] of Object.entries(sections)) {
    formattedContent += `\n${section}:\n`;
    matches.forEach(match => {
      // Try to get description from topics if direct description is missing
      let description = '';
      if (match.metadata?.topicsJson) {
        try {
          const topics = JSON.parse(match.metadata.topicsJson);
          description = topics.map((topic: any) => 
            `${topic.name}: ${topic.context}`
          ).join('\n');
        } catch (e) {
          console.error('[Message Webhook] Error parsing topics JSON:', e);
        }
      }
      if (!description) {
        description = match.metadata?.keywords?.join(', ') || 'No description available';
      }
      formattedContent += `- From video "${match.metadata?.videoId}":\n${description}\n`;
    });
  }

  return formattedContent;
}

/**
 * Generates RAG prompt with retrieved content
 */
function generateRagPrompt(query: string, retrievedContent: string): string {
  return `You are a helpful AI assistant that helps users recall and understand content from their saved videos.
Your task is to answer the user's question using only the information provided in the relevant content sections.
If you cannot find a relevant answer in the provided content, say so clearly.
Do not make up or infer information that is not explicitly present in the content.

User Question: ${query}

${retrievedContent}

Please provide a natural, conversational response that directly answers the user's question using the relevant content.
Include specific references to the videos where appropriate.
Keep the response concise and focused on answering the question.`;
}

// Initialize services
const embeddingService = new EmbeddingService();
const geminiService = new GeminiService();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('[Message Webhook] Request received:', {
    method: req.method,
    url: req.url,
    headers: req.headers
  });

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  let searchAckSent = false;
  
  try {
    const body = req.body as MessageWebhookBody;
    console.log('[Message Webhook] Request body:', body);

    if (!body.InstaMsgTxt?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'No message provided'
      });
    }

    // Store message in Firestore if userNS is provided
    if (body.userNS) {
      try {
        await addIncomingMessage(body.userNS, {
          text: body.InstaMsgTxt.trim(),
          timestamp: new Date(),
          messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        });
        console.log('[Message Webhook] Message stored in Firestore:', body.userNS);
      } catch (error) {
        console.error('[Message Webhook] Error storing message:', error);
      }
    }

    // Send immediate search acknowledgment
    if (body.userNS) {
      try {
        console.log('[Message Webhook] Sending search acknowledgment to user:', body.userNS);
        const ackResult = await messageService.sendSearchStartedAck(body.userNS);
        searchAckSent = ackResult.success;
        
        if (!ackResult.success) {
          console.error('[Message Webhook] Failed to send search acknowledgment:', {
            error: ackResult.error,
            status: ackResult.status,
            response: ackResult.response
          });
        } else {
          console.log('[Message Webhook] Successfully sent search acknowledgment:', {
            status: ackResult.status,
            response: ackResult.response
          });
        }
      } catch (error) {
        console.error('[Message Webhook] Error sending search acknowledgment:', error);
      }
    }

    // Generate embedding for query
    console.log('[Message Webhook] Generating embedding for query:', body.InstaMsgTxt.trim());
    const queryVector = await embeddingService.generateEmbedding(body.InstaMsgTxt.trim());

    // Query vector database
    console.log('[Message Webhook] Querying vector database for user:', body.userNS);

    // Extract key terms from the query
    const searchTerms = body.InstaMsgTxt.toLowerCase()
      .split(' ')
      .filter(term => term.length > 3) // Filter out short words
      .map(term => term.replace(/[^a-z0-9]/g, '')); // Clean terms

    console.log('[Message Webhook] Search terms:', searchTerms);

    const queryResponse = await queryUserData(body.userNS || '', queryVector, TOP_K_MATCHES, {
      filter: {
        $or: [
          { keywords: { $in: searchTerms } },
          { sectionTitle: { $in: ['Overview', 'Visual Content'] } }
        ]
      }
    });

    // Log full query results for debugging
    console.log(`[Message Webhook] Found ${queryResponse.matches?.length || 0} matches:`, 
      JSON.stringify(queryResponse.matches?.map(match => ({
        id: match.id,
        score: match.score,
        metadata: {
          ...match.metadata,
          title: match.metadata?.title,
          keywords: match.metadata?.keywords,
          topics: match.metadata?.topicsJson ? JSON.parse(match.metadata.topicsJson) : []
        }
      })), null, 2)
    );

    // Filter matches by similarity threshold
    const relevantMatches = (queryResponse.matches || []).filter(match => {
      // Check score threshold
      if (!match.score || match.score < SIMILARITY_THRESHOLD) {
        return false;
      }

      // Check metadata exists
      const metadata = match.metadata;
      if (!metadata) return false;

      // Log match details for debugging
      console.log('[Message Webhook] Evaluating match:', {
        score: match.score,
        title: metadata.title,
        keywords: metadata.keywords,
        topics: metadata.topicsJson ? JSON.parse(metadata.topicsJson) : []
      });

      return true;  // If it passes score threshold and has metadata, consider it relevant
    });
    console.log(`[Message Webhook] ${relevantMatches.length} matches above threshold:`, 
      relevantMatches.map(match => ({ 
        score: match.score, 
        videoUrl: match.metadata?.videoUrl,
        videoId: match.metadata?.videoId,
        keywords: match.metadata?.keywords,
        sectionTitle: match.metadata?.sectionTitle
      }))
    );

    if (relevantMatches.length === 0) {
      console.log('[Message Webhook] No relevant matches found');
      
      if (body.userNS) {
        let noMatchMessageSent = false;

        try {
          console.log('[Message Webhook] Sending no matches message');
          const noMatchResult = await messageService.sendMessage({
            user_ns: body.userNS,
            message: MESSAGES.VIDEO_NOT_FOUND,
            type: 'RESPONSE'
          } as MessagePayload);
          
          noMatchMessageSent = noMatchResult.success;
          if (!noMatchResult.success) {
            console.error('[Message Webhook] Failed to send no matches message:', {
              error: noMatchResult.error,
              status: noMatchResult.status,
              response: noMatchResult.response
            });
          } else {
            console.log('[Message Webhook] Successfully sent no matches message');
          }
        } catch (error) {
          console.error('[Message Webhook] Error sending no matches message:', error);
        }

        return res.status(200).json({
          success: true,
          message: 'No relevant matches found',
          matches: [],
          messageStatus: {
            searchAckSent,
            noMatchMessageSent
          }
        });
      }

      return res.status(200).json({
        success: true,
        message: 'No relevant matches found',
        matches: [],
        messageStatus: {
          searchAckSent
        }
      });
    }

    // Send video to user with proper sequencing
    let videoFoundSent = false;
    let videoSent = false;
    let videoSendAttempts = 0;

    if (body.userNS && relevantMatches.length > 0 && relevantMatches[0].metadata?.videoUrl) {
      const videoUrl = relevantMatches[0].metadata.videoUrl;
      console.log('[Message Webhook] Preparing to send video:', videoUrl);
      
      // First send the "found video" message
      try {
        console.log('[Message Webhook] Sending video found notification');
        const foundResult = await messageService.sendMessage({
          user_ns: body.userNS,
          message: MESSAGES.VIDEO_FOUND,
          type: 'RESPONSE'
        } as MessagePayload);
        
        videoFoundSent = foundResult.success;
        if (!foundResult.success) {
          console.error('[Message Webhook] Failed to send video found message:', {
            error: foundResult.error,
            status: foundResult.status,
            response: foundResult.response
          });
        } else {
          console.log('[Message Webhook] Successfully sent video found notification');
          // Add small delay before sending video
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error('[Message Webhook] Error sending video found notification:', error);
      }

      // Then send the actual video
      const maxRetries = 3;
      while (!videoSent && videoSendAttempts < maxRetries) {
        videoSendAttempts++;
        try {
          console.log(`[Message Webhook] Attempting to send video (attempt ${videoSendAttempts}/${maxRetries}):`, videoUrl);
          
          const videoResult = await messageService.sendVideo({
            user_ns: body.userNS,
            Url: videoUrl,
            type: 'ANALYSIS_RESULT'
          } as VideoPayload);
          
          if (videoResult.success) {
            videoSent = true;
            console.log('[Message Webhook] Successfully sent video:', {
              status: videoResult.status,
              response: videoResult.response
            });
            break; // Exit retry loop on success
          } else {
            console.error(`[Message Webhook] Failed to send video (attempt ${videoSendAttempts}/${maxRetries}):`, {
              error: videoResult.error,
              status: videoResult.status,
              response: videoResult.response
            });
            
            if (videoSendAttempts < maxRetries) {
              const delay = videoSendAttempts * 1000;
              console.log(`[Message Webhook] Retrying video send in ${delay}ms`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        } catch (error) {
          console.error(`[Message Webhook] Error sending video (attempt ${videoSendAttempts}/${maxRetries}):`, error);
          
          if (videoSendAttempts < maxRetries) {
            const delay = videoSendAttempts * 1000;
            console.log(`[Message Webhook] Retrying video send in ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      // Send error message if video sending failed after all retries
      if (!videoSent) {
        try {
          console.log('[Message Webhook] Sending video retrieval error message');
          const errorResult = await messageService.sendMessage({
            user_ns: body.userNS,
            message: MESSAGES.RETRIEVAL_ERROR,
            type: 'ERROR'
          } as MessagePayload);
          
          if (!errorResult.success) {
            console.error('[Message Webhook] Failed to send retrieval error message:', {
              error: errorResult.error,
              status: errorResult.status,
              response: errorResult.response
            });
          } else {
            console.log('[Message Webhook] Successfully sent retrieval error message');
          }
        } catch (error) {
          console.error('[Message Webhook] Error sending retrieval error message:', error);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Message processed successfully',
      messageStatus: {
        searchAckSent,
        videoFoundSent,
        videoSent,
        attempts: videoSendAttempts
      }
    });
  } catch (error) {
    console.error('[Message Webhook] Error:', error);
    
    // Send error message to user if userNS is provided
    if (req.body.userNS) {
      try {
        const errorResult = await messageService.sendMessage({
          user_ns: req.body.userNS,
          message: MESSAGES.GENERAL_ERROR,
          type: 'ERROR'
        });
        if (!errorResult.success) {
          console.error('[Message Webhook] Failed to send error message:', errorResult.error);
        }
      } catch (msgError) {
        console.error('[Message Webhook] Error sending error message:', msgError);
      }
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: (error as Error).message,
      messageStatus: {
        searchAckSent,
        errorSent: req.body.userNS ? true : false
      }
    });
  }
} 