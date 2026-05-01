import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getRestaurantGuid,
  getToastEmployees,
  getToastTimeEntries,
  getToastJobs,
} from '@/lib/toast-client'

// ─── Surefire job title → track mapping ──────────────────────────────────────
// Based on actual Toast job titles at Surefire Market - Camp North End

function inferTrack(jobTitle: string): 'BOH' | 'FOH' {
  const t = jobTitle.toLowerCase()

  // Explicit BOH jobs at Surefire
  const boh = [
    'builder', 'boh expo', 'boh train', 'chef', 'prep', 'dish',
    'fryer', 'flat top', 'flattop', 'cook', 'shake station', 'expo',
    'kitchen', 'grill', 'line',
  ]
  // Explicit FOH jobs at Surefire
  const foh = [
    'cashier', 'host', 'server', 'barback', 'runner', 'bartender',
    'market floor', 'floor', 'register', 'front',
  ]

  if (boh.some(k => t.includes(k))) return 'BOH'
  if (foh.some(k => t.includes(k))) return 'FOH'

  // Management/unknown — default BOH (most common at Surefire)
  return 'BOH'
}

// ─── POST /api/toast-sync ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY } = process.env

  if (!process.env.TOAST_CLIENT_ID || !process.env.TOAST_CLIENT_SECRET) {
    return NextResponse.json({ ok: false, error: 'Toast credentials not configured.' }, { status: 500 })
  }

  const body = await req.json().catch(() => ({}))
  const daysBack: number = body.daysBack ?? 365

  const db = createClient(
    NEXT_PUBLIC_SUPABASE_URL!,
    SUPABASE_SERVICE_ROLE_KEY || NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  try {
    const restaurantGuid = await getRestaurantGuid()

    const endDate   = new Date().toISOString().slice(0, 10)
    const startDate = new Date(Date.now() - daysBack * 86_400_000).toISOString().slice(0, 10)

    const [rawEmployees, rawJobs, timeEntries] = await Promise.all([
      getToastEmployees(restaurantGuid),
      getToastJobs(restaurantGuid),
      getToastTimeEntries(restaurantGuid, startDate, endDate),
    ])

    // Toast returns arrays directly for these endpoints
    const employees = Array.isArray(rawEmployees) ? rawEmployees : []
    const jobs      = Array.isArray(rawJobs)      ? rawJobs      : []

    // job guid → title
    const jobMap: Record<string, string> = {}
    for (const job of jobs) {
      if (job.guid && job.title) jobMap[job.guid] = job.title
    }

    // ── Tally hours and shifts per employee ───────────────────────────────────
    // Toast time entry shape (confirmed from live API):
    //   employeeReference.guid  — employee
    //   jobReference.guid       — job
    //   regularHours            — decimal hours
    //   overtimeHours           — decimal hours
    //   businessDate            — "YYYYMMDD" string (local business date)

    type Tally = {
      bohHours: number
      fohHours: number
      shifts: Set<string>     // unique businessDate strings
      earliestDate: string | null  // earliest shift date = real start date
    }
    const tally: Record<string, Tally> = {}

    for (const e of timeEntries as Record<string, unknown>[]) {
      const empGuid = (e.employeeReference as Record<string, string> | null)?.guid
      if (!empGuid) continue
      if (e.deleted === true) continue

      if (!tally[empGuid]) tally[empGuid] = { bohHours: 0, fohHours: 0, shifts: new Set(), earliestDate: null }

      const hours = ((e.regularHours as number) ?? 0) + ((e.overtimeHours as number) ?? 0)
      const jobGuid = (e.jobReference as Record<string, string> | null)?.guid ?? ''
      const jobTitle = jobMap[jobGuid] ?? ''
      const track = inferTrack(jobTitle)

      if (track === 'BOH') tally[empGuid].bohHours += hours
      else                 tally[empGuid].fohHours += hours

      // businessDate is "YYYYMMDD" — convert to YYYY-MM-DD for comparison
      const bd = e.businessDate as string
      let shiftDate: string | null = null
      if (bd && bd.length === 8) {
        shiftDate = `${bd.slice(0, 4)}-${bd.slice(4, 6)}-${bd.slice(6, 8)}`
        tally[empGuid].shifts.add(shiftDate)
      } else {
        const inDate = (e.inDate as string | null)?.slice(0, 10)
        if (inDate) { tally[empGuid].shifts.add(inDate); shiftDate = inDate }
      }

      // Track the earliest shift date as the real employment start
      if (shiftDate) {
        if (!tally[empGuid].earliestDate || shiftDate < tally[empGuid].earliestDate!) {
          tally[empGuid].earliestDate = shiftDate
        }
      }
    }

    // ── Upsert team_members ───────────────────────────────────────────────────
    let created = 0
    let updated = 0
    const errors: string[] = []
    const skipped: string[] = []

    for (const emp of employees as Record<string, unknown>[]) {
      const guid = emp.guid as string
      if (!guid) continue

      const firstName = (emp.firstName as string) ?? ''
      const lastName  = (emp.lastName  as string) ?? ''
      const fullName  = `${firstName} ${lastName}`.trim()

      // Skip system/placeholder accounts
      if (!fullName || fullName === 'Default Online Ordering') { skipped.push(fullName || guid); continue }

      const isActive  = emp.deleted === false
      const empTally  = tally[guid]
      const bohH      = Math.round((empTally?.bohHours ?? 0) * 10) / 10
      const fohH      = Math.round((empTally?.fohHours ?? 0) * 10) / 10
      const shifts    = empTally?.shifts.size ?? 0
      const track: 'BOH' | 'FOH' = bohH >= fohH ? 'BOH' : 'FOH'

      // Use earliest shift date as start date — most accurate real-world hire date
      const startDate = empTally?.earliestDate ?? null

      // Check for existing record by toast_guid
      const { data: existing } = await db
        .from('team_members')
        .select('id, boh_hours, foh_hours, total_shifts, start_date, hidden')
        .eq('toast_guid', guid)
        .maybeSingle()

      // Skip members that were manually hidden on the site
      if (existing?.hidden) { skipped.push(fullName); continue }

      if (existing) {
        const { error } = await db.from('team_members').update({
          name:         fullName,
          active:       isActive,
          track,                                        // always update track based on hours
          boh_hours:    Math.max(bohH, existing.boh_hours ?? 0),
          foh_hours:    Math.max(fohH, existing.foh_hours ?? 0),
          total_shifts: Math.max(shifts, existing.total_shifts ?? 0),
          ...(startDate && (!existing.start_date || startDate < existing.start_date)
            ? { start_date: startDate }
            : {}),
        }).eq('id', existing.id)
        if (error) errors.push(`update ${fullName}: ${error.message}`)
        else updated++
      } else {
        const defaultBadge = track === 'BOH' ? 'boh_team_member' : 'foh_team_member'
        const { error } = await db.from('team_members').insert({
          name:          fullName,
          track,
          current_badge: defaultBadge,
          start_date:    startDate,
          boh_hours:     bohH,
          foh_hours:     fohH,
          total_shifts:  shifts,
          active:        isActive,
          toast_guid:    guid,
        })
        if (error) errors.push(`insert ${fullName}: ${error.message}`)
        else created++
      }
    }

    return NextResponse.json({
      ok: true,
      restaurantGuid,
      employeesFromToast: employees.length,
      timeEntriesProcessed: (timeEntries as unknown[]).length,
      created,
      updated,
      skipped: skipped.length,
      errors: errors.length ? errors : undefined,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

// GET — connection test
export async function GET() {
  if (!process.env.TOAST_CLIENT_ID || !process.env.TOAST_CLIENT_SECRET) {
    return NextResponse.json({ ok: false, error: 'Toast credentials not configured.' }, { status: 500 })
  }
  try {
    const guid = await getRestaurantGuid()
    return NextResponse.json({ ok: true, restaurantGuid: guid })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
