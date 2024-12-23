export interface LogoProps {
  /**
   * The variant of the logo to display
   */
  variant?: 'default' | 'horizontal';
  
  /**
   * Optional className for custom styling
   */
  className?: string;
  
  /**
   * Width of the logo in pixels
   * @default 150
   */
  width?: number;
  
  /**
   * Height of the logo in pixels
   * @default calculated based on aspect ratio
   */
  height?: number;
} 