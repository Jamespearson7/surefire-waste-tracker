'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase, ShiftWasteEntry, PrepWasteEntry } from '@/lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts'

type MonthFilter = string  // 'YYYY-MM'

function toMonthStr(date: Date) {
  return date.toISOString().slice(0, 7)
}

export default function DashboardPage() {
  const { isManager } = useAuth()
  const [month, setMonth] = useState(toMonthStr(new Date()))
  const [shiftFilter, setShiftFilter] = useState<'All' | 'Opening' | 'Closing'>('All')
  const [shiftEntries, setShiftEntries] = useState<ShiftWasteEntry[]>([])
  const [prepEntries, setPrepEntries] = useState<PrepWasteEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isManager) return
    load()
  }, [isManager, month])

  async function load() {
    setLoading(true)
    const from = `${month}-01`
    // Get first day of next month, then use lt — avoids invalid dates like April 31
    const [y, m] = month.split('-').map(Number)
    const nextMonth = new Date(y, m, 1)  // month index is 1-based here so this gives first of next month
    const to = nextMonth.toISOString().split('T')[0]

    const [sw, pw] = await Promise.all([
      supabase.from('shift_waste_entries').select('*').gte('date', from).lt('date', to).order('date'),
      supabase.from('prep_waste_entries').select('*').gte('date', from).lt('date', to).order('date'),
    ])
    if (sw.data) setShiftEntries(sw.data)
    if (pw.data) setPrepEntries(pw.data)
    setLoading(false)
  }

  if (!isManager) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 text-sm">Manager access required.</p>
        <p className="text-gray-400 text-xs mt-1">Use the Manager login button in the top nav.</p>
      </div>
    )
  }

  const filteredShift = shiftFilter === 'All'
    ? shiftEntries
    : shiftEntries.filter(e => e.shift === shiftFilter)
  const filteredPrep = shiftFilter === 'All'
    ? prepEntries
    : prepEntries.filter(e => e.shift === shiftFilter)

  const totalShiftCost = filteredShift.reduce((s, e) => s + (e.total_cost ?? 0), 0)
  const totalPrepCost = filteredPrep.reduce((s, e) => s + (e.waste_cost ?? 0), 0)
  const totalCost = totalShiftCost + totalPrepCost

  const openingShift = shiftEntries.filter(e => e.shift === 'Opening').reduce((s, e) => s + (e.total_cost ?? 0), 0)
  const closingShift = shiftEntries.filter(e => e.shift === 'Closing').reduce((s, e) => s + (e.total_cost ?? 0), 0)
  const openingPrep = prepEntries.filter(e => e.shift === 'Opening').reduce((s, e) => s + (e.waste_cost ?? 0), 0)
  const closingPrep = prepEntries.filter(e => e.shift === 'Closing').reduce((s, e) => s + (e.waste_cost ?? 0), 0)

  // Daily averages
  const uniqueDates = [...new Set(filteredShift.map(e => e.date).concat(filteredPrep.map(e => e.date)))]
  const dailyAvg = uniqueDates.length > 0 ? totalCost / uniqueDates.length : 0

  // Top items by cost
  const itemCosts: Record<string, number> = {}
  filteredShift.forEach(e => {
    if (e.total_cost) itemCosts[e.item] = (itemCosts[e.item] ?? 0) + e.total_cost
  })
  const topItems = Object.entries(itemCosts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }))

  // Daily cost trend
  const dailyCosts: Record<string, number> = {}
  filteredShift.forEach(e => {
    if (e.total_cost) dailyCosts[e.date] = (dailyCosts[e.date] ?? 0) + e.total_cost
  })
  filteredPrep.forEach(e => {
    if (e.waste_cost) dailyCosts[e.date] = (dailyCosts[e.date] ?? 0) + e.waste_cost
  })
  const dailyData = Object.entries(dailyCosts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date: date.slice(5), value: parseFloat(value.toFixed(2)) }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Manager Dashboard</h1>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <select
            value={shiftFilter}
            onChange={e => setShiftFilter(e.target.value as 'All' | 'Opening' | 'Closing')}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option>All</option>
            <option>Opening</option>
            <option>Closing</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Waste Cost" value={`$${totalCost.toFixed(2)}`} color="orange" />
            <StatCard label="Daily Average" value={`$${dailyAvg.toFixed(2)}`} color="gray" />
            <StatCard label="Shift Waste" value={`$${totalShiftCost.toFixed(2)}`} color="gray" />
            <StatCard label="Prep Waste" value={`$${totalPrepCost.toFixed(2)}`} color="gray" />
          </div>

          {/* Opening vs Closing */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Opening Shift</p>
              <p className="text-2xl font-bold text-gray-900">${(openingShift + openingPrep).toFixed(2)}</p>
              <p className="text-xs text-gray-400 mt-1">
                Shift: ${openingShift.toFixed(2)} · Prep: ${openingPrep.toFixed(2)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Closing Shift</p>
              <p className="text-2xl font-bold text-gray-900">${(closingShift + closingPrep).toFixed(2)}</p>
              <p className="text-xs text-gray-400 mt-1">
                Shift: ${closingShift.toFixed(2)} · Prep: ${closingPrep.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Charts */}
          {topItems.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h2 className="font-semibold text-gray-800 mb-4">Top Waste Items by Cost</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topItems} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <XAxis type="number" tickFormatter={v => `$${v}`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Cost']} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {topItems.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? '#ea580c' : '#fed7aa'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {dailyData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h2 className="font-semibold text-gray-800 mb-4">Daily Waste Cost</h2>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={dailyData}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={v => `$${v}`} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Cost']} />
                  <Bar dataKey="value" fill="#fdba74" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Full log */}
          <div>
            <h2 className="font-semibold text-gray-800 mb-3">All Shift Waste Entries</h2>
            {filteredShift.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6 bg-white rounded-xl border border-gray-200">No entries for this period.</p>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Shift</th>
                      <th className="px-3 py-2">Lead</th>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2">Reason</th>
                      <th className="px-3 py-2">Qty</th>
                      <th className="px-3 py-2">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredShift.map(e => (
                      <tr key={e.id} className="border-b border-gray-100 last:border-0">
                        <td className="px-3 py-2 text-gray-500">{e.date}</td>
                        <td className="px-3 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            e.shift === 'Opening' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                          }`}>{e.shift}</span>
                        </td>
                        <td className="px-3 py-2">{e.shift_lead}</td>
                        <td className="px-3 py-2 font-medium">{e.item}</td>
                        <td className="px-3 py-2 text-gray-500">{e.loss_reason}</td>
                        <td className="px-3 py-2">{e.qty_wasted} {e.unit}</td>
                        <td className="px-3 py-2 font-medium">
                          {e.total_cost != null ? `$${e.total_cost.toFixed(2)}` : <span className="text-amber-500 text-xs">TBD</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h2 className="font-semibold text-gray-800 mb-3">All Prep Waste Entries</h2>
            {filteredPrep.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6 bg-white rounded-xl border border-gray-200">No prep entries for this period.</p>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Shift</th>
                      <th className="px-3 py-2">Person</th>
                      <th className="px-3 py-2">Ingredient</th>
                      <th className="px-3 py-2">Purchased</th>
                      <th className="px-3 py-2">Waste</th>
                      <th className="px-3 py-2">Yield</th>
                      <th className="px-3 py-2">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPrep.map(e => (
                      <tr key={e.id} className="border-b border-gray-100 last:border-0">
                        <td className="px-3 py-2 text-gray-500">{e.date}</td>
                        <td className="px-3 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            e.shift === 'Opening' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                          }`}>{e.shift}</span>
                        </td>
                        <td className="px-3 py-2">{e.prep_person}</td>
                        <td className="px-3 py-2 font-medium">{e.ingredient}</td>
                        <td className="px-3 py-2">{e.total_purchased_lbs} lbs</td>
                        <td className="px-3 py-2">{e.waste_weight_lbs} lbs</td>
                        <td className="px-3 py-2">
                          {e.yield_pct != null ? (
                            <span className={e.yield_pct < 70 ? 'text-red-600 font-medium' : 'text-green-700'}>
                              {e.yield_pct}%
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-2 font-medium">
                          {e.waste_cost != null ? `$${e.waste_cost.toFixed(2)}` : <span className="text-amber-500 text-xs">TBD</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: 'orange' | 'gray' }) {
  return (
    <div className={`rounded-xl border shadow-sm p-4 ${
      color === 'orange' ? 'bg-orange-600 border-orange-500' : 'bg-white border-gray-200'
    }`}>
      <p className={`text-xs font-medium uppercase tracking-wide mb-1 ${
        color === 'orange' ? 'text-orange-100' : 'text-gray-500'
      }`}>{label}</p>
      <p className={`text-xl font-bold ${
        color === 'orange' ? 'text-white' : 'text-gray-900'
      }`}>{value}</p>
    </div>
  )
}
