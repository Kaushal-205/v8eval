'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, usePathname } from 'next/navigation'
import { VerifyBadge } from '@/components/VerifyBadge'
import { ScoreCard } from '@/components/ScoreCard'

interface ScoreCardData {
  task: string
  display_name: string
  score_display: string
  metric_name: string
  num_fewshot: number
  sample_label: string
  reference?: { score: number; shots: number; source: string } | null
  raw_value: number | null
}

interface ResultData {
  project: string
  version: string
  timestamp_utc: string
  model: string
  benchmarks: string[]
  scores: Record<string, { metric: string; value: number }>
  score_cards: ScoreCardData[]
  runtime: {
    num_fewshot: number
    quantization_mode: string
    fallback_used: boolean
    duration_seconds: number
    limit: string
  }
  verification: {
    tee_claim: string
    signer_address: string
    message_hash_sha256: string
    signature_hex: string
    app_address: string
    docker_image_digest: string
  }
  raw_lm_eval: Record<string, unknown>
}

function ProofContent() {
  const searchParams = useSearchParams()
  const pathname = usePathname()

  // Support both /proof?id=xxx and /proof/xxx (served by FastAPI catch-all)
  const pathSegments = pathname.split('/').filter(Boolean)
  const runId = searchParams.get('id') || (pathSegments.length > 1 ? pathSegments[1] : null)
  const [result, setResult] = useState<ResultData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!runId) {
      setError('No run ID provided. Use /proof?id=<run_id>')
      setLoading(false)
      return
    }

    const fetchResult = async () => {
      try {
        const res = await fetch(`/api/result/${runId}`)
        if (res.status === 202) {
          setTimeout(fetchResult, 2000)
          return
        }
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.detail || 'Failed to load results.')
        }
        const data = await res.json()
        setResult(data)
        setLoading(false)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load results.')
        setLoading(false)
      }
    }

    fetchResult()
  }, [runId])

  const copyReport = () => {
    if (!result) return
    navigator.clipboard.writeText(JSON.stringify(result, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="proof-page">
        <div className="loading-state">
          <p>Loading verification proof...</p>
        </div>
      </div>
    )
  }

  if (error || !result) {
    return (
      <div className="proof-page">
        <div className="error-state">
          <h2 style={{ marginBottom: '8px' }}>Proof not found</h2>
          <p>{error || 'This evaluation result could not be found.'}</p>
        </div>
      </div>
    )
  }

  const v = result.verification

  return (
    <div className="proof-page">
      <VerifyBadge />

      <h1 className="verify-title" style={{ marginBottom: '4px' }}>
        Verification Proof
      </h1>
      <p className="verify-subtitle">
        Model: <strong>{result.model}</strong> &middot; Completed: {result.timestamp_utc} &middot; Duration: {result.runtime.duration_seconds}s
      </p>

      <div className="score-grid">
        {result.score_cards.map((card) => (
          <ScoreCard
            key={card.task}
            displayName={card.display_name}
            scoreDisplay={card.score_display}
            metricName={card.metric_name}
            numFewshot={card.num_fewshot}
            sampleLabel={card.sample_label}
            reference={card.reference}
          />
        ))}
      </div>

      <div className="signature-block">
        <h3>Signature Details</h3>

        <div className="sig-row">
          <span className="sig-label">Signer Address</span>
          <span className="sig-value">{v.signer_address || 'N/A'}</span>
        </div>

        <div className="sig-row">
          <span className="sig-label">Message Hash (SHA-256)</span>
          <span className="sig-value">{v.message_hash_sha256 || 'N/A'}</span>
        </div>

        <div className="sig-row">
          <span className="sig-label">Signature</span>
          <span className="sig-value">{v.signature_hex || 'N/A'}</span>
        </div>

        <div className="sig-row">
          <span className="sig-label">Timestamp (UTC)</span>
          <span className="sig-value">{result.timestamp_utc}</span>
        </div>

        <div className="sig-row">
          <span className="sig-label">App Address</span>
          <span className="sig-value">{v.app_address}</span>
        </div>

        <div className="sig-row">
          <span className="sig-label">Docker Image Digest</span>
          <span className="sig-value">{v.docker_image_digest}</span>
        </div>
      </div>

      <div className="tee-claim">{v.tee_claim}</div>

      <button className="btn-copy" onClick={copyReport}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        {copied ? 'Copied!' : 'Copy Report JSON'}
      </button>
    </div>
  )
}

export default function ProofPage() {
  return (
    <Suspense fallback={<div className="proof-page"><div className="loading-state">Loading...</div></div>}>
      <ProofContent />
    </Suspense>
  )
}
