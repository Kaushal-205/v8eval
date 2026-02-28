'use client'

import { FormEvent, useRef, useState } from 'react'

export function WaitlistForm() {
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!formRef.current) return

    const data = new FormData(formRef.current)
    const name = (data.get('fullName') as string || '').trim()
    const email = (data.get('workEmail') as string || '').trim()
    const company = (data.get('company') as string || '').trim()

    if (!name || !email || !company) return

    setSending(true)
    setError('')

    const payload = {
      timestamp: new Date().toISOString(),
      fullName: name,
      workEmail: email,
      company,
      useCase: (data.get('useCase') as string || '').trim(),
      evalScale: data.get('evalScale') as string || '',
    }

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed')
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again.')
      setSending(false)
    }
  }

  return (
    <section id="waitlist" className="waitlist-section" aria-labelledby="waitlist-title">
      <div className="waitlist-inner">
        <p className="section-label reveal">Early access</p>
        <h2 className="section-title reveal" id="waitlist-title">Get early access</h2>
        <p className="section-sub reveal">
          We&apos;re onboarding a select group of enterprise teams. Tell us about your use case and we&apos;ll be in touch.
        </p>

        <div className={`form-card reveal${submitted ? ' submitted' : ''}`}>
          <div className="form-fields">
            <form ref={formRef} onSubmit={handleSubmit} noValidate>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="fullName">Full name</label>
                  <input className="form-input" type="text" id="fullName" name="fullName" placeholder="Jane Smith" required autoComplete="name" />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="workEmail">Work email</label>
                  <input className="form-input" type="email" id="workEmail" name="workEmail" placeholder="jane@company.com" required autoComplete="email" />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="company">Company</label>
                <input className="form-input" type="text" id="company" name="company" placeholder="Acme Corp" required autoComplete="organization" />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="useCase">Use case</label>
                <textarea className="form-textarea" id="useCase" name="useCase" placeholder="Tell us how you plan to use verifiable model verification, e.g. proving performance to customers, compliance reporting, competitive differentiation..." />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="evalScale">Expected eval scale</label>
                <select className="form-select" id="evalScale" name="evalScale" defaultValue="">
                  <option value="" disabled>Select an option</option>
                  <option value="prototyping">Just exploring / prototyping</option>
                  <option value="small">Small (&lt;100 evals/month)</option>
                  <option value="medium">Medium (100–1,000 evals/month)</option>
                  <option value="large">Large (1,000+ evals/month)</option>
                  <option value="enterprise">Enterprise (custom volume)</option>
                </select>
              </div>

              <button type="submit" className="btn-submit" disabled={sending}>
                {sending ? 'Sending...' : 'Request early access →'}
              </button>

              {error && (
                <p style={{ color: '#dc2626', fontSize: '0.82rem', marginTop: '10px', textAlign: 'center' }}>
                  {error}
                </p>
              )}
            </form>
          </div>

          <div className="form-success" style={submitted ? { display: 'block' } : undefined}>
            <div className="success-icon" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h3 className="success-title">You&apos;re on the list.</h3>
            <p className="success-sub">Thanks for your interest. We&apos;ll reach out as we open access to enterprise teams.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
