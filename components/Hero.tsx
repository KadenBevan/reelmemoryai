import { Button } from '@/components/ui/button'
import { styles } from './Hero.styles'

interface HeroProps {
  onSignUp: () => void
}

export default function Hero({ onSignUp }: HeroProps) {
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.contentWrapper}>
          <h1 className={styles.heading}>
            Organize Your Media with AI
          </h1>
          <p className={styles.description}>
            Reel Memory AI helps you effortlessly manage and retrieve your photos and videos using cutting-edge artificial intelligence.
          </p>
          <Button 
            onClick={onSignUp} 
            size="lg" 
            className={styles.button}
          >
            Get Started
          </Button>
        </div>
      </div>
    </section>
  )
}

