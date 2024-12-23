import React from 'react'
import Link from 'next/link'
import { Button } from './ui/button'
import { Logo } from '@/components/ui/Logo'
import { styles } from './Navbar.styles'

export default function Navbar(): JSX.Element {
  return (
    <nav className={styles.nav}>
      <div className={styles.container}>
        <div className={styles.wrapper}>
          <Link href="/" className={styles.logoLink}>
            <Logo width={100} className={styles.logoImage} />
          </Link>
          <Button>Sign In</Button>
        </div>
      </div>
    </nav>
  )
}

