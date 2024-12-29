import { NextApiRequest, NextApiResponse } from 'next';
import { upsertWebhookUser } from '@/lib/firebase/webhook-store';
import { messageService } from '@/lib/messages';
import { MESSAGES } from '@/lib/messages/constants';
import { enqueueVideoProcessing } from '@/services/queue';

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

    // Log MediaType details for debugging
    console.log('[Video Webhook] MediaType details:', {
      rawMediaType: body.MediaType,
      typeofMediaType: typeof body.MediaType,
      bodyKeys: Object.keys(body)
    });

    // Upsert webhook user with namespace
    console.log('[Firestore Webhook] Upserting webhook user:', body.userNS);
    await upsertWebhookUser({
      name: body.name,
      username: body.username,
      userNS: body.userNS,
      InstaId: body.InstaId
    });

    // Generate job ID
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Enqueue video processing job
    await enqueueVideoProcessing({
      jobId,
      videoUrl: body.videoUrl,
      userNS: body.userNS,
      metadata: {
        mediaType: body.MediaType || 'unknown',
        instaId: body.InstaId,
        username: body.username,
        name: body.name
      },
      status: 'pending'
    });

    // Send acknowledgment message
    await messageService.sendMessage({
      user_ns: body.userNS,
      message: MESSAGES.VIDEO_RECEIVED,
      type: 'ACKNOWLEDGMENT'
    });

    return res.status(200).json({
      success: true,
      message: 'Video processing queued',
      jobId
    });

  } catch (error) {
    console.error('[Video Webhook] Error processing video:', error);
    
    if (req.body.userNS) {
      await messageService.sendMessage({
        user_ns: req.body.userNS,
        message: MESSAGES.VIDEO_PROCESSING_ERROR,
        type: 'ERROR'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Error processing video',
      error: error instanceof Error ? error.message : String(error)
    });
  }
} 