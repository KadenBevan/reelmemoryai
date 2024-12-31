/**
 * Formats markdown text into Instagram-friendly format
 */
export class MessageFormatter {
  /**
   * Converts markdown text to Instagram-friendly format
   * @param text - The markdown text to convert
   * @returns Formatted text suitable for Instagram
   */
  public formatForInstagram(text: string): string {
    let formatted = text;

    // Convert headers (both # and **title** style)
    formatted = this.convertHeaders(formatted);

    // Convert lists
    formatted = this.convertLists(formatted);

    // Convert emphasis
    formatted = this.convertEmphasis(formatted);

    // Convert code blocks
    formatted = this.convertCodeBlocks(formatted);

    // Fix line breaks
    formatted = this.fixLineBreaks(formatted);

    // Clean up any remaining markdown artifacts
    formatted = this.cleanupMarkdown(formatted);

    return formatted.trim();
  }

  /**
   * Converts markdown headers to uppercase text
   */
  private convertHeaders(text: string): string {
    // Convert ATX-style headers (# Header)
    text = text.replace(/^#{1,6}\s+(.+)$/gm, (_, content) => {
      return content.toUpperCase() + '\n';
    });

    // Convert bold headers (**Header**)
    text = text.replace(/\*\*([^*\n]+)\*\*/g, (_, content) => {
      // Only convert to uppercase if it looks like a header (starts line or after newline)
      if (text.indexOf(_) === 0 || text[text.indexOf(_) - 1] === '\n') {
        return content.toUpperCase();
      }
      return content;
    });

    return text;
  }

  /**
   * Converts markdown lists to simple text lists
   */
  private convertLists(text: string): string {
    // Convert unordered lists
    text = text.replace(/^\s*[-*+]\s+(.+)$/gm, '- $1');

    // Convert ordered lists
    text = text.replace(/^\s*\d+\.\s+(.+)$/gm, (_, content, offset, str) => {
      // Count previous list items to determine number
      const prevLines = str.slice(0, offset).split('\n');
      let num = 1;
      for (let i = prevLines.length - 1; i >= 0; i--) {
        if (!/^\s*\d+\.\s+/.test(prevLines[i])) break;
        num++;
      }
      return `${num}. ${content}`;
    });

    return text;
  }

  /**
   * Converts markdown emphasis to uppercase
   */
  private convertEmphasis(text: string): string {
    // Convert bold text
    text = text.replace(/\*\*([^*\n]+)\*\*/g, (_, content) => {
      return content.toUpperCase();
    });

    // Convert italic text (only if not already converted as bold)
    text = text.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, (_, content) => {
      return content.toUpperCase();
    });

    // Convert underscore emphasis
    text = text.replace(/_([^_\n]+)_/g, (_, content) => {
      return content.toUpperCase();
    });

    return text;
  }

  /**
   * Converts markdown code blocks to plain text
   */
  private convertCodeBlocks(text: string): string {
    // Convert triple backtick code blocks
    text = text.replace(/```[\s\S]+?```/g, (block) => {
      return block
        .replace(/```\w*\n?/, '') // Remove opening fence
        .replace(/\n?```/, '')    // Remove closing fence
        .trim();
    });

    // Convert inline code
    text = text.replace(/`([^`]+)`/g, '$1');

    return text;
  }

  /**
   * Fixes line breaks for Instagram
   */
  private fixLineBreaks(text: string): string {
    // Add extra line breaks after headers
    text = text.replace(/([A-Z][A-Z\s]+[A-Z])(\n|$)/g, '$1\n\n');
    
    // Add extra line breaks between sections
    text = text.replace(/\n([A-Z][A-Z\s]+:)/g, '\n\n$1\n\n');
    
    // Format unordered lists
    text = text.replace(/^-\s*(.*)/gm, '- $1\n');
    
    // Format ordered lists - maintain numbering and ensure no extra line breaks
    let listItemCount = 0;
    text = text.split('\n').map(line => {
      const trimmedLine = line.trim();
      if (/^\d+\.\s*/.test(trimmedLine)) {
        listItemCount++;
        const content = trimmedLine.replace(/^\d+\.\s*/, '').trim();
        return `${listItemCount}. ${content}`;
      }
      if (trimmedLine === '') {
        listItemCount = 0;
      }
      return line;
    }).join('\n');
    
    // Add line break after list items but not between number and content
    text = text.replace(/^(\d+\.\s*.*)$/gm, '$1\n');
    
    // Add extra line break between lists and other content
    text = text.replace(/(\n(?:\d+\.\s*.*\n)+)\n*(?=[^-\d])/g, '$1\n');
    
    // Ensure paragraphs have proper spacing
    text = text.replace(/([.!?])\s+/g, '$1\n\n');
    
    // Clean up excessive line breaks
    text = text.replace(/\n{3,}/g, '\n\n');
    
    // Add extra line break before final message
    text = text.replace(/([^.\n])\s*(Enjoy.*)$/i, '$1\n\n$2');
    
    return text;
  }

  /**
   * Cleans up any remaining markdown artifacts
   */
  private cleanupMarkdown(text: string): string {
    // Remove markdown symbols while preserving line breaks
    text = text
      .replace(/[#*_`~\[\]]/g, '')                    // Remove markdown symbols
      .replace(/\n\s*[-=]{3,}/g, '\n---\n')          // Convert horizontal rules
      .replace(/[ \t]+$/gm, '')                       // Remove trailing spaces
      .replace(/^[ \t]+/gm, '')                       // Remove leading spaces
      .replace(/[ \t]+/g, ' ')                        // Normalize spaces (not newlines)
      .replace(/\n{3,}/g, '\n\n')                     // Normalize multiple line breaks
      .split('\n')                                    // Split into lines
      .map(line => line.trim())                       // Trim each line
      .join('\n');                                    // Rejoin with single line breaks

    return text;
  }
}

// Create singleton instance
export const messageFormatter = new MessageFormatter(); 