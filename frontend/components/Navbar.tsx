'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from './ThemeToggle'

export function Navbar() {
  const pathname = usePathname()
  const isLanding = pathname === '/'

  return (
    <nav aria-label="Main navigation">
      <Link href="/" className="nav-logo">
        v<span>8</span>eval
      </Link>

      <div className="nav-links">
        {isLanding ? (
          <>
            <a href="#how-it-works">How it works</a>
            <a href="#why">Why v8eval</a>
          </>
        ) : (
          <Link href="/">Home</Link>
        )}
      </div>

      <div className="nav-spacer" />

      <ThemeToggle />

      <Link href="/verify" className="nav-demo">
        Verify a model
      </Link>

      {isLanding ? (
        <a href="#waitlist" className="btn-pill">Join Waitlist</a>
      ) : (
        <Link href="/#waitlist" className="btn-pill">Join Waitlist</Link>
      )}
    </nav>
  )
}
