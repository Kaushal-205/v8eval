'use client'

import Link from 'next/link'
import { HashTicker } from '@/components/HashTicker'
import { TrustBar } from '@/components/TrustBar'
import { WaitlistForm } from '@/components/WaitlistForm'
import { ScrollReveal } from '@/components/ScrollReveal'

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="hero" aria-labelledby="hero-headline">
        <div className="hero-inner">
          <div className="tee-badge">
            <span className="pulse-dot" aria-hidden="true" />
            Running on EigenCompute TEE
          </div>

          <h1 className="hero-headline" id="hero-headline">
            Prove your model works.<br className="hero-br" /> Keep your weights <em>private.</em>
          </h1>

          <p className="hero-sub">
            Independent AI model verification inside a Trusted Execution Environment.
            Your weights never leave the enclave — your results are cryptographically proven.
          </p>

          <div className="hero-ctas">
            <Link href="/verify" className="btn-hero-primary">
              Try live demo &rarr;
            </Link>
            <a href="#waitlist" className="btn-hero-ghost">
              Join the waitlist &rarr;
            </a>
          </div>

          <HashTicker />
        </div>
      </section>

      {/* Trust bar */}
      <TrustBar />

      {/* How it works */}
      <ScrollReveal>
        <section id="how-it-works" aria-labelledby="how-title">
          <div className="section">
            <p className="section-label reveal">Process</p>
            <h2 className="section-title reveal" id="how-title">Three steps to verified performance</h2>
            <p className="section-sub reveal">
              No black boxes. No self-reported numbers. Just cryptographic proof that your model performs as advertised.
            </p>

            <div className="steps-grid">
              <div className="step-card reveal">
                <p className="step-number">01</p>
                <div className="step-icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                    <line x1="8" y1="21" x2="16" y2="21"/>
                    <line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                </div>
                <h3 className="step-title">Submit your model</h3>
                <p className="step-desc">
                  Choose your model and benchmark suite. We support ARC, HellaSwag, MMLU, TruthfulQA, and more. Your weights stay private.
                </p>
              </div>

              <div className="step-card reveal reveal-delay-1">
                <p className="step-number">02</p>
                <div className="step-icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </div>
                <h3 className="step-title">We run the benchmarks</h3>
                <p className="step-desc">
                  Your eval executes in an EigenCompute Trusted Execution Environment — hardware-isolated, tamper-proof, fully auditable.
                </p>
              </div>

              <div className="step-card reveal reveal-delay-2">
                <p className="step-number">03</p>
                <div className="step-icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <h3 className="step-title">Share your proof</h3>
                <p className="step-desc">
                  Receive a cryptographically signed certificate with scores, timestamps, and Docker digest. Share it — anyone can verify it on-chain.
                </p>
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* Why it matters */}
      <ScrollReveal>
        <div className="why-wrap">
          <section className="why-section" id="why" aria-labelledby="why-title">
            <div className="section">
              <p className="section-label reveal">Use cases</p>
              <h2 className="section-title reveal" id="why-title">Why it matters</h2>
              <p className="section-sub reveal">
                Trust is infrastructure. v8eval lets AI companies prove their models work as advertised — without exposing weights.
              </p>

              <div className="why-grid">
                <div className="why-card reveal">
                  <div className="why-icon" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                    </svg>
                  </div>
                  <h3 className="why-title">Prove performance to customers</h3>
                  <p className="why-desc">
                    Vendor claims, independently verified. Enterprise buyers can demand cryptographic proof of benchmark scores before signing contracts.
                  </p>
                </div>

                <div className="why-card reveal reveal-delay-1">
                  <div className="why-icon" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                      <polyline points="10 9 9 9 8 9"/>
                    </svg>
                  </div>
                  <h3 className="why-title">Regulatory compliance</h3>
                  <p className="why-desc">
                    As AI regulation tightens globally, verifiable audit trails become a compliance requirement — not just a nice-to-have.
                  </p>
                </div>

                <div className="why-card reveal reveal-delay-2">
                  <div className="why-icon" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="1" x2="12" y2="23"/>
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                    </svg>
                  </div>
                  <h3 className="why-title">Competitive differentiation</h3>
                  <p className="why-desc">
                    Stand out with independently verified performance. Give investors and customers a verified, on-chain record they can trust — not a slide deck.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </ScrollReveal>

      {/* Waitlist */}
      <ScrollReveal>
        <WaitlistForm />
      </ScrollReveal>
    </>
  )
}
