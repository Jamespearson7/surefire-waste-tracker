'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase, InventoryCount, EventLog, WeeklySales, InventoryItem } from '@/lib/supabase'
import {
  calcIngredientNeeds,
  groupByVendor,
  IngredientNeed,
  SalesRow,
  ModifierRow,
} from '@/lib/recipes'
import JSZip from 'jszip'

// ─── Types ─────────────────────────────────────────────────────────────────────

type WeatherDay = {
  date: string
  maxTemp: number
  minTemp: number
  description: string      // NWS shortForecast, e.g. "Partly Sunny"
  precipChance: number     // 0-100 % chance of precipitation (day max)
  inOrderWeek: boolean     // true if date falls inside the selected order week
}

type HourForecast = {
  time: string            // ISO
  hour: number            // 0-23 local
  temperature: number
  shortForecast: string
  precipChance: number    // 0-100
}

type WeatherBundle = {
  days: WeatherDay[]
  hoursByDate: Record<string, HourForecast[]>
  weekStart: string
  weekEnd: string
  daysRequested: number   // 7
  daysCovered: number     // how many of the order week days we could forecast
}

type ParsedSales = {
  sales: SalesRow[]
  modifiers: ModifierRow[]
  weekLabel: string
  diagnostics?: {
    fileName: string
    headersFound: string[]
    itemColumn: string
    qtyColumn: string
    totalRows: number
    unmatchedItems: { name: string; qty: number }[]
  }
}

// ─── Weather helpers (NWS — weather.gov) ───────────────────────────────────────
// Pinned to Camp North End, Charlotte NC (300 Camp Rd)
const NWS_LAT = 35.2470
const NWS_LON = -80.8194

function weatherEmoji(desc: string): string {
  const s = desc.toLowerCase()
  if (s.includes('thunder') || s.includes('storm')) return '⛈️'
  if (s.includes('snow') || s.includes('sleet') || s.includes('flurries')) return '❄️'
  if (s.includes('freezing')) return '🧊'
  if (s.includes('shower') || s.includes('rain')) return '🌧️'
  if (s.includes('drizzle')) return '🌦️'
  if (s.includes('fog') || s.includes('haze') || s.includes('mist')) return '🌫️'
  if (s.includes('partly sunny') || s.includes('partly cloudy') || s.includes('mostly sunny')) return '⛅'
  if (s.includes('cloud') || s.includes('overcast')) return '☁️'
  if (s.includes('sunny') || s.includes('clear')) return '☀️'
  if (s.includes('wind')) return '💨'
  return '🌤️'
}

type NwsPeriod = {
  startTime: string
  isDaytime: boolean
  temperature: number
  shortForecast: string
  probabilityOfPrecipitation?: { value: number | null }
}

async function fetchCampNorthEndWeather(weekStart: string): Promise<WeatherBundle> {
  const weekEnd = (() => {
    const d = new Date(weekStart + 'T12:00:00'); d.setDate(d.getDate() + 6)
    return d.toISOString().split('T')[0]
  })()
  const empty: WeatherBundle = { days: [], hoursByDate: {}, weekStart, weekEnd, daysRequested: 7, daysCovered: 0 }

  try {
    // Step 1: resolve lat/lon → forecast grid URLs
    const pointsRes = await fetch(`https://api.weather.gov/points/${NWS_LAT},${NWS_LON}`, {
      headers: { 'Accept': 'application/geo+json' },
    })
    if (!pointsRes.ok) return empty
    const pointsData = await pointsRes.json()
    const forecastUrl: string | undefined = pointsData?.properties?.forecast
    const hourlyUrl: string | undefined = pointsData?.properties?.forecastHourly
    if (!forecastUrl) return empty

    // Step 2: get daily + hourly forecasts in parallel
    const [fcRes, hourlyRes] = await Promise.all([
      fetch(forecastUrl, { headers: { 'Accept': 'application/geo+json' } }),
      hourlyUrl ? fetch(hourlyUrl, { headers: { 'Accept': 'application/geo+json' } }) : Promise.resolve(null),
    ])
    if (!fcRes.ok) return empty
    const fcData = await fcRes.json()
    const periods: NwsPeriod[] = fcData?.properties?.periods ?? []

    // Build daily view — show ALL forecast days, flag whether each falls in the order week
    const byDate: Record<string, { day?: NwsPeriod; night?: NwsPeriod }> = {}
    for (const p of periods) {
      const date = p.startTime.split('T')[0]
      if (!byDate[date]) byDate[date] = {}
      if (p.isDaytime) byDate[date].day = p
      else            byDate[date].night = p
    }

    const days: WeatherDay[] = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateStr, entry]) => {
        const dayP = entry.day, nightP = entry.night
        const shortFc = dayP?.shortForecast ?? nightP?.shortForecast ?? ''
        const pop = Math.max(dayP?.probabilityOfPrecipitation?.value ?? 0, nightP?.probabilityOfPrecipitation?.value ?? 0)
        return {
          date: dateStr,
          maxTemp: dayP?.temperature ?? nightP?.temperature ?? 0,
          minTemp: nightP?.temperature ?? dayP?.temperature ?? 0,
          description: shortFc,
          precipChance: pop,
          inOrderWeek: dateStr >= weekStart && dateStr <= weekEnd,
        }
      })

    // Build hourly lookup
    const hoursByDate: Record<string, HourForecast[]> = {}
    if (hourlyRes && hourlyRes.ok) {
      const hData = await hourlyRes.json()
      const hPeriods: Array<{
        startTime: string; temperature: number; shortForecast: string;
        probabilityOfPrecipitation?: { value: number | null }
      }> = hData?.properties?.periods ?? []
      for (const h of hPeriods) {
        const d = new Date(h.startTime)
        const dateStr = h.startTime.split('T')[0]
        if (!hoursByDate[dateStr]) hoursByDate[dateStr] = []
        hoursByDate[dateStr].push({
          time: h.startTime,
          hour: d.getHours(),
          temperature: h.temperature,
          shortForecast: h.shortForecast,
          precipChance: h.probabilityOfPrecipitation?.value ?? 0,
        })
      }
    }

    const daysCovered = days.filter(d => d.inOrderWeek).length
    return { days, hoursByDate, weekStart, weekEnd, daysRequested: 7, daysCovered }
  } catch (err) {
    console.error('NWS weather fetch failed', err)
    return empty
  }
}

// Summarize rain timing for a day from its hourly array
function summarizeRainWindow(hours: HourForecast[]): string | null {
  if (!hours || hours.length === 0) return null
  const rainyHours = hours.filter(h => h.precipChance >= 30)
  if (rainyHours.length === 0) {
    const peak = hours.reduce((best, h) => h.precipChance > best.precipChance ? h : best, hours[0])
    if (peak.precipChance < 15) return 'No rain expected.'
    return `Low chance of rain all day (peak ${peak.precipChance}%).`
  }
  // Find contiguous windows
  const first = rainyHours[0]
  const last = rainyHours[rainyHours.length - 1]
  const peak = rainyHours.reduce((best, h) => h.precipChance > best.precipChance ? h : best, rainyHours[0])
  const fmtHour = (h: number) => {
    const suffix = h >= 12 ? 'pm' : 'am'
    const twelve = h % 12 === 0 ? 12 : h % 12
    return `${twelve}${suffix}`
  }
  if (first.hour === last.hour) return `Rain likely around ${fmtHour(first.hour)} (${peak.precipChance}%).`
  return `Rain most likely ${fmtHour(first.hour)}–${fmtHour(last.hour + 1)} (peak ${peak.precipChance}% at ${fmtHour(peak.hour)}).`
}

// ─── Toast CSV parser ──────────────────────────────────────────────────────────

// Maps Toast menu item names to our internal recipe keys.
// Matching is fuzzy — case-insensitive + strips punctuation and extra whitespace.
const TOAST_NAME_MAP: Record<string, string> = {
  'the classic':        'The Classic',
  'classic':            'The Classic',
  'classic burger':     'The Classic',
  'the ogden':          'The Ogden',
  'ogden':              'The Ogden',
  'ogden burger':       'The Ogden',
  'honey butta':        'Honey Butta',
  'honey butter':       'Honey Butta',
  'honey butta chicken':'Honey Butta',
  'retha mae':          'Retha Mae',
  'retha':              'Retha Mae',
  'tyson corner':       'Tyson Corner',
  'tyson':              'Tyson Corner',
  'baker street':       'Baker Street',
  'baker st':           'Baker Street',
  'tenders':            'Chicken Tenders',
  'chicken tenders':    'Chicken Tenders',
  'tenders meal':       'Chicken Tenders',
  'seasoned fries':     'Seasoned Fries',
  'fries':              'Seasoned Fries',
  'seasoned fry':       'Seasoned Fries',
  'cauliflower bites':  'Cauliflower Bites',
  'cauli bites':        'Cauliflower Bites',
  'plain hamburger':    'Plain Hamburger',
  'plain burger':       'Plain Hamburger',
  'hamburger':          'Plain Hamburger',
  'grilled cheese':     'Grilled Cheese',
}

const TOAST_MODIFIER_MAP: Record<string, string> = {
  'add lettuce':  'Add Lettuce',
  'lettuce':      'Add Lettuce',
  'add tomato':   'Add Tomato',
  'tomato':       'Add Tomato',
  'add tomatoes': 'Add Tomato',
  'tomatoes':     'Add Tomato',
}

// Normalize a name for fuzzy matching
function normalizeName(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}

// Parse a single CSV line, honoring quoted fields (including escaped quotes)
function splitCSVLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (c === ',' && !inQuotes) {
      out.push(cur); cur = ''
    } else {
      cur += c
    }
  }
  out.push(cur)
  return out.map(s => s.trim())
}

function parseToastCSV(csvText: string, fileName: string): ParsedSales {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) {
    return {
      sales: [], modifiers: [], weekLabel: fileName,
      diagnostics: { fileName, headersFound: [], itemColumn: '', qtyColumn: '', totalRows: 0, unmatchedItems: [] }
    }
  }

  const headers = splitCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim())

  // Try a range of column names Toast uses across different exports
  const itemColCandidates = [
    'item', 'item name', 'menu item', 'master name', 'master item',
    'name', 'product', 'product name', 'parent master id', 'sales category',
  ]
  const qtyColCandidates = [
    'item qty', 'qty', 'qty sold', 'quantity', 'quantity sold', 'count', 'units sold', 'items sold',
  ]

  const lowerHeaders = headers.map(h => h.toLowerCase())
  const findCol = (candidates: string[]) => {
    // Exact match first
    for (const c of candidates) {
      const idx = lowerHeaders.indexOf(c)
      if (idx >= 0) return idx
    }
    // Then includes
    for (const c of candidates) {
      const idx = lowerHeaders.findIndex(h => h.includes(c))
      if (idx >= 0) return idx
    }
    return -1
  }

  const itemIdx = findCol(itemColCandidates)
  const qtyIdx = findCol(qtyColCandidates)

  const diagnostics = {
    fileName,
    headersFound: headers,
    itemColumn: itemIdx >= 0 ? headers[itemIdx] : '(not found)',
    qtyColumn: qtyIdx >= 0 ? headers[qtyIdx] : '(not found)',
    totalRows: lines.length - 1,
    unmatchedItems: [] as { name: string; qty: number }[],
  }

  if (itemIdx < 0 || qtyIdx < 0) {
    return { sales: [], modifiers: [], weekLabel: fileName, diagnostics }
  }

  const salesMap: Record<string, number> = {}
  const modMap: Record<string, number> = {}
  const unmatchedMap: Record<string, number> = {}

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i])
    const rawName = (cols[itemIdx] ?? '').replace(/^"|"$/g, '').trim()
    const qtyRaw = (cols[qtyIdx] ?? '0').replace(/^"|"$/g, '').replace(/,/g, '').trim()
    const qty = parseFloat(qtyRaw) || 0

    if (!rawName || qty <= 0) continue

    const normalized = normalizeName(rawName)
    const mapped = TOAST_NAME_MAP[normalized]
    if (mapped) {
      salesMap[mapped] = (salesMap[mapped] ?? 0) + qty
      continue
    }
    const modMapped = TOAST_MODIFIER_MAP[normalized]
    if (modMapped) {
      modMap[modMapped] = (modMap[modMapped] ?? 0) + qty
      continue
    }
    // Track unmatched for diagnostics
    unmatchedMap[rawName] = (unmatchedMap[rawName] ?? 0) + qty
  }

  diagnostics.unmatchedItems = Object.entries(unmatchedMap)
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)

  return {
    sales: Object.entries(salesMap).map(([menuItem, qtySold]) => ({ menuItem, qtySold: Math.round(qtySold) })),
    modifiers: Object.entries(modMap).map(([modifierName, qtySold]) => ({ modifierName, qtySold: Math.round(qtySold) })),
    weekLabel: fileName,
    diagnostics,
  }
}

async function parseToastZip(file: File): Promise<ParsedSales> {
  // If it's a plain CSV, just parse it
  if (file.name.toLowerCase().endsWith('.csv')) {
    const text = await file.text()
    return parseToastCSV(text, file.name)
  }

  const zip = new JSZip()
  const contents = await zip.loadAsync(file)

  // Find all CSVs in the zip
  const allCsvs = Object.keys(contents.files).filter(n => n.toLowerCase().endsWith('.csv'))
  if (allCsvs.length === 0) {
    throw new Error('No CSV files found inside the ZIP. Is this the right export?')
  }

  // Prefer product/item-mix style CSVs
  const preferredOrder = [
    'productmix', 'product_mix', 'product mix',
    'itemselection', 'item_selection', 'item selection',
    'menuitem', 'menu_item', 'menu item',
    'item', 'menu', 'product',
  ]

  let chosen: string | undefined
  for (const keyword of preferredOrder) {
    chosen = allCsvs.find(n => n.toLowerCase().includes(keyword))
    if (chosen) break
  }
  if (!chosen) chosen = allCsvs[0]

  const text = await contents.files[chosen].async('text')
  const parsed = parseToastCSV(text, chosen)

  // If nothing matched, try other CSVs in the zip
  if (parsed.sales.length === 0 && allCsvs.length > 1) {
    for (const alt of allCsvs) {
      if (alt === chosen) continue
      const altText = await contents.files[alt].async('text')
      const altParsed = parseToastCSV(altText, alt)
      if (altParsed.sales.length > 0) return altParsed
    }
  }

  return parsed
}

// ─── Next week start (next Monday) ────────────────────────────────────────────
function nextMonday(): string {
  const d = new Date()
  const day = d.getDay() // 0=Sun
  const daysUntilMonday = day === 0 ? 1 : 8 - day
  d.setDate(d.getDate() + daysUntilMonday)
  return d.toISOString().split('T')[0]
}

function fmt(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function OrderPage() {
  const { isManager } = useAuth()

  // Sales upload state
  const [parsedSales, setParsedSales] = useState<ParsedSales | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [diagnostics, setDiagnostics] = useState<NonNullable<ParsedSales['diagnostics']> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Order params
  const [volumeMultiplier, setVolumeMultiplier] = useState(1.0)
  const [wasteBuffer, setWasteBuffer] = useState(0.05)
  const [orderWeekStart, setOrderWeekStart] = useState(nextMonday())

  // Weather
  const [weatherBundle, setWeatherBundle] = useState<WeatherBundle | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const weather = weatherBundle?.days ?? []
  const hoursByDate = weatherBundle?.hoursByDate ?? {}

  // Events
  const [events, setEvents] = useState<EventLog[]>([])
  const [newEvent, setNewEvent] = useState({ event_name: '', event_date: orderWeekStart, impact_pct: 10, notes: '' })
  const [addingEvent, setAddingEvent] = useState(false)
  const [savingEvent, setSavingEvent] = useState(false)

  // Inventory on-hand
  const [onHandCounts, setOnHandCounts] = useState<Record<string, number>>({})
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])

  // Computed
  const [needs, setNeeds] = useState<IngredientNeed[]>([])
  const [grouped, setGrouped] = useState<Record<string, IngredientNeed[]>>({})

  // Saving sales to DB
  const [savingSales, setSavingSales] = useState(false)
  const [salesSaved, setSalesSaved] = useState(false)

  useEffect(() => {
    loadWeather()
    loadEvents()
    loadInventory()
  }, [orderWeekStart])

  useEffect(() => {
    if (parsedSales) recalculate()
  }, [parsedSales, volumeMultiplier, wasteBuffer])

  async function loadWeather() {
    setWeatherLoading(true)
    setExpandedDay(null)
    const data = await fetchCampNorthEndWeather(orderWeekStart)
    setWeatherBundle(data)
    setWeatherLoading(false)
  }

  async function loadEvents() {
    const weekEnd = (() => {
      const d = new Date(orderWeekStart); d.setDate(d.getDate() + 6)
      return d.toISOString().split('T')[0]
    })()
    const { data } = await supabase
      .from('event_log')
      .select('*')
      .gte('event_date', orderWeekStart)
      .lte('event_date', weekEnd)
      .order('event_date')
    if (data) setEvents(data)
  }

  async function loadInventory() {
    const { data: items } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('active', true)
      .order('sort_order')
    if (items) setInventoryItems(items)

    // Get most recent count for each item
    const { data: counts } = await supabase
      .from('inventory_counts')
      .select('*')
      .lte('count_date', orderWeekStart)
      .order('count_date', { ascending: false })

    if (counts) {
      const map: Record<string, number> = {}
      const seen = new Set<string>()
      for (const row of counts as InventoryCount[]) {
        if (!seen.has(row.item_id)) {
          map[row.item_id] = row.on_hand
          seen.add(row.item_id)
        }
      }
      setOnHandCounts(map)
    }
  }

  function recalculate() {
    if (!parsedSales) return
    const effectiveMultiplier = volumeMultiplier * (1 + events.reduce((sum, e) => sum + e.impact_pct / 100, 0))
    const result = calcIngredientNeeds(parsedSales.sales, parsedSales.modifiers, effectiveMultiplier, wasteBuffer)
    setNeeds(result)
    setGrouped(groupByVendor(result))
  }

  async function processFile(file: File) {
    setUploading(true)
    setUploadError('')
    setDiagnostics(null)
    try {
      const parsed = await parseToastZip(file)
      if (parsed.sales.length === 0) {
        setUploadError('No matching menu items were found. See the diagnostic panel below — if the raw item names look right, tell me which ones to map.')
        setDiagnostics(parsed.diagnostics ?? null)
      } else {
        setParsedSales(parsed)
        setDiagnostics(parsed.diagnostics ?? null)
      }
    } catch (err) {
      setUploadError(String(err))
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
  }

  async function saveEventLog() {
    if (!newEvent.event_name.trim()) return
    setSavingEvent(true)
    const { error } = await supabase.from('event_log').insert([{
      event_date: newEvent.event_date,
      event_name: newEvent.event_name.trim(),
      impact_pct: newEvent.impact_pct,
      notes: newEvent.notes || null,
      logged_by: null,
    }])
    setSavingEvent(false)
    if (error) { alert('Error: ' + error.message); return }
    setNewEvent({ event_name: '', event_date: orderWeekStart, impact_pct: 10, notes: '' })
    setAddingEvent(false)
    loadEvents()
  }

  async function deleteEvent(id: string) {
    await supabase.from('event_log').delete().eq('id', id)
    loadEvents()
  }

  async function saveSalesToDB() {
    if (!parsedSales) return
    setSavingSales(true)
    const weekEnd = (() => {
      const d = new Date(orderWeekStart); d.setDate(d.getDate() + 6)
      return d.toISOString().split('T')[0]
    })()
    // Delete existing for this week, then insert
    await supabase.from('weekly_sales').delete()
      .eq('week_start', orderWeekStart)
    const rows: Omit<WeeklySales, 'id' | 'created_at'>[] = parsedSales.sales.map(s => ({
      week_start: orderWeekStart,
      week_end: weekEnd,
      menu_item: s.menuItem,
      qty_sold: s.qtySold,
      source: 'toast_upload',
    }))
    const { error } = await supabase.from('weekly_sales').insert(rows)
    setSavingSales(false)
    if (error) { alert('Error: ' + error.message); return }
    setSalesSaved(true)
    setTimeout(() => setSalesSaved(false), 3000)
  }

  // ─── Reorder suggestions (independent of Toast product mix) ─────────────────
  // For every inventory item with a reorder_level set, check if current on-hand
  // is at or below the reorder threshold. If so, suggest ordering up to par.
  const reorderSuggestions = useMemo(() => {
    const rows = inventoryItems
      .map(item => {
        if (item.reorder_level == null) return null
        const onHand = onHandCounts[item.id] ?? null
        if (onHand == null) return null
        if (onHand > item.reorder_level) return null

        const par = item.par_level ?? item.reorder_level
        const neededInCountUnits = Math.max(0, par - onHand)

        let suggestedOrderQty: number | null = null
        let orderUnitLabel = item.order_unit
        if (item.units_per_order_unit && item.units_per_order_unit > 0) {
          suggestedOrderQty = Math.max(1, Math.ceil(neededInCountUnits / item.units_per_order_unit))
        } else {
          // No conversion → order in count units
          suggestedOrderQty = Math.max(1, Math.ceil(neededInCountUnits))
          orderUnitLabel = item.count_unit
        }

        return {
          item,
          onHand,
          reorderLevel: item.reorder_level,
          par,
          neededInCountUnits,
          suggestedOrderQty,
          orderUnitLabel,
          gap: item.reorder_level - onHand,
        }
      })
      .filter((v): v is NonNullable<typeof v> => v !== null)
      .sort((a, b) => b.gap - a.gap)

    // Group by vendor
    const byVendor: Record<string, typeof rows> = {}
    for (const r of rows) {
      const v = r.item.vendor ?? 'Other'
      if (!byVendor[v]) byVendor[v] = []
      byVendor[v].push(r)
    }
    return { rows, byVendor }
  }, [inventoryItems, onHandCounts])

  // Auto-suggest multiplier based on weather
  const weatherMultiplierHint = (() => {
    if (weather.length === 0) return null
    const avgMax = weather.reduce((s, d) => s + d.maxTemp, 0) / weather.length
    const rainyDays = weather.filter(d => d.precipChance >= 50).length
    if (avgMax >= 85 && rainyDays <= 1) return { mult: 1.15, reason: '🌡️ Hot week — expect +15% volume' }
    if (rainyDays >= 3) return { mult: 0.90, reason: '🌧️ Rainy week — expect −10% volume' }
    if (avgMax >= 75 && rainyDays <= 2) return { mult: 1.05, reason: '☀️ Nice weather — slight +5% boost' }
    return null
  })()

  if (!isManager) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 text-sm">Manager access required.</p>
        <p className="text-gray-400 text-xs mt-1">Use the Manager login button in the top nav.</p>
      </div>
    )
  }

  const vendorOrder = ['Ben E. Keith', "Martin's Potato Buns", 'US Foods', "Sam's Club", 'Chef Store', 'Walmart', 'Webstaurantstore', 'Other']

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Order Builder</h1>
        <p className="text-sm text-gray-500 mt-1">Upload last week's Toast product mix to calculate what to order.</p>
      </div>

      {/* Reorder suggestions panel (based on inventory on-hand vs reorder levels) */}
      {reorderSuggestions.rows.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl overflow-hidden">
          <div className="px-5 py-3 bg-amber-100 border-b border-amber-200 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">🛒</span>
              <div>
                <div className="font-semibold text-amber-900 text-sm">
                  {reorderSuggestions.rows.length} item{reorderSuggestions.rows.length !== 1 ? 's' : ''} suggested to reorder
                </div>
                <div className="text-xs text-amber-700">
                  Based on latest inventory count vs. par &amp; reorder levels — independent of Toast sales
                </div>
              </div>
            </div>
            <div className="text-xs text-amber-800 bg-white border border-amber-200 rounded px-2 py-1">
              Counts as of the most recent inventory before {fmt(orderWeekStart)}
            </div>
          </div>

          <div className="p-4 space-y-4">
            {Object.entries(reorderSuggestions.byVendor)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([vendor, rows]) => (
                <div key={vendor}>
                  <h3 className="text-sm font-bold text-amber-900 uppercase tracking-wide mb-1.5">
                    🏪 {vendor}
                  </h3>
                  <div className="bg-white rounded-lg border border-amber-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-amber-50 border-b border-amber-200 text-left text-xs text-amber-800 uppercase tracking-wide">
                          <th className="px-3 py-1.5">Item</th>
                          <th className="px-3 py-1.5 text-right">On Hand</th>
                          <th className="px-3 py-1.5 text-right hidden sm:table-cell">Reorder</th>
                          <th className="px-3 py-1.5 text-right hidden sm:table-cell">Par</th>
                          <th className="px-3 py-1.5 text-right font-bold text-amber-900">Suggest Order</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(r => (
                          <tr key={r.item.id} className="border-b border-gray-100 last:border-0 hover:bg-amber-50/50">
                            <td className="px-3 py-1.5">
                              <div className="font-medium text-gray-800">{r.item.name}</div>
                              <div className="text-xs text-gray-400">
                                {r.item.list_type ?? 'Food'}
                                {r.item.storage_location ? ` · ${r.item.storage_location}` : ''}
                              </div>
                            </td>
                            <td className="px-3 py-1.5 text-right font-semibold text-red-700">
                              {r.onHand} {r.item.count_unit}
                            </td>
                            <td className="px-3 py-1.5 text-right text-gray-600 hidden sm:table-cell">
                              {r.reorderLevel} {r.item.count_unit}
                            </td>
                            <td className="px-3 py-1.5 text-right text-gray-600 hidden sm:table-cell">
                              {r.par} {r.item.count_unit}
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              <span className="text-lg font-bold text-orange-700">{r.suggestedOrderQty}</span>
                              <span className="text-xs text-gray-500 ml-1">{r.orderUnitLabel}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

            <p className="text-xs text-amber-700 italic">
              💡 Suggestions use the most recent inventory count for each item. Update counts on the Inventory tab to refresh these numbers.
            </p>
          </div>
        </div>
      )}

      {/* Week selector + Upload */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Ordering for week of</label>
            <input
              type="date"
              value={orderWeekStart}
              onChange={e => setOrderWeekStart(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <p className="text-xs text-gray-400 mt-1">{fmt(orderWeekStart)} – {fmt((() => { const d = new Date(orderWeekStart); d.setDate(d.getDate()+6); return d.toISOString().split('T')[0] })())}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Upload Toast Product Mix (ZIP or CSV)</label>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`relative rounded-xl border-2 border-dashed transition-colors ${
                dragOver
                  ? 'border-orange-500 bg-orange-100'
                  : parsedSales
                  ? 'border-green-400 bg-green-50'
                  : 'border-orange-300 bg-orange-50 hover:bg-orange-100'
              }`}
            >
              <label className="flex flex-col items-center justify-center cursor-pointer py-6 px-4 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip,.csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                {uploading ? (
                  <>
                    <span className="text-2xl mb-1">⏳</span>
                    <span className="text-sm font-medium text-orange-700">Parsing file…</span>
                  </>
                ) : parsedSales ? (
                  <>
                    <span className="text-2xl mb-1">✅</span>
                    <span className="text-sm font-medium text-green-700">{parsedSales.sales.length} menu items loaded</span>
                    <span className="text-xs text-green-600 mt-0.5">Drop a new file to replace</span>
                  </>
                ) : dragOver ? (
                  <>
                    <span className="text-3xl mb-1">📂</span>
                    <span className="text-sm font-medium text-orange-700">Drop it!</span>
                  </>
                ) : (
                  <>
                    <span className="text-3xl mb-2">📂</span>
                    <span className="text-sm font-medium text-orange-700">Drag & drop your Toast export here</span>
                    <span className="text-xs text-orange-500 mt-1">or click to browse — ZIP or CSV</span>
                  </>
                )}
              </label>
              {parsedSales && (
                <button
                  onClick={e => { e.preventDefault(); setParsedSales(null) }}
                  className="absolute top-2 right-2 text-gray-400 hover:text-red-500 text-xs px-1.5 py-0.5 rounded hover:bg-red-50"
                >
                  ✕
                </button>
              )}
            </div>
            {uploadError && <p className="text-xs text-red-600 mt-1">{uploadError}</p>}
          </div>
        </div>

        {/* Diagnostics panel — shows what the parser saw */}
        {diagnostics && (
          <details className="bg-slate-50 border border-slate-200 rounded-lg text-xs" open={parsedSales === null}>
            <summary className="px-3 py-2 cursor-pointer font-medium text-slate-700 hover:bg-slate-100">
              🔍 File diagnostics — {diagnostics.fileName}
            </summary>
            <div className="px-3 pb-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500">Item column detected:</span>{' '}
                  <span className="font-mono text-slate-800">{diagnostics.itemColumn}</span>
                </div>
                <div>
                  <span className="text-slate-500">Qty column detected:</span>{' '}
                  <span className="font-mono text-slate-800">{diagnostics.qtyColumn}</span>
                </div>
                <div>
                  <span className="text-slate-500">Rows in file:</span>{' '}
                  <span className="font-mono text-slate-800">{diagnostics.totalRows}</span>
                </div>
              </div>

              {diagnostics.headersFound.length > 0 && (
                <div>
                  <div className="text-slate-500 mb-1">All columns in file:</div>
                  <div className="flex flex-wrap gap-1">
                    {diagnostics.headersFound.map(h => (
                      <span key={h} className="bg-white border border-slate-200 rounded px-2 py-0.5 font-mono text-slate-700">{h}</span>
                    ))}
                  </div>
                </div>
              )}

              {diagnostics.unmatchedItems.length > 0 && (
                <div>
                  <div className="text-slate-500 mb-1">
                    Items in the file that <strong>didn't match</strong> our recipe list (top 30 by qty):
                  </div>
                  <div className="bg-white border border-slate-200 rounded max-h-64 overflow-y-auto">
                    <table className="w-full text-xs">
                      <tbody>
                        {diagnostics.unmatchedItems.slice(0, 30).map(it => (
                          <tr key={it.name} className="border-b border-slate-100 last:border-0">
                            <td className="px-2 py-1 text-slate-700">{it.name}</td>
                            <td className="px-2 py-1 text-right font-mono text-slate-500 w-16">{it.qty}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-slate-500 mt-1 italic">
                    Tell me which of these are our menu items and I'll add them to the mapper.
                  </p>
                </div>
              )}
            </div>
          </details>
        )}

        {parsedSales && (
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
            <strong>Loaded sales:</strong>{' '}
            {parsedSales.sales.map(s => `${s.menuItem} (${s.qtySold})`).join(' · ')}
            {parsedSales.modifiers.length > 0 && (
              <> &nbsp;|&nbsp; <strong>Modifiers:</strong>{' '}
              {parsedSales.modifiers.map(m => `${m.modifierName} (${m.qtySold})`).join(' · ')}</>
            )}
            <div className="mt-2 flex gap-2">
              <button
                onClick={saveSalesToDB}
                disabled={savingSales}
                className="bg-orange-600 text-white px-3 py-1 rounded text-xs hover:bg-orange-700 disabled:opacity-50"
              >
                {savingSales ? 'Saving…' : salesSaved ? '✓ Saved to history' : 'Save to weekly history'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Weather widget */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-semibold text-gray-800">🌤 Camp North End Weather — Order Week</h2>
          <span className="text-xs text-gray-400">source: weather.gov</span>
        </div>
        {weatherLoading ? (
          <p className="text-sm text-gray-400">Loading weather…</p>
        ) : weather.length === 0 ? (
          <p className="text-sm text-gray-400">No forecast available yet — NWS only forecasts ~7 days out. Check back closer to the week.</p>
        ) : (
          <>
            {weatherBundle && weatherBundle.daysCovered < 7 && (
              <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                <strong>{weatherBundle.daysCovered} of 7</strong> order-week days currently in the forecast. NWS only forecasts ~7 days ahead — remaining days will fill in as the week gets closer. Days outside the order week are dimmed for reference.
              </div>
            )}
            <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
              {weather.map(d => {
                const isOpen = expandedDay === d.date
                return (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => setExpandedDay(isOpen ? null : d.date)}
                    className={`text-center rounded-lg p-2 border transition-all ${
                      isOpen
                        ? 'bg-orange-50 border-orange-400 ring-2 ring-orange-300'
                        : d.inOrderWeek
                        ? 'bg-gray-50 border-transparent hover:bg-gray-100 hover:border-gray-300'
                        : 'bg-white border-dashed border-gray-200 opacity-60 hover:opacity-100'
                    }`}
                    title={d.inOrderWeek ? 'Click to see hourly breakdown' : 'Outside the order week — click for details'}
                  >
                    <div className="text-xs text-gray-500">{fmt(d.date).split(',')[0]}</div>
                    <div className="text-xl my-1">{weatherEmoji(d.description)}</div>
                    <div className="text-xs font-medium text-gray-800">{d.maxTemp}°</div>
                    <div className="text-xs text-gray-400">{d.minTemp}°</div>
                    {d.precipChance > 0 && (
                      <div className={`text-xs ${d.precipChance >= 50 ? 'text-blue-600 font-medium' : 'text-blue-400'}`}>
                        💧 {d.precipChance}%
                      </div>
                    )}
                    <div className="text-xs text-gray-400 leading-tight mt-0.5 line-clamp-2">{d.description}</div>
                  </button>
                )
              })}
            </div>

            {/* Expanded hourly detail for the selected day */}
            {expandedDay && (() => {
              const day = weather.find(d => d.date === expandedDay)
              const hours = (hoursByDate[expandedDay] ?? []).filter(h => h.hour >= 6 && h.hour <= 22)
              if (!day) return null
              const summary = summarizeRainWindow(hoursByDate[expandedDay] ?? [])
              const maxPrecip = Math.max(0, ...hours.map(h => h.precipChance))
              return (
                <div className="mt-4 bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-sm font-bold text-gray-800">{fmt(day.date)} — {day.description}</div>
                      {summary && <div className="text-xs text-gray-600 mt-0.5">{summary}</div>}
                    </div>
                    <button onClick={() => setExpandedDay(null)} className="text-gray-400 hover:text-gray-600 text-xs px-2 py-1">✕ Close</button>
                  </div>

                  {hours.length === 0 ? (
                    <p className="text-xs text-gray-500">No hourly data available for this day.</p>
                  ) : (
                    <>
                      {/* Hourly strip */}
                      <div className="overflow-x-auto -mx-1 px-1">
                        <div className="flex gap-1 min-w-fit">
                          {hours.map(h => {
                            const rainy = h.precipChance >= 30
                            const barHeight = Math.max(2, Math.round((h.precipChance / Math.max(100, maxPrecip)) * 40))
                            const fmtHour = (hr: number) => {
                              const suffix = hr >= 12 ? 'pm' : 'am'
                              const twelve = hr % 12 === 0 ? 12 : hr % 12
                              return `${twelve}${suffix}`
                            }
                            return (
                              <div key={h.time} className="flex flex-col items-center gap-1 min-w-[2.5rem]">
                                <div className="text-xs text-gray-500">{fmtHour(h.hour)}</div>
                                <div className="text-sm">{weatherEmoji(h.shortForecast)}</div>
                                <div className="text-xs font-medium text-gray-800">{h.temperature}°</div>
                                {/* Rain chance bar */}
                                <div className="h-12 w-3 bg-white rounded-sm border border-gray-200 flex items-end overflow-hidden">
                                  <div
                                    className={`w-full ${rainy ? 'bg-blue-500' : 'bg-blue-300'}`}
                                    style={{ height: `${barHeight}px` }}
                                  />
                                </div>
                                <div className={`text-xs ${rainy ? 'text-blue-700 font-semibold' : 'text-blue-400'}`}>
                                  {h.precipChance}%
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 mt-2 flex items-center gap-3">
                        <span>Hours 6am–10pm shown · bar height = rain chance</span>
                      </div>
                    </>
                  )}
                </div>
              )
            })()}

            {weatherMultiplierHint && (
              <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 flex items-center justify-between">
                <span className="text-sm text-blue-800">{weatherMultiplierHint.reason}</span>
                <button
                  onClick={() => setVolumeMultiplier(weatherMultiplierHint.mult)}
                  className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                >
                  Apply {((weatherMultiplierHint.mult - 1) * 100).toFixed(0)}%
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Events + volume multiplier */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Events */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800">📅 Events This Week</h2>
            <button
              onClick={() => setAddingEvent(!addingEvent)}
              className="text-xs text-orange-600 hover:text-orange-800 border border-orange-300 px-2 py-1 rounded"
            >
              + Add Event
            </button>
          </div>

          {addingEvent && (
            <div className="bg-orange-50 rounded-lg p-3 mb-3 space-y-2">
              <input
                type="text"
                placeholder="Event name (e.g. Food Truck Friday)"
                value={newEvent.event_name}
                onChange={e => setNewEvent(p => ({ ...p, event_name: e.target.value }))}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  value={newEvent.event_date}
                  onChange={e => setNewEvent(p => ({ ...p, event_date: e.target.value }))}
                  className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="5"
                    value={newEvent.impact_pct}
                    onChange={e => setNewEvent(p => ({ ...p, impact_pct: parseInt(e.target.value) || 0 }))}
                    className="w-16 border border-gray-300 rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                  <span className="text-sm text-gray-600">% boost</span>
                </div>
              </div>
              <input
                type="text"
                placeholder="Notes (optional)"
                value={newEvent.notes}
                onChange={e => setNewEvent(p => ({ ...p, notes: e.target.value }))}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <div className="flex gap-2">
                <button onClick={saveEventLog} disabled={savingEvent} className="bg-orange-600 text-white px-3 py-1.5 rounded text-xs hover:bg-orange-700 disabled:opacity-50">
                  {savingEvent ? 'Saving…' : 'Save Event'}
                </button>
                <button onClick={() => setAddingEvent(false)} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5">Cancel</button>
              </div>
            </div>
          )}

          {events.length === 0 ? (
            <p className="text-sm text-gray-400">No events logged for this week.</p>
          ) : (
            <div className="space-y-2">
              {events.map(ev => (
                <div key={ev.id} className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2">
                  <div>
                    <div className="text-sm font-medium text-gray-800">{ev.event_name}</div>
                    <div className="text-xs text-gray-500">{fmt(ev.event_date)} · +{ev.impact_pct}% volume</div>
                    {ev.notes && <div className="text-xs text-gray-400">{ev.notes}</div>}
                  </div>
                  <button onClick={() => deleteEvent(ev.id!)} className="text-gray-300 hover:text-red-400 text-xs ml-2">✕</button>
                </div>
              ))}
              <div className="text-xs text-gray-500 pt-1">
                Total event boost: +{events.reduce((s, e) => s + e.impact_pct, 0)}%
              </div>
            </div>
          )}
        </div>

        {/* Volume multiplier */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-3">⚡ Volume Multiplier</h2>
          <p className="text-xs text-gray-500 mb-4">Adjust up or down from last week's sales. 1.0 = same as last week.</p>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              value={volumeMultiplier}
              onChange={e => setVolumeMultiplier(parseFloat(e.target.value))}
              className="flex-1 accent-orange-600"
            />
            <div className="text-center w-20">
              <div className={`text-2xl font-bold ${volumeMultiplier > 1 ? 'text-green-600' : volumeMultiplier < 1 ? 'text-red-600' : 'text-gray-800'}`}>
                {volumeMultiplier.toFixed(2)}×
              </div>
              <div className="text-xs text-gray-500">
                {volumeMultiplier === 1 ? 'Same' : volumeMultiplier > 1 ? `+${((volumeMultiplier - 1) * 100).toFixed(0)}%` : `${((volumeMultiplier - 1) * 100).toFixed(0)}%`}
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-3 flex-wrap">
            {[0.8, 0.9, 1.0, 1.1, 1.2, 1.5].map(v => (
              <button
                key={v}
                onClick={() => setVolumeMultiplier(v)}
                className={`text-xs px-2 py-1 rounded border transition-colors ${volumeMultiplier === v ? 'bg-orange-600 text-white border-orange-600' : 'border-gray-300 text-gray-600 hover:border-orange-400'}`}
              >
                {v}×
              </button>
            ))}
          </div>
          <div className="mt-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">Waste buffer: {(wasteBuffer * 100).toFixed(0)}%</label>
            <input
              type="range"
              min="0"
              max="0.2"
              step="0.01"
              value={wasteBuffer}
              onChange={e => setWasteBuffer(parseFloat(e.target.value))}
              className="w-full accent-orange-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>0% (exact)</span><span>20% (generous buffer)</span>
            </div>
          </div>

          {events.length > 0 && (
            <div className="mt-3 bg-green-50 rounded-lg px-3 py-2 text-xs text-green-800">
              ✓ Event boost of +{events.reduce((s, e) => s + e.impact_pct, 0)}% is automatically applied on top of multiplier.
            </div>
          )}
        </div>
      </div>

      {/* Order sheet */}
      {needs.length === 0 ? (
        <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-8 text-center">
          <p className="text-gray-500 font-medium">Upload a Toast product mix to generate your order.</p>
          <p className="text-sm text-gray-400 mt-1">Go to Toast → Reports → Product Mix → Export → Download ZIP</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Order Sheet</h2>
            <div className="text-xs text-gray-500 bg-gray-100 rounded px-2 py-1">
              Based on {volumeMultiplier.toFixed(2)}× last week · {(wasteBuffer * 100).toFixed(0)}% buffer
            </div>
          </div>

          {vendorOrder
            .filter(vendor => grouped[vendor] && grouped[vendor].length > 0)
            .map(vendor => {
              const vendorNeeds = grouped[vendor]
              return (
                <div key={vendor}>
                  <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-2">
                    🏪 {vendor}
                  </h3>
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
                          <th className="px-4 py-2">Item</th>
                          <th className="px-4 py-2 text-right">Need (raw)</th>
                          <th className="px-4 py-2 text-right">On Hand</th>
                          <th className="px-4 py-2 text-right font-bold text-orange-700">Order Qty</th>
                          <th className="px-4 py-2">Unit</th>
                          <th className="px-4 py-2 text-xs text-gray-400">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vendorNeeds.map(need => {
                          // Match inventory item by name
                          const invItem = inventoryItems.find(i => i.name === need.item)
                          const onHand = invItem ? (onHandCounts[invItem.id] ?? null) : null

                          const rawDisplay = need.totalEach != null
                            ? `${Math.ceil(need.totalEach)} ea`
                            : need.totalOz != null
                            ? `${(need.totalOz / 16).toFixed(1)} lbs`
                            : need.totalLbs != null
                            ? `${need.totalLbs.toFixed(1)} lbs`
                            : '—'

                          return (
                            <tr key={need.item} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                              <td className="px-4 py-2 font-medium text-gray-800">{need.item}</td>
                              <td className="px-4 py-2 text-right text-gray-600">{rawDisplay}</td>
                              <td className="px-4 py-2 text-right text-gray-500">
                                {onHand != null
                                  ? <span className="font-medium">{onHand} {invItem?.count_unit}</span>
                                  : <span className="text-gray-300 text-xs">—</span>
                                }
                              </td>
                              <td className="px-4 py-2 text-right">
                                {need.orderQty != null ? (
                                  <span className="text-lg font-bold text-orange-700">{need.orderQty}</span>
                                ) : (
                                  <span className="text-gray-400 text-xs">calc pending</span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-gray-500 text-xs">{need.orderUnitLabel ?? '—'}</td>
                              <td className="px-4 py-2 text-gray-400 text-xs">{need.notes ?? ''}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}

          {/* Cucumbers fixed note */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
            <strong>🥒 Cucumbers:</strong> Always order 1 box/week (40 lb) → makes 2 × 22L containers of pickles. Not affected by volume multiplier.
          </div>

          {/* Sales detail */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="font-semibold text-gray-700 mb-3 text-sm">Sales Used for This Order</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {parsedSales?.sales.map(s => (
                <div key={s.menuItem} className="bg-gray-50 rounded-lg px-3 py-2">
                  <div className="text-xs text-gray-500">{s.menuItem}</div>
                  <div className="font-bold text-gray-800">{s.qtySold}</div>
                </div>
              ))}
            </div>
            {parsedSales?.modifiers && parsedSales.modifiers.length > 0 && (
              <>
                <h4 className="font-medium text-gray-600 mt-3 mb-2 text-xs uppercase tracking-wide">Modifiers</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {parsedSales.modifiers.map(m => (
                    <div key={m.modifierName} className="bg-gray-50 rounded-lg px-3 py-2">
                      <div className="text-xs text-gray-500">{m.modifierName}</div>
                      <div className="font-bold text-gray-800">{m.qtySold}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
