import { NextApiRequest, NextApiResponse } from 'next';
import { upsertWebhookUser } from '@/lib/firebase/webhook-store';
import { messageService } from '@/lib/messages';
import { isVideoAlreadyProcessed } from '@/lib/pinecone';
import { MESSAGES } from '@/lib/messages/constants';
import { QueueService } from '@/services/queue';

interface VideoWebhookBody {
  videoUrl: string;
  userNS?: string;  // Make userNS required
  name: string;
  username: string;
  InstaId: string;
  InstaMsgTxt?: string;
  MediaType?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('[Video Webhook] Received video webhook request:', {
    body: req.body,
    headers: req.headers
  });

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const body = req.body as VideoWebhookBody;
    
    // Validate required fields
    if (!body.videoUrl?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'No video URL provided'
      });
    }

    if (!body.userNS?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'No user namespace provided'
      });
    }

    // Check if video is already processed
    const isProcessed = await isVideoAlreadyProcessed(body.userNS, body.videoUrl);
    if (isProcessed) {
      console.log('[Video Webhook] Video already processed, skipping:', body.videoUrl);
      return res.status(200).json({
        success: true,
        message: 'Video already processed'
      });
    }

    // Log MediaType details for debugging
    console.log('[Video Webhook] MediaType details:', {
      mediaType: body.MediaType,
      url: body.videoUrl
    });

    // Initialize queue service
    const queueService = await QueueService.getInstance();

    // Queue the video for processing
    await queueService.enqueueVideoProcessing(
      body.userNS,
      body.videoUrl,
      {
        mediaType: body.MediaType || 'unknown',
        instaId: body.InstaId,
        username: body.username,
        name: body.name
      }
    );

    // Store webhook user data
    await upsertWebhookUser({
      userNS: body.userNS,
      name: body.name,
      username: body.username,
      InstaId: body.InstaId
    });

    return res.status(200).json({
      success: true,
      message: 'Video queued for processing'
    });

  } catch (error) {
    console.error('[Video Webhook] Error processing video:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
} 