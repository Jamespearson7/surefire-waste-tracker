'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase, PriceListItem } from '@/lib/supabase'

export default function PricesPage() {
  const { isManager } = useAuth()
  const [items, setItems] = useState<PriceListItem[]>([])
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase.from('price_list').select('*').order('item_name')
    if (data) setItems(data)
    setLoading(false)
  }

  async function saveItem(item: PriceListItem) {
    const raw = editing[item.item_name]
    const cost = raw === '' || raw === undefined ? null : parseFloat(raw)
    if (raw !== undefined && raw !== '' && isNaN(cost!)) return alert('Please enter a valid number.')

    setSaving(item.item_name)
    const { error } = await supabase
      .from('price_list')
      .update({ cost_per_unit: cost, last_updated: new Date().toISOString().split('T')[0] })
      .eq('item_name', item.item_name)
    setSaving(null)
    if (error) { alert('Error: ' + error.message); return }

    setSaved(item.item_name)
    setTimeout(() => setSaved(null), 2000)
    setEditing(prev => { const n = { ...prev }; delete n[item.item_name]; return n })
    load()
  }

  if (!isManager) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 text-sm">Manager access required.</p>
        <p className="text-gray-400 text-xs mt-1">Use the Manager login button in the top nav.</p>
      </div>
    )
  }

  const tbdItems = items.filter(i => i.cost_per_unit == null)
  const knownItems = items.filter(i => i.cost_per_unit != null)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Price List</h1>
        <p className="text-sm text-gray-500 mt-1">Update costs here — changes apply immediately to all new waste entries.</p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>
      ) : (
        <>
          {tbdItems.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-amber-600 text-sm font-semibold">⚠ Costs Needed ({tbdItems.length})</span>
              </div>
              <div className="bg-amber-50 rounded-xl border border-amber-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-amber-100 border-b border-amber-200 text-left text-xs text-amber-700 uppercase tracking-wide">
                      <th className="px-4 py-2">Item</th>
                      <th className="px-4 py-2">Unit</th>
                      <th className="px-4 py-2">Cost ($)</th>
                      <th className="px-4 py-2">Notes</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tbdItems.map(item => (
                      <PriceRow
                        key={item.item_name}
                        item={item}
                        editValue={editing[item.item_name]}
                        onChange={v => setEditing(prev => ({ ...prev, [item.item_name]: v }))}
                        onSave={() => saveItem(item)}
                        saving={saving === item.item_name}
                        saved={saved === item.item_name}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div>
            <h2 className="font-semibold text-gray-800 mb-3">All Ingredients</h2>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-2">Item</th>
                    <th className="px-4 py-2">Unit</th>
                    <th className="px-4 py-2">Cost ($)</th>
                    <th className="px-4 py-2">Notes</th>
                    <th className="px-4 py-2">Updated</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <PriceRow
                      key={item.item_name}
                      item={item}
                      editValue={editing[item.item_name]}
                      onChange={v => setEditing(prev => ({ ...prev, [item.item_name]: v }))}
                      onSave={() => saveItem(item)}
                      saving={saving === item.item_name}
                      saved={saved === item.item_name}
                      showDate
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function PriceRow({
  item, editValue, onChange, onSave, saving, saved, showDate
}: {
  item: PriceListItem
  editValue?: string
  onChange: (v: string) => void
  onSave: () => void
  saving: boolean
  saved: boolean
  showDate?: boolean
}) {
  const isEditing = editValue !== undefined
  const displayCost = item.cost_per_unit != null ? `$${item.cost_per_unit}` : null

  return (
    <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
      <td className="px-4 py-2 font-medium text-gray-800">{item.item_name}</td>
      <td className="px-4 py-2 text-gray-500">{item.unit}</td>
      <td className="px-4 py-2 w-32">
        {isEditing ? (
          <input
            type="number"
            min="0"
            step="0.001"
            placeholder="0.00"
            value={editValue}
            onChange={e => onChange(e.target.value)}
            className="w-full border border-orange-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && onSave()}
          />
        ) : (
          <span
            className={`cursor-pointer hover:underline ${
              displayCost ? 'text-gray-900' : 'text-amber-600 font-medium'
            }`}
            onClick={() => onChange(item.cost_per_unit?.toString() ?? '')}
          >
            {displayCost ?? 'TBD — click to set'}
          </span>
        )}
      </td>
      <td className="px-4 py-2 text-gray-400 text-xs max-w-xs truncate">{item.notes}</td>
      {showDate && <td className="px-4 py-2 text-gray-400 text-xs">{item.last_updated}</td>}
      <td className="px-4 py-2">
        {isEditing ? (
          <div className="flex gap-1">
            <button
              onClick={onSave}
              disabled={saving}
              className="text-xs bg-orange-600 text-white px-2 py-1 rounded hover:bg-orange-700 disabled:opacity-50"
            >
              {saving ? '…' : saved ? '✓' : 'Save'}
            </button>
            <button
              onClick={() => onChange(undefined as unknown as string)}
              className="text-xs text-gray-400 hover:text-gray-600 px-1"
            >
              ✕
            </button>
          </div>
        ) : (
          saved ? (
            <span className="text-xs text-green-600">✓ Saved</span>
          ) : (
            <button
              onClick={() => onChange(item.cost_per_unit?.toString() ?? '')}
              className="text-xs text-gray-400 hover:text-orange-600"
            >
              Edit
            </button>
          )
        )}
      </td>
    </tr>
  )
}
