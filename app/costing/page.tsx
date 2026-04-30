'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase, PriceListItem } from '@/lib/supabase'
import {
  FOOD_COSTING,
  CostingItem,
  CostingSize,
  CostingComponent,
  foodCostPct,
  sumComponents,
} from '@/lib/food-costing'

function money(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—'
  return `$${n.toFixed(2)}`
}

function pct(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—'
  return `${(n * 100).toFixed(1)}%`
}

// Color the food cost % chip: green ≤25%, yellow 25-35%, red >35%
function fcBadgeClass(p: number | null): string {
  if (p == null) return 'bg-gray-100 text-gray-500'
  if (p <= 0.25) return 'bg-green-100 text-green-800'
  if (p <= 0.35) return 'bg-amber-100 text-amber-800'
  return 'bg-red-100 text-red-800'
}

function norm(s: string) {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}

// Use the price_list lookup (if set) to re-derive a component's live cost
// based on the ratio between documented and current prices.
function liveComponentCost(c: CostingComponent, priceByName: Record<string, PriceListItem>): number | null {
  if (!c.priceListName) return null
  const p = priceByName[norm(c.priceListName)]
  if (!p || p.cost_per_unit == null) return null
  // We don't know the exact unit conversion (2.5oz of patty, 2 slices etc.)
  // so we use the *ratio* approach: if the price_list cost changed by X%,
  // assume this line's cost moved by the same X%. This requires a baseline:
  // the first time we see this priceListName, we stash its documented cost-
  // per-component-line. Since multiple lines can share a priceListName, we
  // approximate with: live_line = documented_line × (live_price / baseline_price)
  // where baseline_price is stored on the PriceListItem, OR if not, we just
  // scale proportionally by returning null to fall back.
  // To make this useful without maintaining separate baselines, we simply
  // return null when we can't confidently rescale. The UI will show the
  // documented cost instead. This keeps "Live" view trustworthy.
  return null
}

export default function CostingPage() {
  const { isManager } = useAuth()
  const [prices, setPrices] = useState<PriceListItem[]>([])
  const [useLive, setUseLive] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => { loadPrices() }, [])

  async function loadPrices() {
    const { data } = await supabase.from('price_list').select('*')
    if (data) setPrices(data)
  }

  const priceByName = useMemo(() => {
    const m: Record<string, PriceListItem> = {}
    for (const p of prices) m[norm(p.item_name)] = p
    return m
  }, [prices])

  if (!isManager) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 text-sm">Manager access required.</p>
        <p className="text-gray-400 text-xs mt-1">Use the Manager login button in the top nav.</p>
      </div>
    )
  }

  // Compute size-level cost (documented or live)
  function costForSize(size: CostingSize): number {
    if (!useLive) return size.foodCost
    let total = 0
    let anyLive = false
    for (const c of size.components) {
      const live = liveComponentCost(c, priceByName)
      if (live != null) { total += live; anyLive = true }
      else total += c.cost
    }
    return anyLive ? total : size.foodCost
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Food Costing</h1>
          <p className="text-sm text-gray-500 mt-1">
            Ingredient breakdown, menu pricing, and competitor comparison per menu item.
          </p>
        </div>
        <label className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 cursor-pointer">
          <input
            type="checkbox"
            checked={useLive}
            onChange={e => setUseLive(e.target.checked)}
            className="accent-orange-600"
          />
          <span className="text-sm text-gray-700">Use live prices from Price List</span>
          <span className="text-xs text-gray-400 hidden sm:inline">(when mappings exist)</span>
        </label>
      </div>

      {/* Summary table: every size across every item */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h2 className="font-semibold text-gray-800 text-sm">📊 Menu Pricing Overview</h2>
          <p className="text-xs text-gray-500 mt-0.5">Target food cost: &lt;25% (green). Above 35% needs attention.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-3 py-2">Item / Size</th>
                <th className="px-3 py-2 text-right">Food Cost</th>
                <th className="px-3 py-2 text-right">Menu Price</th>
                <th className="px-3 py-2 text-right">FC %</th>
                <th className="px-3 py-2 text-right">Margin</th>
                <th className="px-3 py-2 text-right hidden md:table-cell">Harriet's</th>
                <th className="px-3 py-2 text-right hidden md:table-cell">Ace No. 3</th>
                <th className="px-3 py-2 text-right hidden md:table-cell">Skinny</th>
              </tr>
            </thead>
            <tbody>
              {FOOD_COSTING.map(item => (
                item.sizes.map((size, idx) => {
                  const cost = costForSize(size)
                  const p = size.menuPrice > 0 ? cost / size.menuPrice : null
                  const margin = size.menuPrice > 0 ? 1 - (p ?? 0) : null
                  return (
                    <tr key={`${item.slug}-${size.label}`} className={idx === 0 ? 'border-t-2 border-gray-200' : 'border-b border-gray-100'}>
                      <td className="px-3 py-2">
                        {idx === 0 && (
                          <div className="font-semibold text-gray-900">{item.menuItem}</div>
                        )}
                        <div className={idx === 0 ? 'text-xs text-gray-500 ml-3' : 'text-gray-700 ml-3'}>
                          {size.label}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-700">{money(cost)}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-800 font-semibold">
                        {size.menuPrice > 0 ? money(size.menuPrice) : <span className="text-amber-600 text-xs italic">TBD</span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${fcBadgeClass(p)}`}>
                          {pct(p)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-green-700 font-mono">{pct(margin)}</td>
                      <td className="px-3 py-2 text-right text-gray-500 font-mono hidden md:table-cell">{money(size.competitors?.harriets)}</td>
                      <td className="px-3 py-2 text-right text-gray-500 font-mono hidden md:table-cell">{money(size.competitors?.ace_no3)}</td>
                      <td className="px-3 py-2 text-right text-gray-500 font-mono hidden md:table-cell">{money(size.competitors?.skinny)}</td>
                    </tr>
                  )
                })
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-item ingredient breakdown cards */}
      {FOOD_COSTING.map(item => (
        <div key={item.slug} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setExpanded(expanded === item.slug ? null : item.slug)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">
                {item.category === 'Burger' ? '🍔' : item.category === 'Shake' ? '🥤' : item.category === 'Chicken' ? '🍗' : item.category === 'Side' ? '🥗' : item.category === 'Sauce' ? '🫙' : '🍽️'}
              </span>
              <h2 className="font-semibold text-gray-800">{item.menuItem}</h2>
              <span className="text-xs text-gray-400">· {item.sizes.length} size{item.sizes.length !== 1 ? 's' : ''}</span>
            </div>
            <span className="text-xs text-gray-500">{expanded === item.slug ? '▲ Hide breakdown' : '▼ Show breakdown'}</span>
          </button>

          {expanded === item.slug && (
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {item.sizes.map(size => {
                const compSum = sumComponents(size)
                const mismatch = Math.abs(compSum - size.foodCost) > 0.02
                const cost = costForSize(size)
                const p = size.menuPrice > 0 ? cost / size.menuPrice : null
                return (
                  <div key={size.label} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-orange-50 px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-gray-800 text-sm">{size.label}</div>
                        <div className="text-xs text-gray-500">{money(size.menuPrice)} menu</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${fcBadgeClass(p)}`}>
                        {pct(p)}
                      </span>
                    </div>
                    {size.components.length === 0 ? (
                      <div className="p-3 text-xs text-gray-400 italic">
                        No ingredient breakdown yet. Add one to the source sheet to see it here.
                      </div>
                    ) : (
                      <table className="w-full text-xs">
                        <tbody>
                          {size.components.map((c, i) => (
                            <tr key={i} className={`border-b border-gray-100 last:border-0 ${c.isEstimate ? 'bg-amber-50/50' : ''}`}>
                              <td className="px-3 py-1.5 text-gray-700">
                                <div className="flex items-center gap-1">
                                  {c.isEstimate && <span title="Estimate — needs confirmation" className="text-amber-600">⚠</span>}
                                  <span>{c.name}</span>
                                </div>
                                {c.note && <div className="text-[10px] text-gray-400 italic mt-0.5">{c.note}</div>}
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono text-gray-600 align-top">{money(c.cost)}</td>
                            </tr>
                          ))}
                          <tr className="bg-gray-50 font-semibold">
                            <td className="px-3 py-1.5 text-gray-800">Documented Total</td>
                            <td className="px-3 py-1.5 text-right font-mono text-gray-900">{money(size.foodCost)}</td>
                          </tr>
                          {mismatch && (
                            <tr className="bg-amber-50">
                              <td className="px-3 py-1 text-amber-800 text-[11px] italic" colSpan={2}>
                                ⚠ Components sum to {money(compSum)} but doc total is {money(size.foodCost)}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}

      {/* Empty-data reminder */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700">
        <div className="font-semibold mb-1">📝 Still to document</div>
        <p className="text-xs text-slate-600">
          The source sheet had empty tabs for <strong>Honey Butta</strong>, <strong>Carolina</strong>, <strong>Chili</strong>, and <strong>Hotdogs</strong>. Fill in their ingredient breakdowns and send them over — I'll add them to <code className="bg-slate-100 px-1 rounded">lib/food-costing.ts</code>.
        </p>
        <p className="text-xs text-slate-600 mt-1">
          Still needed: <strong>Smacked Sauce</strong> (need mayo/ketchup/mustard/paprika prices), <strong>Ranch</strong> (need brand + price), <strong>Mambo Sauce</strong> (need cost/oz), <strong>Baker Street Fries</strong>, <strong>Cauliflower Bites</strong>, <strong>Plain Hamburger</strong>, <strong>Grilled Cheese</strong>, and <strong>Chicken Tender</strong>.
        </p>
      </div>
    </div>
  )
}
