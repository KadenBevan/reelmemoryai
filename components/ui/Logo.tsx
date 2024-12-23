import Image from 'next/image';
import { LogoProps } from '@/types/logo';

/**
 * Logo component that displays either the default or horizontal Reel Memory logo
 * 
 * @param {LogoProps} props - The component props
 * @returns {JSX.Element} The Logo component
 */
export function Logo({ 
  className = '',
  width = 150,
  height
}: LogoProps): JSX.Element {

  const logoSrc = '/assets/images/logo.png';

  // Default aspect ratios
  const aspectRatios = {
    default: 1, // Square logo
    horizontal: 3.5 // Horizontal logo is 3.5x wider than tall
  };

  return (
    <Image
      src={logoSrc}
      alt="Reel Memory Logo"
      width={width}
      height={20}
      className={className}
      priority // Logo is usually above the fold
    />
  );
} 