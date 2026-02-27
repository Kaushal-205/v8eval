'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { LogStream } from '@/components/LogStream'

interface ModelsData {
  models: string[]
  benchmarks: string[]
  sample_limits: string[]
  fewshot_options: string[]
}

interface PastRun {
  run_id: string
  model: string
  benchmarks: string[]
  timestamp_utc: string
  duration_seconds: number
  scores: Record<string, { metric: string; value: number | null }>
}

export default function VerifyPage() {
  const [config, setConfig] = useState<ModelsData | null>(null)
  const [model, setModel] = useState('')
  const [benchmarks, setBenchmarks] = useState<string[]>([])
  const [sampleLimit, setSampleLimit] = useState('')
  const [fewshot, setFewshot] = useState('')
  const [runId, setRunId] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [error, setError] = useState('')
  const [pastRuns, setPastRuns] = useState<PastRun[]>([])

  useEffect(() => {
    fetch('/api/models')
      .then((r) => r.json())
      .then((data: ModelsData) => {
        setConfig(data)
        if (data.models.length > 0) setModel(data.models[0])
        if (data.benchmarks.length > 0) setBenchmarks([data.benchmarks[0]])
        if (data.sample_limits.length > 0) setSampleLimit(data.sample_limits[0])
        if (data.fewshot_options.length > 0) setFewshot(data.fewshot_options[0])
      })
      .catch(() => setError('Failed to load model configuration.'))

    fetch('/api/runs')
      .then((r) => r.json())
      .then((data: { runs: PastRun[] }) => setPastRuns(data.runs))
      .catch(() => {})
  }, [])

  const toggleBenchmark = (b: string) => {
    setBenchmarks((prev) =>
      prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]
    )
  }

  const startRun = async () => {
    setError('')
    setRunning(true)
    setCompleted(false)
    setRunId(null)

    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          benchmarks,
          sample_limit: sampleLimit,
          num_fewshot: fewshot,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Failed to start evaluation.')
      }

      const data = await res.json()
      setRunId(data.run_id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start evaluation.')
      setRunning(false)
    }
  }

  const handleComplete = useCallback(() => {
    setRunning(false)
    setCompleted(true)
    // Refresh past runs list
    fetch('/api/runs')
      .then((r) => r.json())
      .then((data: { runs: PastRun[] }) => setPastRuns(data.runs))
      .catch(() => {})
  }, [])

  if (!config) {
    return (
      <div className="verify-page">
        <div className="loading-state">Loading configuration...</div>
      </div>
    )
  }

  return (
    <div className="verify-page">
      <h1 className="verify-title">Run Independent Verification</h1>
      <p className="verify-subtitle">
        Select a model and benchmarks to run inside a Trusted Execution Environment.
        Results are cryptographically signed and independently verifiable.
      </p>

      <div className="verify-form">
        <div className="form-group">
          <label className="form-label" htmlFor="model-select">Model</label>
          <select
            className="form-select"
            id="model-select"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={running}
          >
            {config.models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Benchmarks</label>
          <div className="checkbox-group">
            {config.benchmarks.map((b) => (
              <label key={b} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={benchmarks.includes(b)}
                  onChange={() => toggleBenchmark(b)}
                  disabled={running}
                />
                {b}
              </label>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="sample-limit">Sample limit</label>
          <select
            className="form-select"
            id="sample-limit"
            value={sampleLimit}
            onChange={(e) => setSampleLimit(e.target.value)}
            disabled={running}
          >
            {config.sample_limits.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="fewshot">Few-shot</label>
          <select
            className="form-select"
            id="fewshot"
            value={fewshot}
            onChange={(e) => setFewshot(e.target.value)}
            disabled={running}
          >
            {config.fewshot_options.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        <button
          className="btn-run"
          onClick={startRun}
          disabled={running || benchmarks.length === 0}
        >
          {running ? 'Running evaluation...' : 'Run Independent Verification'}
        </button>

        {error && (
          <p style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '12px', textAlign: 'center' }}>
            {error}
          </p>
        )}
      </div>

      {runId && <LogStream runId={runId} onComplete={handleComplete} />}

      {completed && runId && (
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <Link href={`/proof/${runId}`} className="btn-hero-primary" style={{ display: 'inline-flex' }}>
            View Verification Proof &rarr;
          </Link>
        </div>
      )}

      {/* Previous runs */}
      {pastRuns.length > 0 && (
        <div className="past-runs">
          <h2 className="past-runs-title">Previous Runs</h2>
          <div className="past-runs-list">
            {pastRuns.map((run) => {
              const scoreEntries = Object.entries(run.scores)
              return (
                <Link key={run.run_id} href={`/proof/${run.run_id}`} className="past-run-row">
                  <div className="past-run-model">{run.model.split('/')[1] ?? run.model}</div>
                  <div className="past-run-benchmarks">{run.benchmarks.join(', ')}</div>
                  <div className="past-run-scores">
                    {scoreEntries.map(([task, s]) => (
                      <span key={task} className="past-run-score">
                        {task}: {s.value != null ? `${(s.value * 100).toFixed(1)}%` : 'N/A'}
                      </span>
                    ))}
                  </div>
                  <div className="past-run-meta">
                    {run.timestamp_utc} &middot; {run.duration_seconds}s
                  </div>
                  <span className="past-run-link">View proof &rarr;</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
