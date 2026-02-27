'use client'

import { useEffect, useRef, useState } from 'react'

interface LogStreamProps {
  runId: string
  onComplete: () => void
}

export function LogStream({ runId, onComplete }: LogStreamProps) {
  const [logs, setLogs] = useState<string[]>([])
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('connecting')
  const [lineCount, setLineCount] = useState(0)
  const logEndRef = useRef<HTMLDivElement>(null)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function connectSSE() {
      try {
        const url = `/api/stream/${runId}`
        console.log('[v8eval] Fetching SSE:', url)

        const res = await fetch(url, {
          signal: controller.signal,
          headers: { 'Accept': 'text/event-stream' },
        })

        console.log('[v8eval] SSE response status:', res.status, 'type:', res.headers.get('content-type'))

        if (!res.ok || !res.body) {
          console.error('[v8eval] SSE bad response:', res.status)
          setStatus('failed')
          return
        }

        setStatus('running')

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (!cancelled) {
          const { value, done } = await reader.read()
          if (done) {
            console.log('[v8eval] SSE stream ended')
            break
          }

          buffer += decoder.decode(value, { stream: true })

          // Process complete SSE messages (separated by double newline)
          const parts = buffer.split('\n\n')
          buffer = parts.pop() || ''

          for (const part of parts) {
            const trimmed = part.trim()
            if (!trimmed || trimmed.startsWith(':')) continue // skip empty / comments

            // Extract data from "data: {...}" lines
            const dataLine = trimmed.split('\n').find(l => l.startsWith('data:'))
            if (!dataLine) continue

            const jsonStr = dataLine.slice(5).trim()
            try {
              const msg = JSON.parse(jsonStr)
              if (msg.t === 'log') {
                setLogs((prev) => [...prev, msg.d])
              } else if (msg.t === 'progress') {
                setProgress(msg.p)
                setStatus(msg.s)
                setLineCount(msg.n)
              } else if (msg.t === 'done') {
                console.log('[v8eval] SSE done event')
                cancelled = true
                onCompleteRef.current()
                return
              } else if (msg.t === 'error') {
                console.error('[v8eval] SSE error:', msg.d)
                setLogs((prev) => [...prev, `Error: ${msg.d}`])
                setStatus('failed')
                cancelled = true
                return
              }
            } catch {
              console.log('[v8eval] SSE parse skip:', jsonStr.substring(0, 80))
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[v8eval] SSE fetch error:', err)
          setStatus('failed')
        }
      }
    }

    connectSSE()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [runId])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div className="log-container">
      <div className="log-header">
        <span>Live Evaluation Logs</span>
        <span>{lineCount} lines &middot; {status === 'running' ? 'Running...' : status}</span>
      </div>

      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>

      <div className="log-output">
        {logs.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
        <div ref={logEndRef} />
      </div>
    </div>
  )
}
