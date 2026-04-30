'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, PrepWasteEntry } from '@/lib/supabase'
import { PREP_INGREDIENTS, WASTE_TYPES } from '@/lib/constants'

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const nowTime = () => new Date().toTimeString().slice(0, 5)

const emptyForm = (): Omit<PrepWasteEntry, 'id' | 'created_at' | 'yield_pct' | 'waste_cost'> => ({
  date: today(),
  shift: 'Opening',
  prep_person: '',
  time_logged: nowTime(),
  ingredient: '',
  waste_type: '',
  total_purchased_lbs: 0,
  waste_weight_lbs: 0,
  cost_per_lb: null,
  location: 'Camp North End',
})

export default function PrepLogPage() {
  const router = useRouter()
  const [form, setForm] = useState(emptyForm())
  const [entries, setEntries] = useState<PrepWasteEntry[]>([])
  const [prices, setPrices] = useState<Record<string, number | null>>({})
  const [batchDefaults, setBatchDefaults] = useState<Record<string, number | null>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    loadPrices()
    loadEntries()
  }, [])

  async function loadPrices() {
    const { data } = await supabase.from('price_list').select('item_name, cost_per_unit, default_batch_lbs')
    if (data) {
      const costMap: Record<string, number | null> = {}
      const batchMap: Record<string, number | null> = {}
      data.forEach((r: { item_name: string; cost_per_unit: number | null; default_batch_lbs: number | null }) => {
        costMap[r.item_name] = r.cost_per_unit
        batchMap[r.item_name] = r.default_batch_lbs
      })
      setPrices(costMap)
      setBatchDefaults(batchMap)
    }
  }

  async function loadEntries() {
    const { data } = await supabase
      .from('prep_waste_entries')
      .select('*')
      .eq('date', today())
      .order('time_logged', { ascending: false })
    if (data) setEntries(data)
  }

  function handleIngredientChange(ingredient: string) {
    const cost = prices[ingredient] ?? prices[ingredient + ' (Cabbage)'] ?? null
    const batch = batchDefaults[ingredient] ?? null
    setForm(f => ({
      ...f,
      ingredient,
      cost_per_lb: cost,
      total_purchased_lbs: batch ?? f.total_purchased_lbs,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.prep_person.trim()) return alert('Please enter your name.')
    if (!form.ingredient) return alert('Please select an ingredient.')
    if (!form.waste_type) return alert('Please select a waste type.')
    if (form.total_purchased_lbs <= 0) return alert('Total purchased must be greater than 0.')
    if (form.waste_weight_lbs < 0) return alert('Waste weight cannot be negative.')
    if (form.waste_weight_lbs > form.total_purchased_lbs) return alert('Waste cannot exceed total purchased.')

    setSaving(true)
    const { error } = await supabase.from('prep_waste_entries').insert([form])
    setSaving(false)
    if (error) { alert('Error saving entry: ' + error.message); return }
    setSaved(true)
    setForm(f => ({ ...emptyForm(), shift: f.shift, prep_person: f.prep_person, date: f.date }))
    setTimeout(() => router.push('/dashboard'), 1200)
  }

  async function handleDelete(id: string) {
    await supabase.from('prep_waste_entries').delete().eq('id', id)
    setDeleteId(null)
    loadEntries()
  }

  const totalCost = entries.reduce((sum, e) => sum + (e.waste_cost ?? 0), 0)
  const yieldPct = form.total_purchased_lbs > 0
    ? ((form.total_purchased_lbs - form.waste_weight_lbs) / form.total_purchased_lbs * 100).toFixed(1)
    : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Prep Waste Log</h1>
        <p className="text-sm text-gray-500 mt-1">Log trim/peel/unusable weight lost during prep.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Shift</label>
            <select
              value={form.shift}
              onChange={e => setForm(f => ({ ...f, shift: e.target.value as 'Opening' | 'Closing' }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <option>Opening</option>
              <option>Closing</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Your Name</label>
            <input
              type="text"
              placeholder="Prep person"
              value={form.prep_person}
              onChange={e => setForm(f => ({ ...f, prep_person: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Time</label>
            <input
              type="time"
              value={form.time_logged}
              onChange={e => setForm(f => ({ ...f, time_logged: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Ingredient</label>
            <select
              value={form.ingredient}
              onChange={e => handleIngredientChange(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <option value="">— Select ingredient —</option>
              {PREP_INGREDIENTS.map(i => <option key={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Waste Type</label>
            <select
              value={form.waste_type}
              onChange={e => setForm(f => ({ ...f, waste_type: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <option value="">— Select type —</option>
              {WASTE_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-600">Total Purchased (lbs)</label>
              {form.ingredient && batchDefaults[form.ingredient] != null && (
                <span className="text-xs text-orange-500 font-medium">
                  ✓ auto-filled
                </span>
              )}
            </div>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.total_purchased_lbs || ''}
              onChange={e => setForm(f => ({ ...f, total_purchased_lbs: parseFloat(e.target.value) || 0 }))}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 ${
                form.ingredient && batchDefaults[form.ingredient] != null
                  ? 'border-orange-300 bg-orange-50'
                  : 'border-gray-300'
              }`}
            />
            {form.ingredient && batchDefaults[form.ingredient] != null && (
              <p className="text-xs text-gray-400 mt-1">Default: {batchDefaults[form.ingredient]} lbs — edit if different today</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Waste Weight (lbs)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.waste_weight_lbs || ''}
              onChange={e => setForm(f => ({ ...f, waste_weight_lbs: parseFloat(e.target.value) || 0 }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Yield %</label>
            <div className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 font-medium text-gray-700">
              {yieldPct ? `${yieldPct}%` : '—'}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Waste Cost</label>
            <div className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 font-medium text-gray-700">
              {form.cost_per_lb != null && form.waste_weight_lbs > 0
                ? `$${(form.waste_weight_lbs * form.cost_per_lb).toFixed(2)}`
                : <span className="text-amber-600 text-xs">Cost TBD</span>}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
        >
          {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Submit'}
        </button>
      </form>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800">Today's Prep Entries</h2>
          {entries.length > 0 && (
            <span className="text-sm font-semibold text-orange-700">
              Total: ${totalCost.toFixed(2)}
            </span>
          )}
        </div>

        {entries.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8 bg-white rounded-xl border border-gray-200">
            No prep entries yet today.
          </p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-2">Time</th>
                  <th className="px-4 py-2">Person</th>
                  <th className="px-4 py-2">Ingredient</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Purchased</th>
                  <th className="px-4 py-2">Waste</th>
                  <th className="px-4 py-2">Yield</th>
                  <th className="px-4 py-2">Cost</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-500">{e.time_logged?.slice(0,5) ?? '—'}</td>
                    <td className="px-4 py-2">{e.prep_person}</td>
                    <td className="px-4 py-2 font-medium">{e.ingredient}</td>
                    <td className="px-4 py-2 text-gray-600">{e.waste_type}</td>
                    <td className="px-4 py-2">{e.total_purchased_lbs} lbs</td>
                    <td className="px-4 py-2">{e.waste_weight_lbs} lbs</td>
                    <td className="px-4 py-2">
                      {e.yield_pct != null ? (
                        <span className={e.yield_pct < 70 ? 'text-red-600 font-medium' : 'text-green-700'}>
                          {e.yield_pct}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-2 font-medium">
                      {e.waste_cost != null ? `$${e.waste_cost.toFixed(2)}` : <span className="text-amber-600 text-xs">TBD</span>}
                    </td>
                    <td className="px-4 py-2">
                      {deleteId === e.id ? (
                        <span className="flex gap-1">
                          <button onClick={() => handleDelete(e.id!)} className="text-xs text-red-600 hover:underline">Delete</button>
                          <button onClick={() => setDeleteId(null)} className="text-xs text-gray-400 hover:underline">Cancel</button>
                        </span>
                      ) : (
                        <button onClick={() => setDeleteId(e.id!)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
