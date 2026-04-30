import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { smtpSend } from '@/lib/smtp-send'

// Temporary debug endpoint — remove after fixing
export async function GET() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: items, error: itemErr } = await db
    .from('inventory_items')
    .select('id, name, reorder_level, count_unit')
    .eq('active', true)
    .not('reorder_level', 'is', null)

  const itemIds = (items ?? []).map((i: { id: string }) => i.id)

  const { data: allCounts, error: countErr } = await db
    .from('inventory_counts')
    .select('item_id, on_hand, count_date')
    .in('item_id', itemIds)
    .order('count_date', { ascending: false })

  const latestCount: Record<string, number> = {}
  if (allCounts) {
    for (const c of allCounts as { item_id: string; on_hand: number }[]) {
      if (!(c.item_id in latestCount)) latestCount[c.item_id] = c.on_hand
    }
  }

  const debug = (items ?? []).map((item: { id: string; name: string; reorder_level: string }) => ({
    name: item.name,
    reorder_level: item.reorder_level,
    threshold: parseFloat(String(item.reorder_level ?? '')),
    onHand: latestCount[item.id] ?? null,
    isLow: (() => {
      const onHand = latestCount[item.id]
      if (onHand === undefined) return false
      const t = parseFloat(String(item.reorder_level ?? ''))
      return !isNaN(t) && onHand <= t
    })(),
  }))

  return NextResponse.json({
    itemErr: itemErr?.message,
    countErr: countErr?.message,
    itemCount: items?.length ?? 0,
    countRows: allCounts?.length ?? 0,
    items: debug,
    gmailSet: !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),
    serviceKeySet: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  })
}

export async function POST() {
  const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    return NextResponse.json(
      { ok: false, error: 'Gmail not configured — add GMAIL_USER and GMAIL_APP_PASSWORD to env vars.' },
      { status: 500 }
    )
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // 1. Get all active items that have a reorder level set
  const { data: items, error: itemsErr } = await db
    .from('inventory_items')
    .select('id, name, reorder_level, count_unit, vendor')
    .eq('active', true)
    .not('reorder_level', 'is', null)

  if (itemsErr) return NextResponse.json({ ok: false, error: 'items query failed: ' + itemsErr.message }, { status: 500 })
  if (!items?.length) {
    return NextResponse.json({ ok: true, sent: 0, lowCount: 0, message: 'No items with reorder levels set.' })
  }

  // 2. Get the most recent count for each item
  const { data: allCounts, error: countsErr } = await db
    .from('inventory_counts')
    .select('item_id, on_hand, count_date')
    .in('item_id', items.map((i: { id: string }) => i.id))
    .order('count_date', { ascending: false })

  if (countsErr) return NextResponse.json({ ok: false, error: 'counts query failed: ' + countsErr.message }, { status: 500 })

  // Build latest count map
  const latestCount: Record<string, number> = {}
  if (allCounts) {
    for (const c of allCounts as { item_id: string; on_hand: number }[]) {
      if (!(c.item_id in latestCount)) latestCount[c.item_id] = c.on_hand
    }
  }

  // 3. Find items that are at or below reorder level
  // reorder_level may be stored as text like "8 cases" or "1 bucket" — extract leading number
  const lowItems = items
    .filter((item: { id: string; reorder_level: number | string }) => {
      const onHand = latestCount[item.id]
      if (onHand === undefined) return false
      const threshold = parseFloat(String(item.reorder_level ?? ''))
      if (isNaN(threshold)) return false   // can't compare text-only thresholds automatically
      return onHand <= threshold
    })
    .map((item: { id: string; name: string; reorder_level: number | string; count_unit: string; vendor: string | null }) => ({
      name: item.name,
      onHand: latestCount[item.id],
      reorderLevel: item.reorder_level,
      unit: item.count_unit,
      vendor: item.vendor,
    }))

  if (!lowItems.length) {
    const debugSample = (items ?? []).slice(0, 5).map((item: { id: string; name: string; reorder_level: string }) => ({
      name: item.name, reorder_level: item.reorder_level,
      threshold: parseFloat(String(item.reorder_level ?? '')),
      onHand: latestCount[item.id] ?? 'NO COUNT',
    }))
    return NextResponse.json({
      ok: true, sent: 0, lowCount: 0,
      message: 'All items are stocked above reorder level.',
      _debug: { itemsFound: items?.length ?? 0, countsLoaded: Object.keys(latestCount).length, sample: debugSample }
    })
  }

  // 4. Get contacts opted in to restock alerts
  const { data: contacts } = await db
    .from('contacts')
    .select('sms_email, phone, carrier, name')
    .eq('active', true)
    .eq('restock_alerts', true)

  if (!contacts?.length) {
    return NextResponse.json({
      ok: false,
      lowCount: lowItems.length,
      error: 'No contacts have restock alerts enabled. Go to Contacts and turn on "Restock Alerts" for your team.',
    })
  }

  // Resolve SMS addresses
  const { buildSmsEmail } = await import('@/lib/carrier-gateways')
  const addresses: string[] = []
  for (const c of contacts as { sms_email: string | null; phone: string; carrier: string | null }[]) {
    const addr = c.sms_email?.trim() || (c.phone && c.carrier ? buildSmsEmail(c.phone, c.carrier) : '')
    if (addr && !addresses.includes(addr)) addresses.push(addr)
  }

  if (!addresses.length) {
    return NextResponse.json({
      ok: false,
      lowCount: lowItems.length,
      error: 'Restock contacts found but none have a valid carrier/SMS address set.',
    })
  }

  // 5. Build the message
  const itemLines = lowItems
    .map((i: { name: string; onHand: number; reorderLevel: string | number; unit: string }) =>
      `• ${i.name}: ${i.onHand} ${i.unit} on hand (order at ${i.reorderLevel})`
    )
    .join('\n')

  const body = `🔔 Surefire Market - Low Stock Alert\n\nItems needing reorder (${lowItems.length}):\n${itemLines}\n\nPlease place orders ASAP.`

  // 6. Send to all opted-in contacts
  const results = await Promise.allSettled(
    addresses.map(to =>
      smtpSend({ user: GMAIL_USER, pass: GMAIL_APP_PASSWORD, to, subject: '', body })
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

  return NextResponse.json({ ok: true, sent: addresses.length, lowCount: lowItems.length, items: lowItems })
}
