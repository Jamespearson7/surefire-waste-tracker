// ─────────────────────────────────────────────────────────────────────────────
// Toast API Client
// Handles OAuth token + all Labor/Employee API calls
// ─────────────────────────────────────────────────────────────────────────────

const TOAST_BASE = 'https://ws-api.toasttab.com'

let cachedToken: { token: string; expiresAt: number } | null = null

export async function getToastToken(): Promise<string> {
  const clientId     = process.env.TOAST_CLIENT_ID!
  const clientSecret = process.env.TOAST_CLIENT_SECRET!

  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token
  }

  const res = await fetch(`${TOAST_BASE}/authentication/v1/authentication/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId,
      clientSecret,
      userAccessType: 'TOAST_MACHINE_CLIENT',
    }),
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Toast auth failed ${res.status}: ${txt}`)
  }

  const data = await res.json()
  const token    = data.token?.accessToken as string
  const expiresIn = (data.token?.expiresIn as number) ?? 3600

  cachedToken = { token, expiresAt: Date.now() + expiresIn * 1000 }
  return token
}

// Get restaurant GUID — uses env var if set, otherwise discovers via partners API
export async function getRestaurantGuid(): Promise<string> {
  const stored = process.env.TOAST_RESTAURANT_GUID
  if (stored) return stored

  const token = await getToastToken()

  // partners/v1/restaurants returns all restaurants linked to these credentials
  const res = await fetch(`${TOAST_BASE}/partners/v1/restaurants`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (res.ok) {
    const data = await res.json()
    const list = Array.isArray(data) ? data : []
    const guid = list[0]?.restaurantGuid
    if (guid) return guid as string
  }

  throw new Error('Could not auto-discover restaurant GUID. Set TOAST_RESTAURANT_GUID env var manually.')
}

// Fetch all active employees
export async function getToastEmployees(restaurantGuid: string) {
  const token = await getToastToken()
  const res = await fetch(`${TOAST_BASE}/labor/v1/employees?pageSize=200`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Toast-Restaurant-External-ID': restaurantGuid,
    },
  })
  if (!res.ok) throw new Error(`Toast employees ${res.status}: ${await res.text()}`)
  return res.json()
}

// Fetch time entries — Toast max window is 30 days, so we chunk automatically
export async function getToastTimeEntries(
  restaurantGuid: string,
  startDate: string,  // YYYY-MM-DD
  endDate: string,
) {
  const token  = await getToastToken()
  const allEntries: unknown[] = []

  const start = new Date(startDate + 'T00:00:00Z')
  const end   = new Date(endDate   + 'T23:59:59Z')
  const CHUNK_DAYS = 29 // stay under the 30-day limit

  let chunkStart = new Date(start)

  while (chunkStart < end) {
    const chunkEnd = new Date(chunkStart)
    chunkEnd.setDate(chunkEnd.getDate() + CHUNK_DAYS)
    if (chunkEnd > end) chunkEnd.setTime(end.getTime())

    const startDt = chunkStart.toISOString().replace(/\.\d{3}Z$/, '.000+0000')
    const endDt   = chunkEnd.toISOString().replace(/\.\d{3}Z$/, '.000+0000')
    const url = `${TOAST_BASE}/labor/v1/timeEntries?startDate=${encodeURIComponent(startDt)}&endDate=${encodeURIComponent(endDt)}&pageSize=500`

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Toast-Restaurant-External-ID': restaurantGuid,
      },
    })

    if (!res.ok) throw new Error(`Toast timeEntries ${res.status}: ${await res.text()}`)

    const data = await res.json()
    const entries = Array.isArray(data) ? data : data?.timeEntries ?? []
    allEntries.push(...entries)

    // advance to next chunk
    chunkStart = new Date(chunkEnd)
    chunkStart.setDate(chunkStart.getDate() + 1)
  }

  return allEntries
}

// Fetch job info (to determine BOH vs FOH)
export async function getToastJobs(restaurantGuid: string) {
  const token = await getToastToken()
  const res = await fetch(`${TOAST_BASE}/labor/v1/jobs?pageSize=200`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Toast-Restaurant-External-ID': restaurantGuid,
    },
  })
  if (!res.ok) throw new Error(`Toast jobs ${res.status}: ${await res.text()}`)
  return res.json()
}
