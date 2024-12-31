/**
 * Message templates for user communication
 */
export const MESSAGES = {
  /** Sent when a video is first received */
  VIDEO_RECEIVED: "I've received your video and will start processing it shortly.",
  
  /** Sent when video processing is complete */
  VIDEO_PROCESSED: "I've finished processing your video and it's now ready for searching!",
  
  /** Sent when a video is already in the system */
  VIDEO_ALREADY_PROCESSED: "I've already processed this video before. You can search for it now!",
  
  /** Sent when there's an error processing the video */
  VIDEO_PROCESSING_ERROR: "I encountered an error while processing your video. Please try again later.",
  
  /** Sent when a search request is received */
  SEARCH_STARTED: "I'm looking for videos that match your description...",
  
  /** Sent when no matching videos are found */
  VIDEO_NOT_FOUND: "I couldn't find any videos that match your description. Please try a different search.",

  /** Sent when a video is found */
  VIDEO_FOUND: "I found a video that matches your description. Let me send it to you!",

  /** Sent when there's an error retrieving the video */
  RETRIEVAL_ERROR: "I found a matching video but encountered an error while retrieving it. Please try again.",

  /** Sent when there's a general error */
  GENERAL_ERROR: "I encountered an error while processing your request. Please try again later.",

  /** Sent when video processing is in progress */
  VIDEO_PROCESSING: "I'm currently processing your video. This may take a few moments..."
};

// Alias for backward compatibility
export const MESSAGE_TEMPLATES = MESSAGES;

/**
 * Webhook URLs for uChat integration
 */
export const WEBHOOK_URLS = {
  /** URL for sending messages */
  MESSAGE: process.env.UCHAT_MESSAGE_WEBHOOK_URL || '',
  
  /** URL for sending videos */
  VIDEO: process.env.UCHAT_VIDEO_WEBHOOK_URL || ''
}; 