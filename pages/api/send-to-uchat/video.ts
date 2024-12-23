import { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';

// Constants for webhook URL
const UCHAT_VIDEO_WEBHOOK = 'https://www.uchat.com.au/api/iwh/6ac026ddc1abf197d00b6b8e11927f36';

interface VideoPayload {
  user_ns: string;
  Url: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { url, user_ns = '' } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        success: false,
        message: 'Missing required field: url' 
      });
    }

    const payload: VideoPayload = {
      user_ns,
      Url: url
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

    const result = await response.json();

    return res.status(200).json({
      success: true,
      message: 'Video sent successfully',
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