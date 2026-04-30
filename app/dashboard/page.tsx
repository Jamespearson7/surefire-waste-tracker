'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase, ShiftWasteEntry, PrepWasteEntry } from '@/lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts'

function toDateStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function firstOfMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

export default function DashboardPage() {
  const { isManager, checkPin } = useAuth()
  const today = new Date()
  const [dateFrom, setDateFrom] = useState(firstOfMonth(today))
  const [dateTo, setDateTo] = useState(toDateStr(today))
  const [shiftFilter, setShiftFilter] = useState<'All' | 'Opening' | 'Closing'>('All')
  const [shiftEntries, setShiftEntries] = useState<ShiftWasteEntry[]>([])
  const [prepEntries, setPrepEntries] = useState<PrepWasteEntry[]>([])
  const [prevShiftEntries, setPrevShiftEntries] = useState<ShiftWasteEntry[]>([])
  const [prevPrepEntries, setPrevPrepEntries] = useState<PrepWasteEntry[]>([])
  const [prevDateFrom, setPrevDateFrom] = useState('')
  const [prevDateTo, setPrevDateTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleteShiftId, setDeleteShiftId] = useState<string | null>(null)
  const [deletePrepId, setDeletePrepId] = useState<string | null>(null)
  const [deletePin, setDeletePin] = useState('')
  const [deletePinError, setDeletePinError] = useState('')

  useEffect(() => {
    load()
  }, [dateFrom, dateTo])

  async function load() {
    if (!dateFrom || !dateTo || dateFrom > dateTo) return
    setLoading(true)

    // Shift current range back 7 days for comparison
    const shiftBack = (d: string, days: number) => {
      const dt = new Date(d + 'T00:00:00')
      dt.setDate(dt.getDate() - days)
      return toDateStr(dt)
    }
    const pFrom = shiftBack(dateFrom, 7)
    const pTo = shiftBack(dateTo, 7)
    setPrevDateFrom(pFrom)
    setPrevDateTo(pTo)

    const [sw, pw, psw, ppw] = await Promise.all([
      supabase.from('shift_waste_entries').select('*').gte('date', dateFrom).lte('date', dateTo).order('date'),
      supabase.from('prep_waste_entries').select('*').gte('date', dateFrom).lte('date', dateTo).order('date'),
      supabase.from('shift_waste_entries').select('*').gte('date', pFrom).lte('date', pTo),
      supabase.from('prep_waste_entries').select('*').gte('date', pFrom).lte('date', pTo),
    ])
    if (sw.data) setShiftEntries(sw.data)
    if (pw.data) setPrepEntries(pw.data)
    if (psw.data) setPrevShiftEntries(psw.data)
    if (ppw.data) setPrevPrepEntries(ppw.data)
    setLoading(false)
  }

  // Quick range shortcuts
  function setThisMonth() {
    const now = new Date()
    setDateFrom(firstOfMonth(now))
    setDateTo(toDateStr(now))
  }
  function setLastMonth() {
    const now = new Date()
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const last = new Date(now.getFullYear(), now.getMonth(), 0)
    setDateFrom(toDateStr(first))
    setDateTo(toDateStr(last))
  }
  function setThisWeek() {
    const now = new Date()
    const day = now.getDay()
    const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
    setDateFrom(toDateStr(mon))
    setDateTo(toDateStr(now))
  }

  function clearDelete() {
    setDeleteShiftId(null)
    setDeletePrepId(null)
    setDeletePin('')
    setDeletePinError('')
  }

  async function handleDeleteShift(id: string) {
    if (!checkPin(deletePin)) {
      setDeletePinError('Incorrect code')
      return
    }
    await supabase.from('shift_waste_entries').delete().eq('id', id)
    clearDelete()
    load()
  }

  async function handleDeletePrep(id: string) {
    if (!checkPin(deletePin)) {
      setDeletePinError('Incorrect code')
      return
    }
    await supabase.from('prep_waste_entries').delete().eq('id', id)
    clearDelete()
    load()
  }

  const filteredShift = shiftFilter === 'All'
    ? shiftEntries
    : shiftEntries.filter(e => e.shift === shiftFilter)
  const filteredPrep = shiftFilter === 'All'
    ? prepEntries
    : prepEntries.filter(e => e.shift === shiftFilter)

  const totalShiftCost = filteredShift.reduce((s, e) => s + Number(e.total_cost ?? 0), 0)
  const totalPrepCost = filteredPrep.reduce((s, e) => s + Number(e.waste_cost ?? 0), 0)
  const totalCost = totalShiftCost + totalPrepCost

  // Previous week comparison
  const filteredPrevShift = shiftFilter === 'All' ? prevShiftEntries : prevShiftEntries.filter(e => e.shift === shiftFilter)
  const filteredPrevPrep = shiftFilter === 'All' ? prevPrepEntries : prevPrepEntries.filter(e => e.shift === shiftFilter)
  const prevTotalCost = filteredPrevShift.reduce((s, e) => s + Number(e.total_cost ?? 0), 0)
                      + filteredPrevPrep.reduce((s, e) => s + Number(e.waste_cost ?? 0), 0)
  const pctChange = prevTotalCost > 0 ? ((totalCost - prevTotalCost) / prevTotalCost) * 100 : null

  function fmtDate(d: string) {
    if (!d) return ''
    const [y, m, day] = d.split('-')
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${months[parseInt(m)-1]} ${parseInt(day)}`
  }
  const prevLabel = prevDateFrom === prevDateTo
    ? fmtDate(prevDateFrom)
    : `${fmtDate(prevDateFrom)} – ${fmtDate(prevDateTo)}`

  const openingShift = shiftEntries.filter(e => e.shift === 'Opening').reduce((s, e) => s + Number(e.total_cost ?? 0), 0)
  const closingShift = shiftEntries.filter(e => e.shift === 'Closing').reduce((s, e) => s + Number(e.total_cost ?? 0), 0)
  const openingPrep = filteredPrep.filter(e => e.shift === 'Opening').reduce((s, e) => s + Number(e.waste_cost ?? 0), 0)
  const closingPrep = filteredPrep.filter(e => e.shift === 'Closing').reduce((s, e) => s + Number(e.waste_cost ?? 0), 0)

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

  // Loss reason breakdown
  const reasonCosts: Record<string, number> = {}
  filteredShift.forEach(e => {
    if (e.loss_reason && e.total_cost) {
      reasonCosts[e.loss_reason] = (reasonCosts[e.loss_reason] ?? 0) + Number(e.total_cost)
    }
  })
  const reasonData = Object.entries(reasonCosts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }))

  const REASON_COLORS = ['#ea580c', '#fb923c', '#fdba74', '#fed7aa', '#fef3c7', '#fde68a', '#fcd34d', '#f59e0b']

  // CSV export
  function exportCSV() {
    const shiftRows = filteredShift.map(e => [
      e.date, e.shift, e.shift_lead, e.item, e.loss_reason ?? '', e.qty_wasted, e.unit,
      e.total_cost != null ? e.total_cost.toFixed(2) : '', 'Shift'
    ])
    const prepRows = filteredPrep.map(e => [
      e.date, e.shift, e.prep_person, e.ingredient, '', e.waste_weight_lbs, 'lbs',
      e.waste_cost != null ? e.waste_cost.toFixed(2) : '', 'Prep'
    ])
    const header = ['Date', 'Shift', 'Person', 'Item/Ingredient', 'Loss Reason', 'Qty', 'Unit', 'Cost', 'Type']
    const rows = [header, ...shiftRows, ...prepRows]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `waste-${dateFrom}-to-${dateTo}${shiftFilter !== 'All' ? `-${shiftFilter.toLowerCase()}` : ''}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

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
        <h1 className="text-2xl font-bold text-gray-900">Waste Dashboard</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick shortcuts */}
          <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
            {[['Today', () => { const t = toDateStr(new Date()); setDateFrom(t); setDateTo(t) }], ['This Week', setThisWeek], ['This Month', setThisMonth], ['Last Month', setLastMonth]].map(([label, fn]) => (
              <button
                key={label as string}
                type="button"
                onClick={fn as () => void}
                className="px-3 py-2 bg-white text-gray-600 hover:bg-orange-50 hover:text-orange-700 border-r border-gray-300 last:border-r-0 text-xs font-medium"
              >
                {label as string}
              </button>
            ))}
          </div>
          {/* Date range */}
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <span className="text-gray-400 text-sm">→</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
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
          {!loading && (filteredShift.length > 0 || filteredPrep.length > 0) && (
            <button
              onClick={exportCSV}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-1"
            >
              ↓ Export CSV
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Total cost with week-over-week comparison */}
            <div className="rounded-xl border shadow-sm p-4 bg-orange-600 border-orange-500 col-span-2 sm:col-span-1">
              <p className="text-xs font-medium uppercase tracking-wide mb-1 text-orange-100">Total Waste Cost</p>
              <p className="text-xl font-bold text-white">${totalCost.toFixed(2)}</p>
              {pctChange !== null ? (
                <div className="flex items-center gap-1 mt-1">
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                    pctChange > 0 ? 'bg-red-500 text-white' : pctChange < 0 ? 'bg-green-500 text-white' : 'bg-orange-400 text-white'
                  }`}>
                    {pctChange > 0 ? '↑' : pctChange < 0 ? '↓' : '•'} {Math.abs(pctChange).toFixed(1)}%
                  </span>
                  <span className="text-orange-200 text-xs">vs {prevLabel}</span>
                </div>
              ) : prevTotalCost === 0 && (filteredPrevShift.length > 0 || filteredPrevPrep.length > 0) ? null : (
                <p className="text-orange-200 text-xs mt-1">No data for {prevLabel}</p>
              )}
            </div>
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

          {reasonData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h2 className="font-semibold text-gray-800 mb-4">Waste by Loss Reason</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={reasonData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <XAxis type="number" tickFormatter={v => `$${v}`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Cost']} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {reasonData.map((_, i) => (
                      <Cell key={i} fill={REASON_COLORS[i % REASON_COLORS.length]} />
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
                      <th className="px-3 py-2"></th>
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
                        {isManager && (
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {deleteShiftId === e.id ? (
                            <div className="flex flex-col items-end gap-1.5">
                              <input
                                type="password"
                                inputMode="numeric"
                                placeholder="Approval code"
                                value={deletePin}
                                autoFocus
                                onChange={ev => { setDeletePin(ev.target.value); setDeletePinError('') }}
                                className="w-32 border border-gray-300 rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-red-400"
                              />
                              {deletePinError && <span className="text-red-500 text-[11px] font-medium">{deletePinError}</span>}
                              <span className="flex gap-1">
                                <button onClick={() => handleDeleteShift(e.id!)} className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-lg hover:bg-red-100 font-medium">Delete</button>
                                <button onClick={clearDelete} className="text-xs text-gray-400 px-2 py-1 rounded-lg hover:bg-gray-100">Cancel</button>
                              </span>
                            </div>
                          ) : (
                            <button onClick={() => { clearDelete(); setDeleteShiftId(e.id!) }} className="text-gray-300 hover:text-red-400 text-lg leading-none px-1">✕</button>
                          )}
                        </td>
                        )}
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
                      <th className="px-3 py-2"></th>
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
                        {isManager && (
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {deletePrepId === e.id ? (
                            <div className="flex flex-col items-end gap-1.5">
                              <input
                                type="password"
                                inputMode="numeric"
                                placeholder="Approval code"
                                value={deletePin}
                                autoFocus
                                onChange={ev => { setDeletePin(ev.target.value); setDeletePinError('') }}
                                className="w-32 border border-gray-300 rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-red-400"
                              />
                              {deletePinError && <span className="text-red-500 text-[11px] font-medium">{deletePinError}</span>}
                              <span className="flex gap-1">
                                <button onClick={() => handleDeletePrep(e.id!)} className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-lg hover:bg-red-100 font-medium">Delete</button>
                                <button onClick={clearDelete} className="text-xs text-gray-400 px-2 py-1 rounded-lg hover:bg-gray-100">Cancel</button>
                              </span>
                            </div>
                          ) : (
                            <button onClick={() => { clearDelete(); setDeletePrepId(e.id!) }} className="text-gray-300 hover:text-red-400 text-lg leading-none px-1">✕</button>
                          )}
                        </td>
                        )}
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
