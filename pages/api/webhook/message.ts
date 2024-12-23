import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';

interface MessageWebhookBody {
  name: string;
  username: string;
  InstaId: string;
  InstaMsgTxt: string;
  userNS?: string;
}

const logToFile = async (message: string, filename: string) => {
  const logFile = path.join(process.cwd(), filename);
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp}: ${message}\n`;
  await fs.appendFile(logFile, logMessage).catch(console.error);
}

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
  
  console.log('[Message Webhook] Request received:', requestLog);
  await logToFile(`Request received: ${JSON.stringify(requestLog)}`, 'webhook-logs.txt');

  if (req.method !== 'POST') {
    const errorMsg = `Error: Invalid method: ${req.method}`;
    console.log('[Message Webhook] ' + errorMsg);
    await logToFile(errorMsg, 'webhook-logs.txt');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const body = req.body as MessageWebhookBody;
    const bodyLog = {
      timestamp: new Date().toISOString(),
      data: body
    };
    
    console.log('[Message Webhook] Request body:', bodyLog);
    logToFile(`Request body: ${JSON.stringify(bodyLog)}`, 'webhook-logs.txt');

    if (!body.InstaMsgTxt?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'No message text provided'
      });
    }

    // Process the message here
    // For now, we'll just log it and return success
    const messageLog = {
      timestamp: new Date().toISOString(),
      user: {
        name: body.name,
        username: body.username,
        InstaId: body.InstaId,
        userNS: body.userNS
      },
      message: body.InstaMsgTxt.trim()
    };

    console.log('[Message Webhook] Message received:', messageLog);
    await logToFile(`Message received: ${JSON.stringify(messageLog)}`, 'webhook-logs.txt');

    return res.status(200).json({
      success: true,
      message: 'Message received successfully'
    });

  } catch (error) {
    const errorMsg = `Error processing request: ${error}`;
    console.error('[Message Webhook] ' + errorMsg);
    await logToFile(errorMsg, 'webhook-logs.txt');
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
} 