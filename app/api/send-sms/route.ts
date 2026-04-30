import { NextRequest, NextResponse } from 'next/server'
import { sendEventSms } from '@/lib/send-event-sms'

export async function POST(req: NextRequest) {
  try {
    const event = await req.json()
    if (!event?.title || !event?.event_date || !event?.alert_phones) {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 })
    }
    const result = await sendEventSms(event)
    return NextResponse.json(result, { status: result.ok ? 200 : 500 })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
