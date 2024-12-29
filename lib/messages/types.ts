/**
 * Base interface for all webhook payloads
 */
export interface BaseWebhookPayload {
  /** User namespace identifier */
  user_ns: string;
}

/**
 * Payload for sending text messages
 * @extends BaseWebhookPayload
 */
export interface MessagePayload extends BaseWebhookPayload {
  /** The text message to send */
  message: string;
  /** Optional message type */
  type?: 'ACKNOWLEDGMENT' | 'ERROR' | 'RESPONSE';
}

/**
 * Payload for sending videos
 * @extends BaseWebhookPayload
 */
export interface VideoPayload extends BaseWebhookPayload {
  /** The URL of the video to send */
  Url: string;
  /** The type of video being sent */
  type?: 'ANALYSIS_RESULT' | 'OTHER';
}

/**
 * Response from webhook endpoints
 */
export interface WebhookResponse {
  /** Whether the operation was successful */
  success: boolean;
  /** Response message */
  message: string;
  /** Optional response data */
  data?: unknown;
}

/**
 * Message operation status
 */
export type MessageStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED';

/**
 * Message operation result
 */
export interface MessageResult {
  /** Operation success status */
  success: boolean;
  /** Status of the message */
  status: MessageStatus;
  /** Error message if any */
  error?: string;
  /** Response data if any */
  response?: WebhookResponse;
} 