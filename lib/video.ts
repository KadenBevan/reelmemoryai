import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';

/**
 * Downloads a video from a URL to a temporary file
 * @param url - URL of the video to download
 * @returns Promise resolving to the path of the downloaded file
 */
export async function downloadVideo(url: string): Promise<string> {
  console.log('[Video Download] Attempting to fetch video from:', url);

  // Parse URL for logging
  try {
    const urlObj = new URL(url);
    const assetId = urlObj.searchParams.get('asset_id');
    const signature = urlObj.searchParams.get('signature');
    
    console.log('[Video Download] Video URL details:', {
      'Asset ID': assetId,
      'Signature Length': signature?.length,
      'Full URL Length': url.length
    });
  } catch (error) {
    console.warn('[Video Download] Could not parse URL for logging:', error);
  }

  // Download video
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
  }

  // Create temp directory if it doesn't exist
  const tempDir = path.join(process.cwd(), 'temp_videos');
  await fs.mkdir(tempDir, { recursive: true });

  // Save to temp file
  const tempPath = path.join(tempDir, `${uuidv4()}.mp4`);
  const buffer = await response.buffer();
  await fs.writeFile(tempPath, buffer);

  console.log('[Video Download] Successfully downloaded video to:', tempPath);
  return tempPath;
} 