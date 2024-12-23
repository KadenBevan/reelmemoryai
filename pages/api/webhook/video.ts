import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { GeminiService, AnalysisMode } from '../../../services/gemini';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';

// Constants for webhook URLs
const UCHAT_MESSAGE_WEBHOOK = 'https://www.uchat.com.au/api/iwh/e324707933d909f6b05adac82cfa920a';
const MAX_MESSAGE_LENGTH = 950;

// Add acknowledgment message constant
const ACKNOWLEDGMENT_MESSAGE = "I've received your video and I'm analyzing it now. I'll send you the results in just a moment! 🎥✨";

interface VideoWebhookBody {
  videoUrl: string;
  name: string;
  username: string;
  InstaId: string;
  userNS?: string;
}

// Function to split message into chunks
const splitMessageIntoChunks = (message: string, maxLength: number = MAX_MESSAGE_LENGTH): string[] => {
  const chunks: string[] = [];
  let currentChunk = '';
  
  // Split message into lines to avoid breaking in the middle of a line
  const lines = message.split('\n');
  
  for (const line of lines) {
    // If adding this line would exceed maxLength, push current chunk and start new one
    if (currentChunk.length + line.length + 1 > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      
      // If single line is longer than maxLength, split it
      if (line.length > maxLength) {
        let remainingLine = line;
        while (remainingLine.length > 0) {
          const chunk = remainingLine.slice(0, maxLength);
          chunks.push(chunk.trim());
          remainingLine = remainingLine.slice(maxLength);
        }
      } else {
        currentChunk = line;
      }
    } else {
      // Add line to current chunk
      currentChunk = currentChunk ? `${currentChunk}\n${line}` : line;
    }
  }
  
  // Push final chunk if exists
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
};

// Function to send message chunks to uChat
const sendMessageChunks = async (userNS: string, chunks: string[]): Promise<void> => {
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const isFirstChunk = i === 0;
    const isLastChunk = i === chunks.length - 1;
    
    // Add part number if multiple chunks
    const messagePrefix = chunks.length > 1 ? `Part ${i + 1}/${chunks.length}:\n` : '';
    const message = isFirstChunk 
      ? `Here's what I found in your video:\n\n${messagePrefix}${chunk}`
      : `${messagePrefix}${chunk}`;
    
    try {
      await fetch(UCHAT_MESSAGE_WEBHOOK, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_ns: userNS,
          message
        }),
      });
      
      // Small delay between messages to maintain order
      if (!isLastChunk) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`[Video Webhook] Error sending message chunk ${i + 1}:`, error);
      throw error;
    }
  }
};

const logToFile = async (message: string, filename: string) => {
  const logFile = path.join(process.cwd(), filename);
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp}: ${message}\n`;
  await fs.appendFile(logFile, logMessage).catch(console.error);
}

const downloadVideo = async (videoUrl: string, fileExt: string): Promise<string> => {
  try {
    const encodedUrl = encodeURI(decodeURI(videoUrl));
    await logToFile(`Attempting to fetch video from: ${encodedUrl}`, 'gemini-analysis-logs.txt');

    const urlObj = new URL(encodedUrl);
    await logToFile(`Video URL details:
      - Asset ID: ${urlObj.searchParams.get('asset_id')}
      - Signature Length: ${urlObj.searchParams.get('signature')?.length}
      - Full URL Length: ${encodedUrl.length}`, 'gemini-analysis-logs.txt');

    const response = await fetch(encodedUrl, {
      headers: {
        'Accept': '*/*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        'Origin': 'https://www.facebook.com',
        'Referer': 'https://www.facebook.com/',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive'
      },
      redirect: 'follow',
      follow: 20
    });
    
    if (!response.ok) {
      const responseDetails = {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        finalUrl: response.url,
        body: await response.text().catch(() => 'No response body')
      };
      
      await logToFile(`Fetch error details: ${JSON.stringify(responseDetails, null, 2)}`, 'gemini-analysis-logs.txt');
      
      if (response.status === 404 && responseDetails.body === 'Resource not available') {
        throw new Error(`Video no longer available on Instagram's CDN. This can happen if the video was deleted, expired, or has restricted access. Asset ID: ${urlObj.searchParams.get('asset_id')}`);
      }
      
      throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const filename = `${uuidv4()}.${fileExt}`;
    const tempDir = path.join(process.cwd(), 'temp_videos');
    const localPath = path.join(tempDir, filename);

    // Ensure temp directory exists
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }

    await fs.writeFile(localPath, Buffer.from(buffer));
    await logToFile(`Successfully downloaded video to: ${localPath}`, 'gemini-analysis-logs.txt');
    return localPath;
  } catch (error) {
    await logToFile(`Error downloading video: ${error}`, 'gemini-analysis-logs.txt');
    throw error;
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const requestLog = {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString(),
    headers: {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent']
    }
  };
  
  console.log('[Video Webhook] Request received:', requestLog);
  await logToFile(`Request received: ${JSON.stringify(requestLog)}`, 'webhook-logs.txt');

  if (req.method !== 'POST') {
    const errorMsg = `Error: Invalid method: ${req.method}`;
    console.log('[Video Webhook] ' + errorMsg);
    await logToFile(errorMsg, 'webhook-logs.txt');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const body = req.body as VideoWebhookBody;
    const bodyLog = {
      timestamp: new Date().toISOString(),
      data: body
    };
    
    console.log('[Video Webhook] Request body:', bodyLog);
    logToFile(`Request body: ${JSON.stringify(bodyLog)}`, 'webhook-logs.txt');

    if (!body.videoUrl?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'No video URL provided'
      });
    }

    // Send immediate acknowledgment if userNS is provided
    if (body.userNS) {
      try {
        await fetch(UCHAT_MESSAGE_WEBHOOK, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_ns: body.userNS,
            message: ACKNOWLEDGMENT_MESSAGE
          }),
        });
        console.log('[Video Webhook] Sent acknowledgment message to user:', body.userNS);
        await logToFile(`Sent acknowledgment message to user: ${body.userNS}`, 'webhook-logs.txt');
      } catch (error) {
        console.error('[Video Webhook] Error sending acknowledgment message:', error);
        await logToFile(`Error sending acknowledgment message: ${error}`, 'webhook-logs.txt');
        // Continue processing even if acknowledgment fails
      }
    }

    let localFilePath: string | undefined;
    
    try {
      // Initialize Gemini service
      const geminiService = new GeminiService();
      
      // Create analysis log entry
      const analysisEntry = {
        timestamp: new Date().toISOString(),
        user: {
          name: body.name,
          username: body.username,
          InstaId: body.InstaId
        },
        videoUrl: body.videoUrl.trim(),
        status: 'downloading'
      };
      
      // Log the start of download
      logToFile(`Starting download: ${JSON.stringify(analysisEntry)}`, 'gemini-analysis-logs.txt');

      // Determine file extension from URL
      const fileExt = path.extname(new URL(body.videoUrl.trim()).pathname).slice(1) || 'mp4';
      
      // Download video using the downloadVideo function
      localFilePath = await downloadVideo(body.videoUrl.trim(), fileExt);

      const analysisEntryAfterDownload = {
        ...analysisEntry,
        localPath: localFilePath,
        status: 'analyzing'
      };

      // Log the start of analysis
      logToFile(`Starting analysis: ${JSON.stringify(analysisEntryAfterDownload)}`, 'gemini-analysis-logs.txt');

      // Perform video analysis
      const videoAnalysis = await geminiService.analyzeVideoWithUpload(
        localFilePath,
        `video/${fileExt}`,
        AnalysisMode.RECIPE
      );

      // Send analysis back to uChat
      if (body.userNS) {
        try {
          // Format the analysis
          const analysisText = typeof videoAnalysis === 'string' 
            ? videoAnalysis 
            : JSON.stringify(videoAnalysis, null, 2);
          
          // Split into chunks and send
          const chunks = splitMessageIntoChunks(analysisText);
          await sendMessageChunks(body.userNS, chunks);

          console.log('[Video Webhook] Analysis sent to user:', { 
            userNS: body.userNS,
            numberOfChunks: chunks.length 
          });
          await logToFile(`Analysis sent to user: ${body.userNS} in ${chunks.length} chunks`, 'webhook-logs.txt');
        } catch (error) {
          console.error('[Video Webhook] Error sending analysis to uChat:', error);
          await logToFile(`Error sending analysis to uChat: ${error}`, 'webhook-logs.txt');
          
          // Try to send error message to user
          try {
            await fetch(UCHAT_MESSAGE_WEBHOOK, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                user_ns: body.userNS,
                message: "I apologize, but I encountered an error while trying to send you the video analysis. Please try again."
              }),
            });
          } catch (sendError) {
            console.error('[Video Webhook] Error sending error message to user:', sendError);
          }
        }
      }

      // Create complete analysis log
      const completeAnalysis = {
        ...analysisEntryAfterDownload,
        analysis: videoAnalysis,
        userNS: body.userNS,
        status: 'success'
      };

      // Log the analysis results
      console.log('[Video Webhook] Video analysis completed:', completeAnalysis);
      logToFile(`Analysis completed: ${JSON.stringify(completeAnalysis)}`, 'gemini-analysis-logs.txt');

      return res.status(200).json({
        success: true,
        message: 'Video processed successfully',
        analysis: videoAnalysis
      });
    } catch (error) {
      const errorAnalysis = {
        timestamp: new Date().toISOString(),
        user: {
          name: body.name,
          username: body.username,
          InstaId: body.InstaId,
          userNS: body.userNS
        },
        videoUrl: body.videoUrl.trim(),
        error: (error as Error).message,
        status: 'failed'
      };

      console.error('[Video Webhook] Video analysis error:', error);
      logToFile(`Analysis error: ${JSON.stringify(errorAnalysis)}`, 'gemini-analysis-logs.txt');
      
      // Send error back to uChat if userNS is provided
      if (body.userNS) {
        try {
          await fetch(UCHAT_MESSAGE_WEBHOOK, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_ns: body.userNS,
              message: `Error analyzing video: ${(error as Error).message}`
            }),
          });
        } catch (sendError) {
          console.error('[Video Webhook] Error sending error message to uChat:', sendError);
          await logToFile(`Error sending error message to uChat: ${sendError}`, 'webhook-logs.txt');
        }
      }

      return res.status(500).json({
        success: false,
        message: 'Error analyzing video',
        error: (error as Error).message
      });
    } finally {
      // Clean up: Delete the temporary file
      if (localFilePath) {
        try {
          await fs.unlink(localFilePath);
          console.log(`[Video Webhook] Deleted file: ${localFilePath}`);
        } catch (error) {
          console.error(`[Video Webhook] Error deleting file: ${localFilePath}`, error);
        }
      }
    }
  } catch (error) {
    const errorMsg = `Error processing request: ${error}`;
    console.error('[Video Webhook] ' + errorMsg);
    await logToFile(errorMsg, 'webhook-logs.txt');
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
} 