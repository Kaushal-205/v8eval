import { NextResponse } from 'next/server'

const SHEET_URL = process.env.SHEET_URL

export async function POST(req: Request) {
  try {
    if (!SHEET_URL) {
      throw new Error('SHEET_URL not configured in environment')
    }

    const payload = await req.json()

    const res = await fetch(SHEET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    })

    const text = await res.text()
    return NextResponse.json({ status: 'ok', upstream: text })
  } catch (err) {
    console.error('Waitlist API Error:', err)
    return NextResponse.json(
      { error: String(err) },
      { status: 500 },
    )
  }
}
