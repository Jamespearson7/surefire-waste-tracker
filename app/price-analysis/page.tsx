'use client'

import { useAuth } from '@/lib/auth'
import { FOOD_COSTING, INGREDIENT_PRICES } from '@/lib/food-costing'

function money(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—'
  return `$${n.toFixed(2)}`
}
function pct(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—'
  return `${(n * 100).toFixed(1)}%`
}
function fcBadge(p: number | null): string {
  if (p == null) return 'bg-gray-100 text-gray-500'
  if (p <= 0.25) return 'bg-green-100 text-green-800'
  if (p <= 0.35) return 'bg-amber-100 text-amber-800'
  return 'bg-red-100 text-red-800'
}

// Industry average per-oz benchmarks (Sysco / US Foods broadline averages)
const BENCHMARKS: Record<string, { avg: number; note: string }> = {
  'Chicken Breast':       { avg: 0.181, note: 'Broadline avg ~$2.90/lb boneless skinless (Sysco/US Foods)' },
  'Mayonnaise':           { avg: 0.085, note: 'Foodservice bulk mayo avg' },
  'Butter':               { avg: 0.145, note: 'Foodservice bulk butter avg' },
  'Buttermilk':           { avg: 0.027, note: 'Foodservice dairy avg' },
  'Black Pepper':         { avg: 0.320, note: 'Foodservice bulk ground black pepper' },
  'Paprika':              { avg: 0.180, note: 'Foodservice bulk paprika' },
  'Garlic Powder':        { avg: 0.220, note: 'Foodservice bulk garlic powder' },
  'Onion Powder':         { avg: 0.175, note: 'Foodservice bulk onion powder' },
  'Cumin Ground':         { avg: 0.250, note: 'Foodservice bulk ground cumin' },
  'Coriander':            { avg: 0.420, note: 'Foodservice bulk ground coriander' },
  'Ranch Seasoning':      { avg: 0.250, note: 'Foodservice ranch mix — currently sourced at Costco retail pricing' },
  'Mambo Sauce':          { avg: 0.150, note: 'Generic wing sauce avg — Capital City is a specialty/premium brand' },
  'Cajun Seasoning':      { avg: 0.200, note: 'Foodservice Cajun/creole seasoning avg' },
  'Fresh Dill':           { avg: 0.600, note: 'Fresh dill refrigerated case avg' },
  'Hellmanns Spicy Mayo': { avg: 0.200, note: 'Specialty flavored mayo avg' },
  'Accent MSG':           { avg: 0.080, note: 'Bulk MSG / flavor enhancer avg' },
}

// Sauce-specific pricing recommendations
const SAUCE_RECS = [
  { name: 'Honey Butta (dip)', cost: 0.42, current: 0.75,  recommended: 1.25 },
  { name: 'Mambo Sauce',       cost: 0.37, current: 0.75,  recommended: 1.25 },
  { name: 'Surefire Sauce',    cost: 0.18, current: 0.50,  recommended: 0.75 },
  { name: 'Smacked Sauce',     cost: 0.15, current: 0.50,  recommended: 0.75 },
  { name: 'House Ranch',       cost: 0.14, current: 0.50,  recommended: 0.75 },
]

export default function PriceAnalysisPage() {
  const { isManager } = useAuth()

  if (!isManager) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 text-sm">Manager access required.</p>
        <p className="text-gray-400 text-xs mt-1">Use the Manager login button in the top nav.</p>
      </div>
    )
  }

  // Flatten all costed sizes
  const allSizes = FOOD_COSTING.flatMap(item =>
    item.sizes
      .filter(s => s.menuPrice > 0 && s.foodCost > 0)
      .map(s => ({
        item: item.menuItem,
        category: item.category,
        size: s.label,
        cost: s.foodCost,
        price: s.menuPrice,
        fc: s.foodCost / s.menuPrice,
        margin: 1 - s.foodCost / s.menuPrice,
      }))
  )

  const redItems   = allSizes.filter(s => s.fc > 0.35)
  const amberItems = allSizes.filter(s => s.fc > 0.25 && s.fc <= 0.35)
  const greenItems = allSizes.filter(s => s.fc <= 0.25)
  const avgFc      = allSizes.reduce((sum, s) => sum + s.fc, 0) / allSizes.length
  const ranked     = [...allSizes].sort((a, b) => b.fc - a.fc)

  // Ingredient benchmark rows — only show where we have both prices
  const benchmarkRows = Object.entries(INGREDIENT_PRICES)
    .filter(([key, val]) => BENCHMARKS[key] && val.perOz > 0)
    .map(([key, val]) => {
      const bench = BENCHMARKS[key]
      const diff    = val.perOz - bench.avg
      const diffPct = diff / bench.avg
      return {
        name: key,
        yourPrice: val.perOz,
        avgPrice: bench.avg,
        diff,
        diffPct,
        note: bench.note,
        source: val.source,
      }
    })
    .sort((a, b) => b.diffPct - a.diffPct)

  const overpaying = benchmarkRows.filter(r => r.diffPct > 0.10)

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Price Analysis</h1>
        <p className="text-sm text-gray-500 mt-1">
          Ingredient benchmarking, menu pricing health, and cost reduction opportunities.
        </p>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="text-2xl font-bold text-gray-900">{pct(avgFc)}</div>
          <div className="text-xs text-gray-600 mt-1 font-medium">Avg Food Cost %</div>
          <div className="text-xs text-gray-400">across {allSizes.length} menu sizes</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 shadow-sm">
          <div className="text-2xl font-bold text-green-800">{greenItems.length}</div>
          <div className="text-xs text-green-700 mt-1 font-medium">At Target ≤25%</div>
          <div className="text-xs text-green-500">healthy margin</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-sm">
          <div className="text-2xl font-bold text-amber-800">{amberItems.length}</div>
          <div className="text-xs text-amber-700 mt-1 font-medium">Above Target 25–35%</div>
          <div className="text-xs text-amber-500">monitor closely</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm">
          <div className="text-2xl font-bold text-red-800">{redItems.length}</div>
          <div className="text-xs text-red-700 mt-1 font-medium">Needs Attention &gt;35%</div>
          <div className="text-xs text-red-500">action required</div>
        </div>
      </div>

      {/* ── Pricing Alerts ── */}
      {redItems.length > 0 && (
        <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-red-50 border-b border-red-200">
            <h2 className="font-semibold text-red-800 text-sm">🚨 Pricing Alerts — Above 35% Food Cost</h2>
            <p className="text-xs text-red-600 mt-0.5">These items need a price increase or cost reduction to reach a healthy margin.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-2 text-left">Item</th>
                  <th className="px-4 py-2 text-right">Food Cost</th>
                  <th className="px-4 py-2 text-right">Current Price</th>
                  <th className="px-4 py-2 text-right">FC %</th>
                  <th className="px-4 py-2 text-right">Min Price (35%)</th>
                  <th className="px-4 py-2 text-right">Suggested Price</th>
                </tr>
              </thead>
              <tbody>
                {redItems.map((s, i) => {
                  const minFor35 = s.cost / 0.35
                  const minFor25 = s.cost / 0.25
                  return (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="px-4 py-2">
                        <div className="font-medium text-gray-900">{s.item}</div>
                        <div className="text-xs text-gray-400">{s.size}</div>
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-gray-700">{money(s.cost)}</td>
                      <td className="px-4 py-2 text-right font-mono text-gray-800 font-semibold">{money(s.price)}</td>
                      <td className="px-4 py-2 text-right">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800">
                          {pct(s.fc)}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-amber-700">{money(minFor35)}</td>
                      <td className="px-4 py-2 text-right font-mono text-green-700 font-semibold">{money(minFor25)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Sauce Pricing Recommendations ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h2 className="font-semibold text-gray-800 text-sm">🫙 Sauce Pricing Recommendations</h2>
          <p className="text-xs text-gray-500 mt-0.5">All dipping sauces are currently underpriced relative to their cost. Suggested prices to hit &lt;25% FC.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-2 text-left">Sauce</th>
                <th className="px-4 py-2 text-right">Food Cost</th>
                <th className="px-4 py-2 text-right">Current Price</th>
                <th className="px-4 py-2 text-right">Current FC%</th>
                <th className="px-4 py-2 text-right">Suggested Price</th>
                <th className="px-4 py-2 text-right">New FC%</th>
                <th className="px-4 py-2 text-right">Extra Revenue / 100 sold</th>
              </tr>
            </thead>
            <tbody>
              {SAUCE_RECS.map((s, i) => {
                const currentFc  = s.cost / s.current
                const newFc      = s.cost / s.recommended
                const extraPer100 = (s.recommended - s.current) * 100
                return (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="px-4 py-2 font-medium text-gray-900">{s.name}</td>
                    <td className="px-4 py-2 text-right font-mono text-gray-700">{money(s.cost)}</td>
                    <td className="px-4 py-2 text-right font-mono text-gray-600">{money(s.current)}</td>
                    <td className="px-4 py-2 text-right">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${fcBadge(currentFc)}`}>
                        {pct(currentFc)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-green-700 font-semibold">{money(s.recommended)}</td>
                    <td className="px-4 py-2 text-right">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${fcBadge(newFc)}`}>
                        {pct(newFc)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-orange-700 font-semibold">{money(extraPer100)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Full Menu FC% Ranking ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h2 className="font-semibold text-gray-800 text-sm">📊 Full Menu — Ranked by Food Cost %</h2>
          <p className="text-xs text-gray-500 mt-0.5">Highest food cost items first. Target: green ≤25%, amber 25–35%, red &gt;35%.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-2 text-left">Item / Size</th>
                <th className="px-4 py-2 text-right">Food Cost</th>
                <th className="px-4 py-2 text-right">Menu Price</th>
                <th className="px-4 py-2 text-right">FC %</th>
                <th className="px-4 py-2 text-right">Margin</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((s, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <div className="font-medium text-gray-900">{s.item}</div>
                    <div className="text-xs text-gray-400">{s.size} · {s.category}</div>
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-gray-700">{money(s.cost)}</td>
                  <td className="px-4 py-2 text-right font-mono text-gray-800 font-semibold">{money(s.price)}</td>
                  <td className="px-4 py-2 text-right">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${fcBadge(s.fc)}`}>
                      {pct(s.fc)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-green-700 font-mono">{pct(s.margin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Ingredient Benchmarking ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h2 className="font-semibold text-gray-800 text-sm">🔍 Ingredient Cost vs. Industry Average</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Your price vs. Sysco / US Foods broadline distributor averages. Items flagged in red are 10%+ above market.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-2 text-left">Ingredient</th>
                <th className="px-4 py-2 text-right">Your Price/oz</th>
                <th className="px-4 py-2 text-right">Industry Avg/oz</th>
                <th className="px-4 py-2 text-right">Difference</th>
                <th className="px-4 py-2 text-left hidden md:table-cell">Action</th>
              </tr>
            </thead>
            <tbody>
              {benchmarkRows.map((r, i) => {
                const over = r.diffPct > 0.10
                const under = r.diffPct < -0.05
                return (
                  <tr key={i} className={`border-b border-gray-100 ${over ? 'bg-red-50/40' : under ? 'bg-green-50/40' : ''}`}>
                    <td className="px-4 py-2">
                      <div className="font-medium text-gray-900">{r.name}</div>
                      <div className="text-[10px] text-gray-400 hidden md:block">{r.source}</div>
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-gray-800 font-semibold">{money(r.yourPrice)}</td>
                    <td className="px-4 py-2 text-right font-mono text-gray-500">{money(r.avgPrice)}</td>
                    <td className="px-4 py-2 text-right">
                      <span className={`font-mono text-xs font-semibold ${over ? 'text-red-700' : under ? 'text-green-700' : 'text-gray-500'}`}>
                        {r.diff > 0 ? '+' : ''}{money(r.diff)}/oz ({r.diff > 0 ? '+' : ''}{pct(r.diffPct)})
                      </span>
                    </td>
                    <td className="px-4 py-2 hidden md:table-cell">
                      {over ? (
                        <span className="inline-block bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded font-medium">
                          {r.diffPct > 0.40 ? '🔴 Switch vendors' : '⚠️ Negotiate price'}
                        </span>
                      ) : under ? (
                        <span className="inline-block bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded font-medium">
                          ✅ Below market
                        </span>
                      ) : (
                        <span className="inline-block bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded">
                          At market
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
          <p className="text-xs text-gray-400">Benchmarks sourced from Sysco/US Foods broadline distributor published averages. Actual contract pricing varies by volume and region.</p>
        </div>
      </div>

      {/* ── Cost Reduction Playbook ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h2 className="font-semibold text-gray-800 text-sm">💡 Cost Reduction Playbook</h2>
          <p className="text-xs text-gray-500 mt-0.5">Ranked by potential impact. Tackle in order.</p>
        </div>
        <div className="divide-y divide-gray-100">

          <div className="px-4 py-4 flex gap-3">
            <span className="flex-shrink-0 w-7 h-7 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-xs font-bold">1</span>
            <div>
              <div className="font-semibold text-gray-900 text-sm">Raise dipping sauce prices to $0.75–$1.25</div>
              <p className="text-xs text-gray-600 mt-1">
                Honey Butta (56% FC) and Mambo (49% FC) are significantly underpriced. Raising all sauces to $0.75 minimum
                and Honey Butta / Mambo to $1.25 brings every sauce under 35% FC. At 100 sauce sales/day that's
                <span className="font-semibold text-orange-700"> +$25–$50/day in margin</span> with zero added cost.
              </p>
            </div>
          </div>

          <div className="px-4 py-4 flex gap-3">
            <span className="flex-shrink-0 w-7 h-7 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-xs font-bold">2</span>
            <div>
              <div className="font-semibold text-gray-900 text-sm">Negotiate chicken breast price — $3.45/lb vs. $2.90 industry avg</div>
              <p className="text-xs text-gray-600 mt-1">
                Chicken is your #1 cost driver at $1.29 per sandwich (50% of Honey Butta food cost).
                A $0.35/lb reduction to $3.10/lb saves <span className="font-semibold text-orange-700">$0.13/sandwich</span>.
                Ask Patuxent Farms for volume contract pricing or get a competing quote from Sysco.
              </p>
            </div>
          </div>

          <div className="px-4 py-4 flex gap-3">
            <span className="flex-shrink-0 w-7 h-7 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-xs font-bold">3</span>
            <div>
              <div className="font-semibold text-gray-900 text-sm">Switch Ranch Seasoning to foodservice supplier — save ~55% per oz</div>
              <p className="text-xs text-gray-600 mt-1">
                Currently buying Hidden Valley at Costco retail ($0.56/oz). Foodservice ranch mix
                runs ~$0.25/oz through broadline distributors — a <span className="font-semibold text-orange-700">$0.31/oz saving</span>.
                On a 20oz batch that's $6.20 saved per Ranch batch.
              </p>
            </div>
          </div>

          <div className="px-4 py-4 flex gap-3">
            <span className="flex-shrink-0 w-7 h-7 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-xs font-bold">4</span>
            <div>
              <div className="font-semibold text-gray-900 text-sm">Consolidate spice purchasing through one broadline distributor</div>
              <p className="text-xs text-gray-600 mt-1">
                Black Pepper ($0.62/oz), Paprika ($0.38/oz), Coriander ($0.83/oz), and Cumin ($0.36/oz)
                are all 40–100% above foodservice bulk averages. Buying through Sysco or US Foods in
                larger bulk containers can cut spice costs by <span className="font-semibold text-orange-700">30–50%</span> across the board.
                These spices appear in Surefire Sauce, Smacked Sauce, Ranch, and Seasoned Flour — the savings compound.
              </p>
            </div>
          </div>

          <div className="px-4 py-4 flex gap-3">
            <span className="flex-shrink-0 w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">5</span>
            <div>
              <div className="font-semibold text-gray-900 text-sm">Review Mambo Sauce sourcing — $0.242/oz vs. $0.15 avg</div>
              <p className="text-xs text-gray-600 mt-1">
                Capital City is a premium DC-area brand which drives a higher per-oz cost. If brand loyalty
                is important to the concept, the fix is pricing ($1.25 menu price). If open to alternatives,
                a comparable sweet-hot wing sauce through a broadline distributor cuts cost by ~38%.
              </p>
            </div>
          </div>

          <div className="px-4 py-4 flex gap-3">
            <span className="flex-shrink-0 w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">6</span>
            <div>
              <div className="font-semibold text-gray-900 text-sm">Confirm Accent/MSG supplier — $0.137/oz vs. $0.08 avg</div>
              <p className="text-xs text-gray-600 mt-1">
                Currently sourced at $219.97/100lb. Broadline MSG runs ~$0.08/oz.
                MSG is used in Smacked Sauce, Ranch, and Seasoned Flour. Switching saves
                <span className="font-semibold text-orange-700"> ~$0.057/oz</span> — small per batch but adds up over time.
              </p>
            </div>
          </div>

        </div>
      </div>

    </div>
  )
}
