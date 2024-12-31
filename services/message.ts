import { WEBHOOK_URLS } from '@/lib/messages/constants';
import fetch from 'node-fetch';
import { addOutgoingMessage } from '@/lib/firebase/webhook-store';

const MAX_MESSAGE_LENGTH = 950;

export class MessageService {
  private static instance: MessageService;
  private static instancePromise: Promise<MessageService> | null = null;

  private constructor() {}

  public static async getInstance(): Promise<MessageService> {
    if (!MessageService.instancePromise) {
      MessageService.instancePromise = (async () => {
        if (!MessageService.instance) {
          MessageService.instance = new MessageService();
          await MessageService.instance.initialize();
        }
        return MessageService.instance;
      })();
    }
    return MessageService.instancePromise;
  }

  private async initialize(): Promise<void> {
    // Verify webhook URLs are available
    if (!WEBHOOK_URLS || !WEBHOOK_URLS.MESSAGE) {
      throw new Error('Webhook URLs not properly configured');
    }
    console.log('[Message Service] Initialized');
  }

  private async sendWebhookMessage(userId: string, message: string, type: string = 'OTHER'): Promise<void> {
    try {
      console.log(`[Message Service] Sending webhook message to user ${userId}:`, message);
      
      // Ensure message is a string
      const messageText = typeof message === 'string' ? message : String(message);
      
      const response = await fetch(WEBHOOK_URLS.MESSAGE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_ns: userId,
          message: messageText,
          type
        }),
      });

      const responseText = await response.text();
      console.log('[Message Service] Webhook response:', {
        status: response.status,
        statusText: response.statusText,
        body: responseText
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.status} ${response.statusText} - ${responseText}`);
      }

      // Store the outgoing message in Firestore
      await addOutgoingMessage(userId, {
        text: messageText,
        timestamp: new Date(),
        messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: type as any
      });
      console.log('[Message Service] Message stored in Firestore:', userId);

    } catch (error) {
      console.error('[Message Service] Error sending webhook message:', error);
      throw error;
    }
  }

  // Public method for other services to use
  public async sendMessage(userId: string, message: string): Promise<void> {
    await this.sendWebhookMessage(userId, message, 'OTHER');
  }

  public async sendSearchAcknowledgment(userId: string): Promise<void> {
    await this.sendWebhookMessage(userId, "I'm searching through your videos...", 'ACKNOWLEDGMENT');
  }

  public async sendVideoFoundNotification(userId: string): Promise<void> {
    await this.sendWebhookMessage(userId, "I found a relevant video! Sending it now...", 'ACKNOWLEDGMENT');
  }

  public async sendVideo(userId: string, videoUrl: string): Promise<void> {
    try {
      console.log(`[Message Service] Sending video to user ${userId}:`, videoUrl);
      
      const response = await fetch(WEBHOOK_URLS.VIDEO, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_ns: userId,
          url: videoUrl,
          type: 'ANALYSIS_RESULT'
        }),
      });

      const responseText = await response.text();
      console.log('[Message Service] Video webhook response:', {
        status: response.status,
        statusText: response.statusText,
        body: responseText
      });

      if (!response.ok) {
        throw new Error(`Failed to send video: ${response.status} ${response.statusText} - ${responseText}`);
      }

    } catch (error) {
      console.error('[Message Service] Error sending video:', error);
      throw error;
    }
  }

  public async sendNoResultsMessage(userId: string): Promise<void> {
    await this.sendWebhookMessage(userId, "I couldn't find any relevant videos for your query.", 'OTHER');
  }

  public async sendTextResponse(userId: string, response: string | Function): Promise<void> {
    // Convert function to string representation if needed
    const responseText = typeof response === 'function' ? 
      'Function response not supported' : 
      String(response);
    
    // Split long responses into chunks if needed
    const chunks = this.splitLongMessage(responseText);
    for (const chunk of chunks) {
      await this.sendWebhookMessage(userId, chunk, 'ANALYSIS_RESULT');
    }
  }

  private splitLongMessage(message: string): string[] {
    if (message.length <= MAX_MESSAGE_LENGTH) {
      return [message];
    }

    const chunks: string[] = [];
    let currentChunk = '';
    const words = message.split(' ');

    for (const word of words) {
      if ((currentChunk + ' ' + word).length <= MAX_MESSAGE_LENGTH) {
        currentChunk += (currentChunk ? ' ' : '') + word;
      } else {
        chunks.push(currentChunk);
        currentChunk = word;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }
} 