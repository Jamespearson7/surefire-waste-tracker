import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getRestaurantGuid,
  getToastEmployees,
  getToastTimeEntries,
  getToastJobs,
} from '@/lib/toast-client'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Guess BOH vs FOH from job title
function inferTrack(jobTitle: string): 'BOH' | 'FOH' | null {
  const t = jobTitle.toLowerCase()
  const bohKeywords = ['cook', 'kitchen', 'prep', 'dish', 'expo', 'grill', 'fryer', 'line', 'boh', 'back of house']
  const fohKeywords = ['cashier', 'register', 'floor', 'market', 'front', 'foh', 'server', 'barista', 'coffee', 'deli', 'customer']
  if (bohKeywords.some(k => t.includes(k))) return 'BOH'
  if (fohKeywords.some(k => t.includes(k))) return 'FOH'
  return null
}

// Hours between two ISO datetime strings
function hoursFromEntry(entry: { inDate?: string; outDate?: string; regularHours?: number; overtimeHours?: number }): number {
  if (entry.regularHours !== undefined) {
    return (entry.regularHours ?? 0) + (entry.overtimeHours ?? 0)
  }
  if (entry.inDate && entry.outDate) {
    const ms = new Date(entry.outDate).getTime() - new Date(entry.inDate).getTime()
    return ms / 3_600_000
  }
  return 0
}

// ─── POST /api/toast-sync ─────────────────────────────────────────────────────
// Called by the "Sync from Toast" button on the Team page.
// Also safe to call from the nightly cron.
// Body: { daysBack?: number }  (default 365 — full history on first run)

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
    // 1. Get restaurant GUID
    const restaurantGuid = await getRestaurantGuid()

    // 2. Fetch employees, jobs, and time entries in parallel
    const endDate   = new Date().toISOString().slice(0, 10)
    const startDate = new Date(Date.now() - daysBack * 86_400_000).toISOString().slice(0, 10)

    const [rawEmployees, rawJobs, timeEntries] = await Promise.all([
      getToastEmployees(restaurantGuid),
      getToastJobs(restaurantGuid),
      getToastTimeEntries(restaurantGuid, startDate, endDate),
    ])

    const employees = Array.isArray(rawEmployees) ? rawEmployees : rawEmployees?.employees ?? []
    const jobs      = Array.isArray(rawJobs) ? rawJobs : rawJobs?.jobs ?? []

    // Build job guid → title map
    const jobMap: Record<string, string> = {}
    for (const job of jobs) {
      if (job.guid && job.title) jobMap[job.guid] = job.title
    }

    // 3. Tally hours and shifts per employee guid
    type Tally = { bohHours: number; fohHours: number; shifts: Set<string>; startDate: string | null }
    const tally: Record<string, Tally> = {}

    for (const entry of timeEntries) {
      const empGuid = entry.employee?.guid ?? entry.employeeGuid
      if (!empGuid) continue

      if (!tally[empGuid]) tally[empGuid] = { bohHours: 0, fohHours: 0, shifts: new Set(), startDate: null }

      const hours    = hoursFromEntry(entry)
      const jobTitle = jobMap[entry.job?.guid ?? entry.jobGuid ?? ''] ?? ''
      const track    = inferTrack(jobTitle)

      if (track === 'BOH') tally[empGuid].bohHours += hours
      else if (track === 'FOH') tally[empGuid].fohHours += hours
      else {
        // unknown job — split evenly or add to both
        tally[empGuid].bohHours += hours / 2
        tally[empGuid].fohHours += hours / 2
      }

      // Count each calendar date worked as 1 shift
      const dateWorked = (entry.inDate ?? entry.clockInDate ?? '').slice(0, 10)
      if (dateWorked) tally[empGuid].shifts.add(dateWorked)
    }

    // 4. Upsert team_members
    let created = 0
    let updated = 0
    const errors: string[] = []

    for (const emp of employees) {
      if (!emp.guid) continue

      const firstName = emp.firstName ?? emp.first_name ?? ''
      const lastName  = emp.lastName  ?? emp.last_name  ?? ''
      const fullName  = `${firstName} ${lastName}`.trim()
      if (!fullName) continue

      const isActive = emp.deleted === false || emp.status === 'ACTIVE' || emp.status === undefined

      // Determine primary track from most hours or first job
      const empTally  = tally[emp.guid]
      const bohH      = empTally?.bohHours ?? 0
      const fohH      = empTally?.fohHours ?? 0
      const track: 'BOH' | 'FOH' = bohH >= fohH ? 'BOH' : 'FOH'
      const totalShifts = empTally?.shifts.size ?? 0

      // External ID stored so we can match on future syncs
      const externalId = emp.guid

      // Check if member already exists (match by toast_guid or name)
      const { data: existing } = await db
        .from('team_members')
        .select('id, current_badge, boh_hours, foh_hours, total_shifts')
        .eq('toast_guid', externalId)
        .maybeSingle()

      if (existing) {
        // Update hours and shifts — take the higher of Toast vs manual
        const { error } = await db.from('team_members').update({
          name:         fullName,
          active:       isActive,
          boh_hours:    Math.max(bohH, existing.boh_hours ?? 0),
          foh_hours:    Math.max(fohH, existing.foh_hours ?? 0),
          total_shifts: Math.max(totalShifts, existing.total_shifts ?? 0),
        }).eq('id', existing.id)
        if (error) errors.push(`update ${fullName}: ${error.message}`)
        else updated++
      } else {
        // New member — create with entry-level badge
        const defaultBadge = track === 'BOH' ? 'boh_team_member' : 'foh_team_member'
        const hireDate = emp.hireDate ?? emp.hire_date ?? null

        const { error } = await db.from('team_members').insert({
          name:          fullName,
          track,
          current_badge: defaultBadge,
          start_date:    hireDate ? hireDate.slice(0, 10) : null,
          boh_hours:     Math.round(bohH * 10) / 10,
          foh_hours:     Math.round(fohH * 10) / 10,
          total_shifts:  totalShifts,
          active:        isActive,
          toast_guid:    externalId,
        })
        if (error) {
          // toast_guid column may not exist yet — retry without it
          if (error.message.includes('toast_guid')) {
            const { error: e2 } = await db.from('team_members').insert({
              name: fullName, track, current_badge: defaultBadge,
              start_date: hireDate ? hireDate.slice(0, 10) : null,
              boh_hours: Math.round(bohH * 10) / 10,
              foh_hours: Math.round(fohH * 10) / 10,
              total_shifts: totalShifts, active: isActive,
            })
            if (e2) errors.push(`insert ${fullName}: ${e2.message}`)
            else created++
          } else {
            errors.push(`insert ${fullName}: ${error.message}`)
          }
        } else {
          created++
        }
      }
    }

    return NextResponse.json({
      ok: true,
      restaurantGuid,
      employeesFromToast: employees.length,
      created,
      updated,
      errors: errors.length ? errors : undefined,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

// GET — quick connection test, returns restaurant info
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
