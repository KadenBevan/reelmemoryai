import fetch from 'node-fetch';
import { WEBHOOK_URLS, MESSAGES } from './constants';
import type { MessagePayload, VideoPayload, MessageResult, WebhookResponse } from './types';

/**
 * Service for handling message operations
 */
export class MessageService {
  /**
   * Sends a text message through the webhook
   * @param payload - The message payload
   * @returns Promise resolving to the message result
   */
  public async sendMessage(payload: MessagePayload): Promise<MessageResult> {
    try {
      console.log('[Message Service] Sending message:', {
        user_ns: payload.user_ns,
        type: payload.type,
        messageLength: payload.message.length,
        messagePreview: payload.message.substring(0, 50) + (payload.message.length > 50 ? '...' : '')
      });

      const response = await fetch(WEBHOOK_URLS.MESSAGE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      console.log('[Message Service] Webhook response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseText
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.status} ${response.statusText} - ${responseText}`);
      }

      let responseData: WebhookResponse;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        console.warn('[Message Service] Could not parse response as JSON:', responseText);
        responseData = {
          success: response.ok,
          message: responseText
        };
      }

      return {
        success: true,
        status: 'SENT',
        response: responseData
      };
    } catch (error) {
      console.error('[Message Service] Error sending message:', error);
      return {
        success: false,
        status: 'FAILED',
        error: (error as Error).message
      };
    }
  }

  /**
   * Sends a video through the webhook
   * @param payload - The video payload
   * @returns Promise resolving to the message result
   */
  public async sendVideo(payload: VideoPayload): Promise<MessageResult> {
    try {
      console.log('[Message Service] Sending video:', {
        user_ns: payload.user_ns,
        type: payload.type,
        url: payload.Url,
        urlLength: payload.Url.length
      });

      const response = await fetch(WEBHOOK_URLS.VIDEO, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      console.log('[Message Service] Video webhook response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseText
      });

      if (!response.ok) {
        throw new Error(`Failed to send video: ${response.status} ${response.statusText} - ${responseText}`);
      }

      let responseData: WebhookResponse;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        console.warn('[Message Service] Could not parse response as JSON:', responseText);
        responseData = {
          success: response.ok,
          message: responseText
        };
      }

      return {
        success: true,
        status: 'SENT',
        response: responseData
      };
    } catch (error) {
      console.error('[Message Service] Error sending video:', error);
      return {
        success: false,
        status: 'FAILED',
        error: (error as Error).message
      };
    }
  }

  /**
   * Sends a video received acknowledgment
   * @param userNs - User namespace
   * @returns Promise resolving to the message result
   */
  public async sendVideoReceivedAck(userNs: string): Promise<MessageResult> {
    return this.sendMessage({
      user_ns: userNs,
      message: MESSAGES.VIDEO_RECEIVED,
      type: 'ACKNOWLEDGMENT'
    });
  }

  /**
   * Sends a video saved confirmation
   * @param userNs - User namespace
   * @returns Promise resolving to the message result
   */
  public async sendVideoSavedConfirmation(userNs: string): Promise<MessageResult> {
    return this.sendMessage({
      user_ns: userNs,
      message: MESSAGES.VIDEO_PROCESSED,
      type: 'RESPONSE'
    });
  }

  /**
   * Sends a search started acknowledgment
   * @param userNs - User namespace
   * @returns Promise resolving to the message result
   */
  public async sendSearchStartedAck(userNs: string): Promise<MessageResult> {
    return this.sendMessage({
      user_ns: userNs,
      message: MESSAGES.SEARCH_STARTED,
      type: 'ACKNOWLEDGMENT'
    });
  }
} 