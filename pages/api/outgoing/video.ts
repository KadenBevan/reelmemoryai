import { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';
import { addOutgoingVideo } from '@/lib/firebase/webhook-store';

// Constants for webhook URL
const UCHAT_VIDEO_WEBHOOK = 'https://www.uchat.com.au/api/iwh/6ac026ddc1abf197d00b6b8e11927f36';

interface VideoPayload {
  user_ns: string;
  Url: string;
  type?: 'ANALYSIS_RESULT' | 'OTHER';
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { url, user_ns = '', type = 'OTHER' } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        success: false,
        message: 'Missing required field: url' 
      });
    }

    const payload: VideoPayload = {
      user_ns,
      Url: url,
      type
    };

    // Send to uChat webhook
    const response = await fetch(UCHAT_VIDEO_WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to send video to uChat: ${response.statusText}`);
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
        console.log('[Video Webhook] Outgoing video stored in Firestore:', user_ns);
      } catch (error) {
        console.error('[Video Webhook] Error storing outgoing video:', error);
        // Continue since video was sent successfully even if storage failed
      }
    }

    const result = await response.json();

    return res.status(200).json({
      success: true,
      message: 'Video sent and stored successfully',
      data: result
    });

  } catch (error) {
    console.error('Error sending video to uChat:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send video to uChat',
      error: (error as Error).message
    });
  }
} 