interface ScoreCardProps {
  displayName: string
  scoreDisplay: string
  metricName: string
  numFewshot: number
  sampleLabel: string
  reference?: {
    score: number
    shots: number
    source: string
  } | null
}

export function ScoreCard({
  displayName,
  scoreDisplay,
  metricName,
  numFewshot,
  sampleLabel,
  reference,
}: ScoreCardProps) {
  return (
    <div className="score-card">
      <div className="score-title">{displayName}</div>
      <div className="score-value">{scoreDisplay}</div>
      {reference && (
        <div className="score-reference">
          Published: {reference.score}% @ {reference.shots}-shot &middot; Source: {reference.source}
        </div>
      )}
      <div className="score-metric">Metric: {metricName}</div>
      <div className="score-config">
        {metricName} &middot; {numFewshot}-shot &middot; {sampleLabel}
      </div>
    </div>
  )
}
