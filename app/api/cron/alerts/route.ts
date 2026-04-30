import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEventSms } from '@/lib/send-event-sms'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ ok: false, error: 'Supabase service role key not configured' }, { status: 500 })
  }

  const admin = createClient(supabaseUrl, serviceKey)

  const { data: events, error } = await admin
    .from('events')
    .select('*')
    .eq('alert_sent', false)
    .not('alert_phones', 'is', null)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  if (!events?.length) return NextResponse.json({ ok: true, sent: 0, message: 'No pending alerts' })

  const today = todayStr()
  const toAlert = events.filter((e: { event_date: string; alert_days_before: number; alert_phones: string }) => {
    const eventDate  = new Date(e.event_date + 'T00:00:00')
    const alertDate  = new Date(eventDate)
    alertDate.setDate(alertDate.getDate() - (e.alert_days_before ?? 1))
    return alertDate.toISOString().slice(0, 10) === today && e.alert_phones?.trim()
  })

  if (!toAlert.length) return NextResponse.json({ ok: true, sent: 0, message: 'No alerts due today' })

  let sentCount = 0
  for (const event of toAlert) {
    const result = await sendEventSms(event)
    if (result.ok) {
      sentCount++
      await admin.from('events').update({ alert_sent: true }).eq('id', event.id)
    }
  }

  // ── Restock alerts ────────────────────────────────────────────────────────
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}`
    if (baseUrl) {
      await fetch(`${baseUrl}/api/restock-alert`, { method: 'POST' })
    }
  } catch {
    // Non-fatal — event alerts already sent above
  }

  return NextResponse.json({ ok: true, sent: sentCount, total: toAlert.length })
}
