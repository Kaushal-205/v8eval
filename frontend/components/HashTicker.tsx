'use client'

import { useEffect, useRef, useState } from 'react'

const CHARSET = '0123456789abcdef'
const FINAL_HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

function randomHex(len: number): string {
  let s = ''
  for (let i = 0; i < len; i++) s += CHARSET[Math.floor(Math.random() * 16)]
  return s
}

export function HashTicker() {
  const [value, setValue] = useState('initializing...')
  const [settled, setSettled] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    function runTicker() {
      const totalFrames = 38
      const settleAt = 30
      let frame = 0

      intervalRef.current = setInterval(() => {
        frame++
        if (frame < settleAt) {
          setValue(randomHex(64))
        } else if (frame < totalFrames) {
          const revealed = Math.floor((frame - settleAt) / (totalFrames - settleAt) * 64)
          setValue(FINAL_HASH.slice(0, revealed) + randomHex(64 - revealed))
        } else {
          setValue(FINAL_HASH)
          setSettled(true)
          if (intervalRef.current) clearInterval(intervalRef.current)
          setTimeout(() => {
            setSettled(false)
            setValue(randomHex(64))
            setTimeout(runTicker, 400)
          }, 4200)
        }
      }, 55)
    }

    const timeout = setTimeout(runTicker, 800)
    return () => {
      clearTimeout(timeout)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return (
    <div className={`hash-ticker${settled ? ' settled' : ''}`} role="status" aria-live="polite">
      <span className="hash-label">sha256</span>
      <span className="hash-value">{value}</span>
      <span className="hash-verified" aria-hidden="true">&#10003; VERIFIED</span>
    </div>
  )
}
