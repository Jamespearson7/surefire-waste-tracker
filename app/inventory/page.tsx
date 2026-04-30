'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase, InventoryItem, InventoryCount, InventoryListType, PriceListItem } from '@/lib/supabase'

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const LIST_TYPES: { key: InventoryListType; label: string; icon: string }[] = [
  { key: 'Food',           label: 'Food',           icon: '🍔' },
  { key: 'Supplies',       label: 'Supplies',       icon: '📦' },
  { key: 'FOH',            label: 'FOH',            icon: '🪑' },
  { key: 'Walk-in Cooler', label: 'Walk-in Cooler', icon: '🧊' },
]

const CATEGORY_ORDER = [
  // Food
  'Proteins',
  'Bread & Buns',
  'Frozen',
  'Produce & Fresh Items',
  'Produce',
  'Dairy & Cheese',
  'Dry Seasonings & Spices',
  'Condiments, Sauces & Bases',
  'Sauces & Condiments',
  'Dessert',
  // Supplies / FOH
  'Packaging & Branding',
  'Cleaning Supplies & Tools',
  'Beverage & Service Supplies',
  'Safety & Apparel',
  'Equipment & Maintenance',
  'Office/Utility',
  'Other',
]

type CountDraft = Record<string, string> // item_id → input value

// Normalize a name/unit for fuzzy matching against price_list
function norm(s: string) {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}

// Estimate $ value of an on-hand count for an item, given the price list.
// Returns null when we can't figure out a price or a unit conversion.
function estimateValue(
  item: InventoryItem,
  onHand: number,
  priceByName: Record<string, PriceListItem>,
): number | null {
  const price = priceByName[norm(item.name)]
  if (!price || price.cost_per_unit == null) return null
  const pUnit = norm(price.unit)
  const countUnit = norm(item.count_unit)
  const orderUnit = norm(item.order_unit)

  // Same unit → direct
  if (pUnit === countUnit) return onHand * price.cost_per_unit

  // Price is per order unit, inventory counted in smaller units
  if (pUnit === orderUnit && item.units_per_order_unit && item.units_per_order_unit > 0) {
    return (onHand / item.units_per_order_unit) * price.cost_per_unit
  }

  // Common unit aliases
  const synonyms: Record<string, string[]> = {
    'lb': ['lbs', 'pound', 'pounds'],
    'lbs': ['lb', 'pound', 'pounds'],
    'each': ['ea', 'piece', 'pieces'],
    'ea': ['each', 'piece', 'pieces'],
  }
  const pAliases = synonyms[pUnit] ?? []
  if (pAliases.includes(countUnit)) return onHand * price.cost_per_unit
  if (pAliases.includes(orderUnit) && item.units_per_order_unit && item.units_per_order_unit > 0) {
    return (onHand / item.units_per_order_unit) * price.cost_per_unit
  }

  // Last resort: just multiply — better to show something than nothing
  return onHand * price.cost_per_unit
}

function formatMoney(n: number): string {
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [counts, setCounts] = useState<CountDraft>({})
  const [lastCounts, setLastCounts] = useState<Record<string, InventoryCount>>({})
  const [prices, setPrices] = useState<PriceListItem[]>([])
  const [shift, setShift] = useState<'Opening' | 'Closing'>('Opening')
  const [name, setName] = useState('')
  const [date, setDate] = useState(today())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeList, setActiveList] = useState<InventoryListType>('Food')
  const [showLowStockAll, setShowLowStockAll] = useState(false)
  const [alerting,      setAlerting]      = useState(false)
  const [alertResult,   setAlertResult]   = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    loadItems()
    loadPrices()
  }, [])

  useEffect(() => {
    if (items.length > 0) loadLastCounts()
  }, [items, date])

  async function loadItems() {
    const { data } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('active', true)
      .order('sort_order')
    if (data) setItems(data)
    setLoading(false)
  }

  async function loadLastCounts() {
    const { data } = await supabase
      .from('inventory_counts')
      .select('*')
      .lte('count_date', date)
      .order('count_date', { ascending: false })

    if (data) {
      const map: Record<string, InventoryCount> = {}
      for (const row of data) {
        if (!map[row.item_id]) map[row.item_id] = row
      }
      setLastCounts(map)
    }
  }

  async function loadPrices() {
    const { data } = await supabase.from('price_list').select('*')
    if (data) setPrices(data)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return alert('Please enter your name.')

    const entries = Object.entries(counts).filter(([, v]) => v !== '' && !isNaN(parseFloat(v)))
    if (entries.length === 0) return alert('Please enter at least one count.')

    setSaving(true)

    const rows: Omit<InventoryCount, 'id' | 'created_at'>[] = entries.map(([item_id, v]) => ({
      item_id,
      count_date: date,
      shift,
      counted_by: name.trim(),
      on_hand: parseFloat(v),
    }))

    const { error } = await supabase.from('inventory_counts').upsert(rows, {
      onConflict: 'item_id,count_date,shift',
    })

    setSaving(false)
    if (error) { alert('Error saving: ' + error.message); return }

    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    setCounts({})
    loadLastCounts()
  }

  // Index price list by normalized name for quick lookup
  const priceByName = useMemo(() => {
    const m: Record<string, PriceListItem> = {}
    for (const p of prices) m[norm(p.item_name)] = p
    return m
  }, [prices])

  // Effective on-hand for an item: draft input (if present) else last count
  function effectiveOnHand(item: InventoryItem): number | null {
    const draft = counts[item.id]
    if (draft !== undefined && draft !== '' && !isNaN(parseFloat(draft))) {
      return parseFloat(draft)
    }
    const last = lastCounts[item.id]
    return last ? last.on_hand : null
  }

  // Low stock list: everything across all list_types with on-hand < reorder level
  const lowStockItems = useMemo(() => {
    return items
      .map(item => {
        const onHand = effectiveOnHand(item)
        if (onHand == null) return null
        if (item.reorder_level == null) return null
        // reorder_level may be text like "8 cases" — extract leading number
        const threshold = parseFloat(String(item.reorder_level))
        if (isNaN(threshold)) return null   // skip text-only thresholds
        if (onHand > threshold) return null
        return { item, onHand, threshold }
      })
      .filter((v): v is { item: InventoryItem; onHand: number; threshold: number } => v !== null)
      .sort((a, b) => {
        // Sort by how far below reorder (most urgent first)
        const aGap = a.threshold - a.onHand
        const bGap = b.threshold - b.onHand
        return bGap - aGap
      })
  }, [items, counts, lastCounts])

  // Filter items by active list type. Items without list_type default to 'Food' for backward compat.
  const filteredItems = items.filter(i => (i.list_type ?? 'Food') === activeList)

  const grouped = CATEGORY_ORDER.reduce<Record<string, InventoryItem[]>>((acc, cat) => {
    const catItems = filteredItems.filter(i => i.category === cat)
    if (catItems.length > 0) acc[cat] = catItems
    return acc
  }, {})

  const knownCats = new Set(CATEGORY_ORDER)
  const otherItems = filteredItems.filter(i => !knownCats.has(i.category))
  if (otherItems.length > 0) grouped['Other'] = [...(grouped['Other'] ?? []), ...otherItems]

  const totalFilled = Object.values(counts).filter(v => v !== '').length

  // Counts per tab (for the badge)
  const perListCount: Record<InventoryListType, number> = {
    'Food': 0, 'Supplies': 0, 'FOH': 0, 'Walk-in Cooler': 0,
  }
  for (const i of items) {
    const lt = (i.list_type ?? 'Food') as InventoryListType
    if (perListCount[lt] !== undefined) perListCount[lt]++
  }

  // Grand total $ value for currently active list
  const activeListValue = useMemo(() => {
    let total = 0
    let priced = 0
    let counted = 0
    for (const item of filteredItems) {
      const onHand = effectiveOnHand(item)
      if (onHand == null) continue
      counted++
      const v = estimateValue(item, onHand, priceByName)
      if (v != null) { total += v; priced++ }
    }
    return { total, priced, counted }
  }, [filteredItems, counts, lastCounts, priceByName])

  async function sendRestockAlert() {
    setAlerting(true)
    setAlertResult(null)
    try {
      const res  = await fetch('/api/restock-alert', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        setAlertResult({ ok: true, msg: `✓ Alert sent to ${data.sent} contact${data.sent !== 1 ? 's' : ''} — ${data.lowCount} low item${data.lowCount !== 1 ? 's' : ''} flagged.` })
      } else {
        setAlertResult({ ok: false, msg: data.error ?? 'Failed to send alert.' })
      }
    } catch {
      setAlertResult({ ok: false, msg: 'Network error — could not send alert.' })
    }
    setAlerting(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inventory Count</h1>
        <p className="text-sm text-gray-500 mt-1">Count what's on hand at the start or end of your shift.</p>
      </div>

      {/* Low-stock alert panel — spans all list types */}
      {lowStockItems.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              type="button"
              onClick={() => setShowLowStockAll(v => !v)}
              className="flex items-center gap-2 text-left flex-1"
            >
              <span className="text-lg">⚠️</span>
              <div>
                <div className="font-semibold text-red-800 text-sm">
                  {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} below reorder level
                </div>
                <div className="text-xs text-red-600">
                  Across all lists — tap to {showLowStockAll ? 'hide' : 'view'}
                </div>
              </div>
              <span className="text-red-400 text-xs ml-2">{showLowStockAll ? '▲' : '▼'}</span>
            </button>
            <button
              type="button"
              onClick={sendRestockAlert}
              disabled={alerting}
              className="ml-3 flex-shrink-0 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              {alerting ? 'Sending…' : '📲 Alert Team'}
            </button>
          </div>
          {alertResult && (
            <div className={`px-4 pb-3 text-xs font-medium ${alertResult.ok ? 'text-green-700' : 'text-red-700'}`}>
              {alertResult.msg}
            </div>
          )}
          {showLowStockAll && (
            <div className="border-t border-red-200 bg-white max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-red-50 text-red-700">
                  <tr>
                    <th className="text-left px-3 py-1.5">Item</th>
                    <th className="text-left px-3 py-1.5 hidden sm:table-cell">List</th>
                    <th className="text-right px-3 py-1.5">On Hand</th>
                    <th className="text-right px-3 py-1.5">Reorder At</th>
                    <th className="text-right px-3 py-1.5">Par</th>
                    <th className="text-left px-3 py-1.5 hidden sm:table-cell">Vendor</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockItems.map(({ item, onHand }) => (
                    <tr key={item.id} className="border-b border-gray-100 last:border-0 hover:bg-red-50">
                      <td className="px-3 py-1.5 font-medium text-gray-800">
                        {item.name}
                        <button
                          onClick={() => setActiveList((item.list_type ?? 'Food') as InventoryListType)}
                          className="ml-2 text-[10px] text-orange-600 hover:underline"
                        >
                          jump →
                        </button>
                      </td>
                      <td className="px-3 py-1.5 text-gray-500 hidden sm:table-cell">{item.list_type ?? 'Food'}</td>
                      <td className="px-3 py-1.5 text-right font-semibold text-red-700">
                        {onHand} {item.count_unit}
                      </td>
                      <td className="px-3 py-1.5 text-right text-gray-600">{item.reorder_level} {item.count_unit}</td>
                      <td className="px-3 py-1.5 text-right text-gray-600">{item.par_level ?? '—'} {item.count_unit}</td>
                      <td className="px-3 py-1.5 text-gray-500 hidden sm:table-cell">{item.vendor ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* List-type tabs */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-1 flex flex-wrap gap-1">
        {LIST_TYPES.map(lt => {
          const isActive = activeList === lt.key
          return (
            <button
              key={lt.key}
              type="button"
              onClick={() => setActiveList(lt.key)}
              className={`flex-1 min-w-[110px] px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-orange-600 text-white shadow'
                  : 'text-gray-700 hover:bg-orange-50'
              }`}
            >
              <span className="mr-1.5">{lt.icon}</span>
              {lt.label}
              <span className={`ml-1.5 text-xs ${isActive ? 'text-orange-100' : 'text-gray-400'}`}>
                ({perListCount[lt.key]})
              </span>
            </button>
          )
        })}
      </div>

      {/* $ value summary for active list */}
      {activeListValue.counted > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between text-sm">
          <div>
            <span className="text-emerald-800 font-semibold">💰 Est. {activeList} on-hand value:</span>{' '}
            <span className="text-emerald-900 font-bold">{formatMoney(activeListValue.total)}</span>
          </div>
          <div className="text-xs text-emerald-700">
            {activeListValue.priced} of {activeListValue.counted} items priced
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header fields */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Shift</label>
              <select
                value={shift}
                onChange={e => setShift(e.target.value as 'Opening' | 'Closing')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                <option>Opening</option>
                <option>Closing</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Your Name</label>
              <input
                type="text"
                placeholder="Shift lead name"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-8">Loading inventory items…</p>
        ) : items.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
            <p className="text-amber-700 font-medium">No inventory items set up yet.</p>
            <p className="text-sm text-amber-600 mt-1">A manager needs to run the inventory setup SQL in Supabase first.</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
            <p className="text-amber-700 font-medium">No items in {activeList} yet.</p>
            <p className="text-sm text-amber-600 mt-1">Run <code className="bg-amber-100 px-1 rounded">supabase/inventory_expand.sql</code> in Supabase to load the full list.</p>
          </div>
        ) : (
          <>
            {Object.entries(grouped).map(([category, catItems]) => {
              const catValueTotal = catItems.reduce((sum, item) => {
                const onHand = effectiveOnHand(item)
                if (onHand == null) return sum
                const v = estimateValue(item, onHand, priceByName)
                return sum + (v ?? 0)
              }, 0)
              return (
                <div key={category}>
                  <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-2 flex items-center gap-2 flex-wrap">
                    <span>{CATEGORY_ICONS[category] ?? '📦'}</span>
                    {category}
                    <span className="text-gray-400 font-normal normal-case text-xs">
                      ({catItems.filter(i => counts[i.id] !== undefined && counts[i.id] !== '').length}/{catItems.length} counted)
                    </span>
                    {catValueTotal > 0 && (
                      <span className="text-emerald-700 font-semibold normal-case text-xs ml-auto">
                        {formatMoney(catValueTotal)}
                      </span>
                    )}
                  </h2>
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
                          <th className="px-4 py-2">Item</th>
                          <th className="px-4 py-2 text-right hidden sm:table-cell">Par</th>
                          <th className="px-4 py-2 text-right">Last Count</th>
                          <th className="px-4 py-2 text-right">On Hand Today</th>
                          <th className="px-4 py-2 text-right hidden md:table-cell">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {catItems.map(item => {
                          const last = lastCounts[item.id]
                          const val = counts[item.id] ?? ''
                          const hasVal = val !== ''
                          const onHand = effectiveOnHand(item)
                          const reorderThreshold = parseFloat(String(item.reorder_level ?? ''))
                          const belowReorder =
                            hasVal && !isNaN(reorderThreshold) && parseFloat(val) <= reorderThreshold
                          const rowValue = onHand != null ? estimateValue(item, onHand, priceByName) : null
                          return (
                            <tr key={item.id} className={`border-b border-gray-100 last:border-0 ${hasVal ? 'bg-orange-50' : 'hover:bg-gray-50'}`}>
                              <td className="px-4 py-2">
                                <div className="font-medium text-gray-800">{item.name}</div>
                                <div className="text-xs text-gray-400 flex flex-wrap gap-x-2">
                                  {item.storage_location && <span>{item.storage_location}</span>}
                                  {item.vendor && <span>· {item.vendor}</span>}
                                </div>
                              </td>
                              <td className="px-4 py-2 text-right hidden sm:table-cell">
                                {item.par_level != null ? (
                                  <div>
                                    <span className="text-gray-700 font-medium">{item.par_level}</span>
                                    <div className="text-xs text-gray-400">{item.count_unit}</div>
                                  </div>
                                ) : (
                                  <span className="text-gray-300 text-xs">—</span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-right">
                                {last ? (
                                  <div>
                                    <span className="font-medium text-gray-700">{last.on_hand} {item.count_unit}</span>
                                    <div className="text-xs text-gray-400">{last.count_date} · {last.shift}</div>
                                  </div>
                                ) : (
                                  <span className="text-gray-300 text-xs">No prior count</span>
                                )}
                              </td>
                              <td className="px-4 py-2 w-36">
                                <div className="flex items-center gap-1.5 justify-end">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    placeholder="0"
                                    value={val}
                                    onChange={e => setCounts(prev => ({ ...prev, [item.id]: e.target.value }))}
                                    className={`w-20 border rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-orange-400 ${
                                      belowReorder
                                        ? 'border-red-400 bg-red-50'
                                        : hasVal
                                        ? 'border-orange-400 bg-white'
                                        : 'border-gray-300'
                                    }`}
                                  />
                                  <span className="text-xs text-gray-500 w-8">{item.count_unit}</span>
                                </div>
                                {belowReorder && (
                                  <div className="text-xs text-red-600 text-right mt-0.5">⚠ below reorder</div>
                                )}
                              </td>
                              <td className="px-4 py-2 text-right hidden md:table-cell">
                                {rowValue != null ? (
                                  <span className="text-emerald-700 font-medium text-xs">{formatMoney(rowValue)}</span>
                                ) : (
                                  <span className="text-gray-300 text-xs">—</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}

            <div className="sticky bottom-4">
              <button
                type="submit"
                disabled={saving || totalFilled === 0}
                className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white font-semibold py-3 rounded-xl text-sm transition-colors shadow-lg"
              >
                {saving ? 'Saving…' : saved ? `✓ Saved ${totalFilled} item${totalFilled !== 1 ? 's' : ''}!` : `Save Count (${totalFilled} item${totalFilled !== 1 ? 's' : ''} entered)`}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}

const CATEGORY_ICONS: Record<string, string> = {
  'Proteins': '🥩',
  'Bread & Buns': '🍔',
  'Frozen': '🧊',
  'Produce': '🥬',
  'Produce & Fresh Items': '🥬',
  'Dairy & Cheese': '🧀',
  'Dry Seasonings & Spices': '🧂',
  'Condiments, Sauces & Bases': '🧴',
  'Sauces & Condiments': '🧴',
  'Dessert': '🍦',
  'Packaging & Branding': '📦',
  'Cleaning Supplies & Tools': '🧽',
  'Beverage & Service Supplies': '🥤',
  'Safety & Apparel': '🧤',
  'Equipment & Maintenance': '🔧',
  'Office/Utility': '📎',
  'Other': '📦',
}
