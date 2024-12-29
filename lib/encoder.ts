/**
 * Safely encodes text to tokens
 * @param text - Text to encode
 * @returns Array of token numbers
 */
export async function encode(text: string): Promise<number[]> {
  try {
    const { encode: gptEncode } = await import('gpt-3-encoder');
    return gptEncode(text);
  } catch (error) {
    console.warn('[Encoder] Failed to encode text:', error);
    return [];
  }
}

/**
 * Safely decodes tokens to text
 * @param tokens - Array of token numbers to decode
 * @returns Decoded text
 */
export async function decode(tokens: number[]): Promise<string> {
  try {
    const { decode: gptDecode } = await import('gpt-3-encoder');
    return gptDecode(tokens);
  } catch (error) {
    console.warn('[Encoder] Failed to decode tokens:', error);
    return '';
  }
}

/**
 * Gets token count for text
 * @param text - Text to count tokens for
 * @returns Number of tokens
 */
export async function getTokenCount(text: string): Promise<number> {
  try {
    const tokens = await encode(text);
    return tokens.length;
  } catch (error) {
    console.warn('[Encoder] Failed to count tokens:', error);
    return 0;
  }
} 