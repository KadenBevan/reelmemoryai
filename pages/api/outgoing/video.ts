import { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';
import { addOutgoingVideo } from '@/lib/firebase/webhook-store';
import { messageService } from '@/lib/messages';
import type { VideoPayload } from '@/lib/messages/types';
import { WEBHOOK_URLS } from '@/lib/messages/constants';

// Validate webhook URL
if (!WEBHOOK_URLS.VIDEO) {
  console.error('[Outgoing Video Webhook] Missing webhook URL configuration');
  throw new Error('Missing webhook URL configuration');
}

interface VideoWebhookBody {
  url: string;
  user_ns: string;
  type: VideoPayload['type'];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('[Outgoing Video Webhook] Request received:', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body
  });

  if (req.method !== 'POST') {
    const errorMsg = `Error: Invalid method: ${req.method}`;
    console.log('[Outgoing Video Webhook] ' + errorMsg);
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { url, user_ns = '', type = 'OTHER' } = req.body;
    
    if (!url) {
      const errorMsg = 'Missing required field: url';
      console.log('[Outgoing Video Webhook] ' + errorMsg);
      return res.status(400).json({ 
        success: false,
        message: errorMsg 
      });
    }

    const payload: VideoPayload = {
      user_ns,
      Url: url,
      type
    };

    console.log('[Outgoing Video Webhook] Sending payload to uChat:', payload);

    // Send to uChat webhook
    const response = await fetch(WEBHOOK_URLS.VIDEO, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log('[Outgoing Video Webhook] uChat response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseText
    });

    if (!response.ok) {
      throw new Error(`Failed to send video to uChat: ${response.status} ${response.statusText} - ${responseText}`);
    }

    // Store the outgoing video in Firestore
    if (user_ns) {
      try {
        await addOutgoingVideo(user_ns, {
          videoUrl: url,
          timestamp: new Date(),
          videoId: `vid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: type
        });
        console.log('[Outgoing Video Webhook] Video stored in Firestore:', {
          user_ns,
          url,
          type
        });
      } catch (error) {
        console.error('[Outgoing Video Webhook] Error storing outgoing video:', error);
        // Continue since video was sent successfully even if storage failed
      }
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.warn('[Outgoing Video Webhook] Could not parse response as JSON:', responseText);
      result = responseText;
    }

    return res.status(200).json({
      success: true,
      message: 'Video sent and stored successfully',
      data: result
    });

  } catch (error) {
    console.error('[Outgoing Video Webhook] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send video to uChat',
      error: (error as Error).message
    });
  }
} 