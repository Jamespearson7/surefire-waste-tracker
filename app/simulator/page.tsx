'use client'

import { useState, useMemo } from 'react'
import { useAuth } from '@/lib/auth'
import { FOOD_COSTING, CostingSize } from '@/lib/food-costing'

function money(n: number) { return `$${n.toFixed(2)}` }
function pct(n: number)   { return `${(n * 100).toFixed(1)}%` }

function fcBadge(p: number | null): string {
  if (p == null) return 'bg-gray-100 text-gray-500'
  if (p <= 0.25) return 'bg-green-100 text-green-800'
  if (p <= 0.35) return 'bg-amber-100 text-amber-800'
  return 'bg-red-100 text-red-800'
}

// ── Baseline (current confirmed) prices ──────────────────────────────────────
const BASELINES = {
  pattyPrice:     0.85,   // per 2.5oz patty
  chickenPerLb:   3.45,   // per lb  →  6oz serving = $1.29
  bunPrice:       0.34,   // per bun
  cheesePrice:    0.08,   // per slice
  softServePrice: 0.77,   // per 14oz serving
  mamboPerOz:     0.242,  // per oz
} as const

type SliderKey = keyof typeof BASELINES

// Map a component's priceListName to which slider controls it
function getSliderKey(priceListName?: string): SliderKey | null {
  if (!priceListName) return null
  const n = priceListName.toLowerCase()
  if (n === 'beef patty')           return 'pattyPrice'
  if (n === 'chicken breast')       return 'chickenPerLb'
  if (n.includes('bun'))            return 'bunPrice'
  if (n === 'american cheese slice') return 'cheesePrice'
  if (n === 'soft serve mix')       return 'softServePrice'
  if (n === 'mambo sauce')          return 'mamboPerOz'
  return null
}

// Recalculate a size's food cost given new slider values
function simFoodCost(size: CostingSize, vals: Record<SliderKey, number>): number {
  if (!size.components.length) return size.foodCost
  return size.components.reduce((sum, c) => {
    const key = getSliderKey(c.priceListName)
    if (!key) return sum + c.cost
    return sum + c.cost * (vals[key] / BASELINES[key])
  }, 0)
}

// Slider configuration
const SLIDERS: {
  key: SliderKey
  emoji: string
  label: string
  unit: string
  min: number
  max: number
  step: number
  affects: string
}[] = [
  {
    key: 'pattyPrice',
    emoji: '🥩', label: 'Beef Patty', unit: '/ patty',
    min: 0.50, max: 1.50, step: 0.01,
    affects: 'Classic · Ogden · Tyson Corner · Plain Hamburger',
  },
  {
    key: 'chickenPerLb',
    emoji: '🍗', label: 'Chicken Breast', unit: '/ lb',
    min: 2.00, max: 5.00, step: 0.05,
    affects: 'Honey Butta · Retha Mae',
  },
  {
    key: 'bunPrice',
    emoji: '🍞', label: "Martin's Potato Bun", unit: '/ bun',
    min: 0.15, max: 0.65, step: 0.01,
    affects: 'All burgers & chicken sandwiches',
  },
  {
    key: 'cheesePrice',
    emoji: '🧀', label: 'American Cheese Slice', unit: '/ slice',
    min: 0.03, max: 0.20, step: 0.005,
    affects: 'Classic · Ogden · Tyson Corner',
  },
  {
    key: 'softServePrice',
    emoji: '🍦', label: 'Soft Serve Mix', unit: '/ 14oz serving',
    min: 0.40, max: 1.50, step: 0.01,
    affects: 'All milkshakes',
  },
  {
    key: 'mamboPerOz',
    emoji: '🌶️', label: 'Mambo Sauce', unit: '/ oz',
    min: 0.10, max: 0.50, step: 0.01,
    affects: 'Tyson Corner · Mambo Sauce dip',
  },
]

// Beef patty is 2.5oz — distributors quote in lbs
const PATTY_OZ   = 2.5
const OZ_PER_LB  = 16
const PATTY_PER_LB = OZ_PER_LB / PATTY_OZ   // 6.4 patties per lb

function pattyToLb(perPatty: number)  { return perPatty  * PATTY_PER_LB }
function lbToPatty(perLb:   number)  { return perLb     / PATTY_PER_LB }

export default function SimulatorPage() {
  const { isManager } = useAuth()
  const [vals, setVals] = useState<Record<SliderKey, number>>({ ...BASELINES })
  const [pattyInLb, setPattyInLb] = useState(false)   // toggle: show $/lb instead of $/patty
  const [weeklyBurgers,  setWeeklyBurgers]  = useState(150)
  const [weeklyChicken,  setWeeklyChicken]  = useState(100)
  const [weeklyShakes,   setWeeklyShakes]   = useState(80)

  function update(key: SliderKey, val: number) {
    setVals(prev => ({ ...prev, [key]: val }))
  }
  function reset() { setVals({ ...BASELINES }) }

  const hasChanges = (Object.keys(BASELINES) as SliderKey[]).some(
    k => Math.abs(vals[k] - BASELINES[k]) > 0.0001
  )

  // Compute before/after for every menu size
  const results = useMemo(() => FOOD_COSTING.flatMap(item =>
    item.sizes
      .filter(s => s.menuPrice > 0 && (s.foodCost > 0 || s.components.length > 0))
      .map(s => {
        const curCost  = s.foodCost
        const simCost  = simFoodCost(s, vals)
        const curFc    = s.menuPrice > 0 ? curCost  / s.menuPrice : null
        const simFc    = s.menuPrice > 0 ? simCost  / s.menuPrice : null
        const delta    = simFc != null && curFc != null ? simFc - curFc : null
        const changed  = Math.abs(simCost - curCost) > 0.001
        return { item: item.menuItem, category: item.category, size: s.label,
                 menuPrice: s.menuPrice, curCost, simCost, curFc, simFc, delta, changed }
      })
  ), [vals])

  // Per-category average saving per item sold
  function avgSavingFor(cat: string) {
    const rows = results.filter(r => r.category === cat && r.changed)
    if (!rows.length) return 0
    return rows.reduce((s, r) => s + (r.curCost - r.simCost), 0) / rows.length
  }

  const burgerSavingPer  = avgSavingFor('Burger')
  const chickenSavingPer = avgSavingFor('Chicken')
  const shakeSavingPer   = avgSavingFor('Shake')

  const weeklyTotal = burgerSavingPer * weeklyBurgers
                    + chickenSavingPer * weeklyChicken
                    + shakeSavingPer   * weeklyShakes

  if (!isManager) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 text-sm">Manager access required.</p>
        <p className="text-gray-400 text-xs mt-1">Use the Manager login button in the top nav.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Food Cost Simulator</h1>
          <p className="text-sm text-gray-500 mt-1">
            Drag any slider to instantly see how ingredient price changes affect food cost across your entire menu.
          </p>
        </div>
        {hasChanges && (
          <button
            onClick={reset}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors border border-gray-200"
          >
            ↺ Reset to Current Prices
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6 items-start">

        {/* ── LEFT: Sliders + Impact Calculator ── */}
        <div className="space-y-4">

          {/* Sliders */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h2 className="font-semibold text-gray-800 text-sm">🎛️ Ingredient Price Sliders</h2>
              <p className="text-xs text-gray-500 mt-0.5">Drag to simulate. Green = savings · Red = cost increase.</p>
            </div>
            <div className="p-4 space-y-6">
              {SLIDERS.map(cfg => {
                const isPatty  = cfg.key === 'pattyPrice'
                const inLb     = isPatty && pattyInLb

                // All display values in the active unit
                const cur      = inLb ? pattyToLb(vals[cfg.key]) : vals[cfg.key]
                const baseline = inLb ? pattyToLb(BASELINES[cfg.key]) : BASELINES[cfg.key]
                const sliderMin = inLb ? pattyToLb(cfg.min) : cfg.min
                const sliderMax = inLb ? pattyToLb(cfg.max) : cfg.max
                const sliderStep = inLb ? Math.round(cfg.step * PATTY_PER_LB * 100) / 100 : cfg.step

                const rawCur   = vals[cfg.key]  // always per-patty for delta calc
                const rawBase  = BASELINES[cfg.key]
                const changed  = Math.abs(rawCur - rawBase) > 0.0001
                const deltaPct = ((rawCur - rawBase) / rawBase) * 100

                const displayUnit = isPatty ? (pattyInLb ? '/ lb' : '/ patty') : cfg.unit

                return (
                  <div key={cfg.key}>
                    {/* Label row */}
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="text-sm font-semibold text-gray-800">
                          {cfg.emoji} {cfg.label}
                        </span>
                        <div className="text-[11px] text-gray-400 mt-0.5">{cfg.affects}</div>
                      </div>
                      <div className="text-right ml-2 flex-shrink-0">
                        <div className="text-base font-bold font-mono text-gray-900">
                          {money(cur)}
                          <span className="text-xs font-normal text-gray-400 ml-1">{displayUnit}</span>
                        </div>
                        {/* Beef patty: show the other unit as secondary */}
                        {isPatty && (
                          <div className="text-[11px] text-gray-400 font-mono">
                            {pattyInLb
                              ? `= ${money(lbToPatty(cur))} / patty`
                              : `= ${money(pattyToLb(cur))} / lb`}
                          </div>
                        )}
                        {changed && (
                          <div className={`text-xs font-bold ${deltaPct < 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {deltaPct > 0 ? '▲' : '▼'} {Math.abs(deltaPct).toFixed(1)}% vs current
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Unit toggle pill — only on beef patty */}
                    {isPatty && (
                      <div className="flex items-center gap-1 mb-2">
                        <span className="text-[11px] text-gray-400">Price in:</span>
                        <button
                          onClick={() => setPattyInLb(false)}
                          className={`text-[11px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                            !pattyInLb
                              ? 'bg-orange-600 text-white'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          per patty
                        </button>
                        <button
                          onClick={() => setPattyInLb(true)}
                          className={`text-[11px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                            pattyInLb
                              ? 'bg-orange-600 text-white'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          per lb
                        </button>
                        <span className="text-[10px] text-gray-300 ml-1">2.5oz patty · 6.4/lb</span>
                      </div>
                    )}

                    {/* Slider */}
                    <input
                      type="range"
                      min={sliderMin}
                      max={sliderMax}
                      step={sliderStep}
                      value={cur}
                      onChange={e => {
                        const v = parseFloat(e.target.value)
                        update(cfg.key, inLb ? lbToPatty(v) : v)
                      }}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-orange-600 bg-gray-200"
                    />

                    {/* Min / baseline marker / max */}
                    <div className="flex justify-between text-[10px] mt-1">
                      <span className="text-gray-400">{money(sliderMin)}</span>
                      <button
                        onClick={() => update(cfg.key, BASELINES[cfg.key])}
                        className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                          changed
                            ? 'text-orange-600 bg-orange-50 hover:bg-orange-100 font-semibold cursor-pointer'
                            : 'text-gray-400 cursor-default'
                        }`}
                      >
                        {changed ? `reset (${money(baseline)})` : `current: ${money(baseline)}`}
                      </button>
                      <span className="text-gray-400">{money(sliderMax)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Weekly Impact Calculator */}
          <div className={`rounded-xl border shadow-sm overflow-hidden transition-all ${hasChanges ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
            <div className="px-4 py-3 bg-orange-50 border-b border-orange-200">
              <h2 className="font-semibold text-orange-800 text-sm">📈 Weekly Impact Calculator</h2>
              <p className="text-xs text-orange-600 mt-0.5">
                {hasChanges ? 'Enter weekly covers to see projected savings.' : 'Move a slider to unlock.'}
              </p>
            </div>
            <div className="p-4 bg-white space-y-4">

              {[
                { emoji: '🍔', label: 'Burgers / week',            val: weeklyBurgers, set: setWeeklyBurgers, saving: burgerSavingPer },
                { emoji: '🍗', label: 'Chicken sandwiches / week', val: weeklyChicken, set: setWeeklyChicken, saving: chickenSavingPer },
                { emoji: '🥤', label: 'Shakes / week',             val: weeklyShakes,  set: setWeeklyShakes,  saving: shakeSavingPer  },
              ].map(row => {
                const weekImpact = row.saving * row.val
                return (
                  <div key={row.label}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-gray-700 flex-1">{row.emoji} {row.label}</span>
                      <input
                        type="number"
                        min={0}
                        value={row.val}
                        onChange={e => row.set(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-20 border border-gray-200 rounded px-2 py-1 text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    </div>
                    {row.saving !== 0 && (
                      <div className={`text-xs text-right font-mono font-semibold ${weekImpact > 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {weekImpact > 0 ? '−' : '+'}{money(Math.abs(weekImpact))}/wk
                        <span className="font-normal text-gray-400 ml-1">
                          ({row.saving > 0 ? '−' : '+'}{money(Math.abs(row.saving))} / item)
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Totals */}
              <div className="border-t border-gray-200 pt-3 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-800">
                    Weekly {weeklyTotal >= 0 ? 'savings' : 'extra cost'}
                  </span>
                  <span className={`text-xl font-bold font-mono ${weeklyTotal > 0 ? 'text-green-700' : weeklyTotal < 0 ? 'text-red-700' : 'text-gray-400'}`}>
                    {weeklyTotal > 0 ? '−' : weeklyTotal < 0 ? '+' : ''}{money(Math.abs(weeklyTotal))}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Annual projection (52 weeks)</span>
                  <span className={`text-sm font-bold font-mono ${weeklyTotal > 0 ? 'text-green-700' : weeklyTotal < 0 ? 'text-red-700' : 'text-gray-400'}`}>
                    {weeklyTotal > 0 ? '−' : weeklyTotal < 0 ? '+' : ''}{money(Math.abs(weeklyTotal * 52))}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Live Results Table ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="font-semibold text-gray-800 text-sm">📊 Live Menu Results</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {hasChanges
                  ? `${results.filter(r => r.changed).length} of ${results.length} items affected by current sliders.`
                  : 'Adjust a slider to see real-time food cost changes.'}
              </p>
            </div>
            {hasChanges && (
              <div className="flex gap-2 text-xs">
                <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded font-medium">
                  ↓ {results.filter(r => r.changed && (r.delta ?? 0) < 0).length} improved
                </span>
                <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded font-medium">
                  ↑ {results.filter(r => r.changed && (r.delta ?? 0) > 0).length} higher
                </span>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-3 py-2 text-left">Item</th>
                  <th className="px-2 py-2 text-right whitespace-nowrap">Price</th>
                  <th className="px-2 py-2 text-right whitespace-nowrap">Current</th>
                  <th className="px-2 py-2 text-right whitespace-nowrap">Simulated</th>
                  <th className="px-2 py-2 text-right whitespace-nowrap">Change</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr
                    key={i}
                    className={`border-b border-gray-100 transition-colors ${r.changed ? 'bg-orange-50/40' : ''}`}
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900 text-sm">{r.item}</div>
                      <div className="text-[11px] text-gray-400">{r.size}</div>
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-gray-600 text-xs whitespace-nowrap">{money(r.menuPrice)}</td>
                    <td className="px-2 py-2 text-right">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${fcBadge(r.curFc)}`}>
                        {r.curFc != null ? pct(r.curFc) : '—'}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${r.changed ? fcBadge(r.simFc) : 'text-gray-300'}`}>
                        {r.changed && r.simFc != null ? pct(r.simFc) : '—'}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right whitespace-nowrap">
                      {r.changed && r.delta != null ? (
                        <span className={`text-xs font-bold font-mono ${r.delta < 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {r.delta > 0 ? '▲' : '▼'} {pct(Math.abs(r.delta))}
                        </span>
                      ) : (
                        <span className="text-gray-200 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!hasChanges && (
            <div className="px-4 py-8 text-center">
              <div className="text-3xl mb-2">🎛️</div>
              <p className="text-sm text-gray-500">Move a slider on the left to simulate a price change.</p>
              <p className="text-xs text-gray-400 mt-1">All menu items update instantly.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
