import { createClient } from '@supabase/supabase-js'
import { smtpSend } from './smtp-send'
import { buildSmsEmail } from './carrier-gateways'

export type SmsResult = { ok: true; sent: number } | { ok: false; error: string }

export async function sendEventSms(event: {
  title: string
  event_date: string
  start_time: string | null
  event_type: string
  location: string | null
  alert_phones: string | null
  alert_contact_ids?: string | null
}): Promise<SmsResult> {
  const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    return {
      ok: false,
      error: 'Gmail not configured — add GMAIL_USER and GMAIL_APP_PASSWORD to Vercel env vars.',
    }
  }

  // Collect all SMS gateway addresses
  const addresses: string[] = []

  // 1. Resolve saved contacts from DB
  if (event.alert_contact_ids?.trim()) {
    const ids = event.alert_contact_ids.split(',').map(id => id.trim()).filter(Boolean)
    if (ids.length > 0) {
      const db = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )
      const { data: contacts } = await db
        .from('contacts')
        .select('sms_email, phone, carrier')
        .in('id', ids)
        .eq('active', true)

      if (contacts) {
        for (const c of contacts as { sms_email: string | null; phone: string; carrier: string | null }[]) {
          const addr = c.sms_email?.trim() || (c.phone && c.carrier ? buildSmsEmail(c.phone, c.carrier) : '')
          if (addr && !addresses.includes(addr)) addresses.push(addr)
        }
      }
    }
  }

  // 2. Manual entries in alert_phones
  if (event.alert_phones?.trim()) {
    for (const p of event.alert_phones.split(',').map(p => p.trim()).filter(Boolean)) {
      if (!addresses.includes(p)) addresses.push(p)
    }
  }

  if (!addresses.length) {
    return { ok: false, error: 'No SMS addresses to send to — add contacts with a carrier selected.' }
  }

  // Build SMS body (keep short — 160 char limit per SMS segment)
  const [, m, d] = event.event_date.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const dateStr = `${months[parseInt(m) - 1]} ${parseInt(d)}`
  const timeStr = event.start_time ? ` at ${event.start_time.slice(0, 5)}` : ''
  const locStr  = event.location   ? ` | ${event.location}` : ''
  const body    = `Surefire Market: ${event.event_type} - ${event.title} | ${dateStr}${timeStr}${locStr}`

  const results = await Promise.allSettled(
    addresses.map(to =>
      smtpSend({ user: GMAIL_USER, pass: GMAIL_APP_PASSWORD, to, subject: '', body })
    )
  )

  const failed = results.filter(r => r.status === 'rejected').length
  if (failed > 0) {
    const reasons = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map(r => String(r.reason))
      .join('; ')
    return { ok: false, error: `${failed}/${addresses.length} failed: ${reasons}` }
  }
  return { ok: true, sent: addresses.length }
}
