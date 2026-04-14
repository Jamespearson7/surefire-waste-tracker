'use client'

import { useState, useEffect } from 'react'
import { supabase, ShiftWasteEntry } from '@/lib/supabase'
import { SHIFT_ITEMS, LOSS_REASONS, ITEM_UNITS, LB_PRICED_ITEMS } from '@/lib/constants'

const today = () => new Date().toISOString().split('T')[0]
const nowTime = () => new Date().toTimeString().slice(0, 5)

const emptyForm = (): Omit<ShiftWasteEntry, 'id' | 'created_at' | 'total_cost'> => ({
  date: today(),
  shift: 'Opening',
  shift_lead: '',
  time_logged: nowTime(),
  item: '',
  loss_reason: '',
  unit: '',
  qty_wasted: 0,
  cost_per_unit: null,
  notes: '',
  location: 'Camp North End',
})

export default function ShiftLogPage() {
  const [form, setForm] = useState(emptyForm())
  const [entries, setEntries] = useState<ShiftWasteEntry[]>([])
  const [prices, setPrices] = useState<Record<string, number | null>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  useEffect(() => {
    loadPrices()
    loadEntries()
  }, [])

  async function loadPrices() {
    const { data } = await supabase.from('price_list').select('item_name, cost_per_unit')
    if (data) {
      const map: Record<string, number | null> = {}
      data.forEach((r: { item_name: string; cost_per_unit: number | null }) => {
        map[r.item_name] = r.cost_per_unit
      })
      setPrices(map)
    }
  }

  async function loadEntries() {
    const { data } = await supabase
      .from('shift_waste_entries')
      .select('*')
      .eq('date', today())
      .order('time_logged', { ascending: false })
    if (data) setEntries(data)
  }

  // Returns the effective cost_per_unit to store, accounting for oz vs lb
  function effectiveCost(priceListCost: number | null | undefined, item: string, unit: string): number | null {
    if (priceListCost == null) return null
    if (LB_PRICED_ITEMS.has(item) && unit === 'oz') return priceListCost / 16
    return priceListCost
  }

  function handleItemChange(item: string) {
    const defaultUnit = ITEM_UNITS[item] ?? ''
    setForm(f => ({
      ...f,
      item,
      unit: defaultUnit,
      cost_per_unit: effectiveCost(prices[item], item, defaultUnit),
    }))
  }

  function handleUnitToggle(unit: string) {
    setForm(f => ({
      ...f,
      unit,
      cost_per_unit: effectiveCost(prices[f.item], f.item, unit),
    }))
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setPhotoFile(file)
    if (file) {
      const url = URL.createObjectURL(file)
      setPhotoPreview(url)
    } else {
      setPhotoPreview(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.shift_lead.trim()) return alert('Please enter your name.')
    if (!form.item) return alert('Please select an item.')
    if (!form.loss_reason) return alert('Please select a loss reason.')
    if (form.qty_wasted <= 0) return alert('Quantity must be greater than 0.')
    if (form.loss_reason === 'Quality' && !photoFile) return alert('A photo is required for Quality entries.')

    setSaving(true)

    // Upload photo if present
    let photo_url: string | null = null
    if (photoFile) {
      const ext = photoFile.name.split('.').pop()
      const filename = `${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('waste-photos')
        .upload(filename, photoFile, { upsert: false })
      if (uploadError) {
        setSaving(false)
        alert('Photo upload failed: ' + uploadError.message)
        return
      }
      const { data: urlData } = supabase.storage.from('waste-photos').getPublicUrl(filename)
      photo_url = urlData.publicUrl
    }

    const { error } = await supabase.from('shift_waste_entries').insert([{ ...form, photo_url }])
    setSaving(false)
    if (error) { alert('Error saving entry: ' + error.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setPhotoFile(null)
    setPhotoPreview(null)
    setForm(f => ({ ...emptyForm(), shift: f.shift, shift_lead: f.shift_lead, date: f.date }))
    loadEntries()
  }

  async function handleDelete(id: string) {
    await supabase.from('shift_waste_entries').delete().eq('id', id)
    setDeleteId(null)
    loadEntries()
  }

  const totalCost = entries.reduce((sum, e) => sum + (e.total_cost ?? 0), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Shift Waste Log</h1>
        <p className="text-sm text-gray-500 mt-1">Log food waste during service. Costs calculate automatically.</p>
      </div>

      {/* Log form */}
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
              placeholder="Shift lead"
              value={form.shift_lead}
              onChange={e => setForm(f => ({ ...f, shift_lead: e.target.value }))}
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

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Item</label>
            <select
              value={form.item}
              onChange={e => handleItemChange(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <option value="">— Select item —</option>
              {SHIFT_ITEMS.map(i => <option key={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Loss Reason</label>
            <select
              value={form.loss_reason}
              onChange={e => setForm(f => ({ ...f, loss_reason: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <option value="">— Select reason —</option>
              {LOSS_REASONS.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
            <input
              type="text"
              placeholder="Any notes…"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Quantity</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              value={form.qty_wasted || ''}
              onChange={e => setForm(f => ({ ...f, qty_wasted: parseFloat(e.target.value) || 0 }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
            {form.item && LB_PRICED_ITEMS.has(form.item) ? (
              <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
                {['oz', 'lb'].map(u => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => handleUnitToggle(u)}
                    className={`flex-1 py-2 font-medium transition-colors ${
                      form.unit === u
                        ? 'bg-orange-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500">
                {form.unit || '—'}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Est. Cost</label>
            <div className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700 font-medium">
              {form.cost_per_unit != null && form.qty_wasted > 0
                ? `$${(form.qty_wasted * form.cost_per_unit).toFixed(2)}`
                : form.item && form.cost_per_unit == null
                  ? <span className="text-amber-600 text-xs">Cost TBD</span>
                  : '—'}
            </div>
          </div>
        </div>

        {form.loss_reason === 'Quality' && (
          <div className="border-2 border-dashed border-orange-300 rounded-xl p-4 bg-orange-50">
            <label className="block text-xs font-semibold text-orange-700 mb-2">
              📷 Photo required for Quality entries
            </label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoChange}
              className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-orange-600 file:text-white hover:file:bg-orange-700"
            />
            {photoPreview && (
              <img
                src={photoPreview}
                alt="Preview"
                className="mt-3 rounded-lg max-h-40 object-contain border border-orange-200"
              />
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
        >
          {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Submit'}
        </button>
      </form>

      {/* Today's entries */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800">Today's Entries</h2>
          {entries.length > 0 && (
            <span className="text-sm font-semibold text-orange-700">
              Total: ${totalCost.toFixed(2)}
            </span>
          )}
        </div>

        {entries.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8 bg-white rounded-xl border border-gray-200">
            No entries yet today.
          </p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-2">Time</th>
                  <th className="px-4 py-2">Lead</th>
                  <th className="px-4 py-2">Item</th>
                  <th className="px-4 py-2">Reason</th>
                  <th className="px-4 py-2">Qty</th>
                  <th className="px-4 py-2">Cost</th>
                  <th className="px-4 py-2">Photo</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-500">{e.time_logged?.slice(0,5) ?? '—'}</td>
                    <td className="px-4 py-2">{e.shift_lead}</td>
                    <td className="px-4 py-2 font-medium">{e.item}</td>
                    <td className="px-4 py-2 text-gray-600">{e.loss_reason}</td>
                    <td className="px-4 py-2">{e.qty_wasted} {e.unit}</td>
                    <td className="px-4 py-2 font-medium">
                      {e.total_cost != null ? `$${e.total_cost.toFixed(2)}` : <span className="text-amber-600 text-xs">TBD</span>}
                    </td>
                    <td className="px-4 py-2">
                      {e.photo_url
                        ? <a href={e.photo_url} target="_blank" rel="noopener noreferrer">
                            <img src={e.photo_url} alt="Quality photo" className="h-10 w-10 object-cover rounded-lg border border-gray-200 hover:opacity-80" />
                          </a>
                        : <span className="text-gray-300 text-xs">—</span>}
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
