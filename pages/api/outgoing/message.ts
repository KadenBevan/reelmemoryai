import { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';
import { addOutgoingMessage } from '@/lib/firebase/webhook-store';
import { WEBHOOK_URLS } from '@/lib/messages/constants';

// Validate webhook URL
if (!WEBHOOK_URLS.MESSAGE) {
  console.error('[Outgoing Message Webhook] Missing webhook URL configuration');
  throw new Error('Missing webhook URL configuration');
}

interface MessagePayload {
  user_ns: string;
  message: string;
  type?: 'ANALYSIS_RESULT' | 'ACKNOWLEDGMENT' | 'ERROR' | 'OTHER';
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { message, user_ns = '', type = 'OTHER' } = req.body;
    
    if (!message) {
      return res.status(400).json({ 
        success: false,
        message: 'Missing required field: message' 
      });
    }

    const payload: MessagePayload = {
      user_ns,
      message,
      type
    };

    // Send to uChat webhook
    const response = await fetch(WEBHOOK_URLS.MESSAGE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to send message to uChat: ${response.statusText}`);
    }

    // Store the outgoing message in Firestore
    if (user_ns) {
      try {
        await addOutgoingMessage(user_ns, {
          text: message,
          timestamp: new Date(),
          messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: type
        });
        console.log('[Message Webhook] Outgoing message stored in Firestore:', user_ns);
      } catch (error) {
        console.error('[Message Webhook] Error storing outgoing message:', error);
        // Continue since message was sent successfully even if storage failed
      }
    }

    const result = await response.json();

    return res.status(200).json({
      success: true,
      message: 'Message sent and stored successfully',
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