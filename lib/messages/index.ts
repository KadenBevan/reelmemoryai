/**
 * @fileoverview Message system exports
 */

export * from './constants';
export * from './types';
export * from './service';

// Create singleton instance
import { MessageService } from './service';
export const messageService = new MessageService(); 