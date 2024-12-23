import { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';

// Constants for webhook URL
const UCHAT_MESSAGE_WEBHOOK = 'https://www.uchat.com.au/api/iwh/e324707933d909f6b05adac82cfa920a';

interface MessagePayload {
  user_ns: string;
  message: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { message, user_ns = '' } = req.body;
    
    if (!message) {
      return res.status(400).json({ 
        success: false,
        message: 'Missing required field: message' 
      });
    }

    const payload: MessagePayload = {
      user_ns,
      message
    };

    // Send to uChat webhook
    const response = await fetch(UCHAT_MESSAGE_WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to send message to uChat: ${response.statusText}`);
    }

    const result = await response.json();

    return res.status(200).json({
      success: true,
      message: 'Message sent successfully',
      data: result
    });

  } catch (error) {
    console.error('Error sending message to uChat:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send message to uChat',
      error: (error as Error).message
    });
  }
} 