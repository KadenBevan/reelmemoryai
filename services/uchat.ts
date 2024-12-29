import { WEBHOOK_URLS } from '@/lib/messages/constants';

/**
 * Message payload for uChat
 */
interface MessagePayload {
  /** Message content */
  message: string;
  /** User namespace */
  namespace: string;
  /** Message type */
  type: string;
}

/**
 * Video payload for uChat
 */
interface VideoPayload {
  /** Video URL */
  url: string;
  /** User namespace */
  namespace: string;
  /** Message type */
  type: string;
}

/**
 * Sends a message through uChat
 * @param payload - Message payload
 */
export async function sendMessage(payload: MessagePayload): Promise<void> {
  console.log('[uChat] Sending message:', payload);
  
  try {
    const response = await fetch(WEBHOOK_URLS.MESSAGE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.error('[uChat] Error sending message:', {
        status: response.status,
        statusText: response.statusText,
        body: responseText
      });
      throw new Error(`Failed to send message: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json();
    console.log('[uChat] Message sent successfully:', responseData);
  } catch (error) {
    console.error('[uChat] Error sending message:', error);
    throw error;
  }
}

/**
 * Sends a video through uChat
 * @param payload - Video payload
 */
export async function sendVideo(payload: VideoPayload): Promise<void> {
  console.log('[uChat] Sending video:', payload);
  
  try {
    const response = await fetch(WEBHOOK_URLS.VIDEO, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.error('[uChat] Error sending video:', {
        status: response.status,
        statusText: response.statusText,
        body: responseText
      });
      throw new Error(`Failed to send video: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json();
    console.log('[uChat] Video sent successfully:', responseData);
  } catch (error) {
    console.error('[uChat] Error sending video:', error);
    throw error;
  }
} 