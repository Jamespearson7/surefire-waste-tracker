import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { smtpSend } from '@/lib/smtp-send'
import { buildSmsEmail } from '@/lib/carrier-gateways'

type LowItem = {
  name: string
  onHand: number
  reorderLevel: number
  unit: string
  vendor: string | null
}

export async function POST(req: NextRequest) {
  const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    return NextResponse.json(
      { ok: false, error: 'Gmail not configured — add GMAIL_USER and GMAIL_APP_PASSWORD to env vars.' },
      { status: 500 }
    )
  }

  // Items are sent from the client (already calculated on the inventory page)
  const body = await req.json().catch(() => ({}))
  const lowItems: LowItem[] = body.items ?? []

  if (!lowItems.length) {
    return NextResponse.json({ ok: true, sent: 0, lowCount: 0, message: 'No low items to report.' })
  }

  // Get contacts opted in to restock alerts
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: contacts, error: contactsErr } = await db
    .from('contacts')
    .select('sms_email, phone, carrier, name')
    .eq('active', true)
    .eq('restock_alerts', true)

  if (contactsErr) {
    return NextResponse.json({ ok: false, error: 'contacts query failed: ' + contactsErr.message }, { status: 500 })
  }

  if (!contacts?.length) {
    return NextResponse.json({
      ok: false,
      lowCount: lowItems.length,
      error: 'No contacts have restock alerts enabled. Go to Contacts and turn on "📦 Restock Alerts" for your team.',
    })
  }

  // Resolve SMS addresses
  const addresses: string[] = []
  for (const c of contacts as { sms_email: string | null; phone: string; carrier: string | null }[]) {
    const addr = c.sms_email?.trim() || (c.phone && c.carrier ? buildSmsEmail(c.phone, c.carrier) : '')
    if (addr && !addresses.includes(addr)) addresses.push(addr)
  }

  if (!addresses.length) {
    return NextResponse.json({
      ok: false,
      lowCount: lowItems.length,
      error: 'Contacts found but none have a valid carrier/phone set.',
    })
  }

  // Build the message
  const itemLines = lowItems
    .map(i => `• ${i.name}: ${i.onHand} ${i.unit} on hand (reorder at ${i.reorderLevel})`)
    .join('\n')

  const body2 = `🔔 Surefire Market - Low Stock Alert\n\nItems needing reorder (${lowItems.length}):\n${itemLines}\n\nPlease place orders ASAP.`

  // Send to all opted-in contacts
  const results = await Promise.allSettled(
    addresses.map(to =>
      smtpSend({ user: GMAIL_USER, pass: GMAIL_APP_PASSWORD, to, subject: '', body: body2 })
    )
  )

  const failed = results.filter(r => r.status === 'rejected').length
  if (failed > 0) {
    return NextResponse.json({
      ok: false,
      error: `${failed} of ${addresses.length} messages failed to send`,
      lowCount: lowItems.length,
    })
  }

  return NextResponse.json({ ok: true, sent: addresses.length, lowCount: lowItems.length })
}
