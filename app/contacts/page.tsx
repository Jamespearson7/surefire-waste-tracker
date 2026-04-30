'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import type { SFContact } from '@/lib/supabase'
import { CARRIER_GATEWAYS, buildSmsEmail } from '@/lib/carrier-gateways'

const CARRIERS = Object.keys(CARRIER_GATEWAYS)

type ContactForm = Omit<SFContact, 'id' | 'created_at'>

const emptyForm = (): ContactForm => ({
  name: '',
  phone: '',
  title: null,
  carrier: null,
  sms_email: null,
  active: true,
  restock_alerts: false,
})

export default function ContactsPage() {
  const { isManager } = useAuth()
  const [contacts,  setContacts]  = useState<SFContact[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [editItem,  setEditItem]  = useState<SFContact | null>(null)
  const [form,      setForm]      = useState<ContactForm>(emptyForm())
  const [saving,    setSaving]    = useState(false)
  const [deleteId,  setDeleteId]  = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('contacts').select('*').order('name')
    if (data) setContacts(data)
    setLoading(false)
  }

  // Whenever phone or carrier changes, auto-derive the sms_email
  function updatePhoneOrCarrier(phone: string, carrier: string | null) {
    const sms_email = (phone && carrier) ? buildSmsEmail(phone, carrier) : null
    setForm(f => ({ ...f, phone, carrier, sms_email }))
  }

  function openAdd() {
    setEditItem(null)
    setForm(emptyForm())
    setShowForm(true)
  }

  function openEdit(c: SFContact) {
    setEditItem(c)
    setForm({ name: c.name, phone: c.phone, title: c.title, carrier: c.carrier, sms_email: c.sms_email, active: c.active, restock_alerts: c.restock_alerts ?? false })
    setShowForm(true)
  }

  function closeForm() { setShowForm(false); setEditItem(null) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return alert('Please enter a name.')
    if (!form.phone.trim()) return alert('Please enter a phone number.')
    if (!form.carrier) return alert('Please select a carrier so we know where to send the text.')
    setSaving(true)
    if (editItem) {
      await supabase.from('contacts').update({ ...form }).eq('id', editItem.id)
    } else {
      await supabase.from('contacts').insert([form])
    }
    setSaving(false)
    closeForm()
    load()
  }

  async function handleDelete(id: string) {
    await supabase.from('contacts').delete().eq('id', id)
    setDeleteId(null)
    load()
  }

  if (!isManager) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 text-sm">Manager access required.</p>
      </div>
    )
  }

  const preview = form.phone && form.carrier ? buildSmsEmail(form.phone, form.carrier) : null

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alert Contacts</h1>
          <p className="text-sm text-gray-500 mt-1">
            Save your team&apos;s info and select them when scheduling event text alerts.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-700 transition-colors"
        >
          + Add Contact
        </button>
      </div>

      {/* How it works banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex gap-3">
        <span className="text-lg flex-shrink-0">📲</span>
        <div className="text-sm text-blue-800">
          <span className="font-semibold">How texts are sent free:</span> Every carrier has an email address that forwards to your phone as a text (e.g. AT&T → <span className="font-mono text-xs bg-blue-100 px-1 rounded">7045551234@txt.att.net</span>). Select the carrier and we handle the rest — no Twilio needed.
        </div>
      </div>

      {/* Contact list */}
      {loading ? (
        <p className="text-sm text-gray-400 text-center py-12">Loading…</p>
      ) : contacts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm text-center py-16 space-y-3">
          <div className="text-4xl">👥</div>
          <p className="text-gray-600 font-semibold">No contacts yet</p>
          <p className="text-sm text-gray-400 max-w-xs mx-auto">
            Add your team members so you can quickly select who to alert when an event is coming up.
          </p>
          <button
            onClick={openAdd}
            className="mt-2 bg-orange-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-orange-700 transition-colors"
          >
            Add First Contact
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">
              {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-gray-400">Select contacts on any event to include them in text alerts</p>
          </div>
          <div className="divide-y divide-gray-100">
            {contacts.map(c => (
              <div
                key={c.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-orange-700">
                      {c.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                      {c.carrier && (
                        <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-semibold">
                          {c.carrier}
                        </span>
                      )}
                      {c.restock_alerts && (
                        <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold">
                          📦 Restock
                        </span>
                      )}
                      {!c.active && (
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{c.phone}</p>
                    {c.sms_email && (
                      <p className="text-[11px] text-gray-400 font-mono">{c.sms_email}</p>
                    )}
                    {c.title && <p className="text-xs text-gray-400">{c.title}</p>}
                  </div>
                </div>
                <button
                  onClick={() => openEdit(c)}
                  className="text-xs text-gray-400 hover:text-orange-600 px-3 py-1.5 rounded-lg hover:bg-orange-50 transition-colors font-medium"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
             onClick={closeForm}>
          <div className="bg-white w-full sm:rounded-2xl sm:max-w-md shadow-2xl rounded-t-2xl overflow-y-auto max-h-[92vh]"
               onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 rounded-t-2xl sticky top-0 bg-white z-10">
              <h2 className="font-bold text-gray-900 text-base">
                {editItem ? 'Edit Contact' : 'New Contact'}
              </h2>
              <button onClick={closeForm}
                className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Full Name *</label>
                <input
                  type="text" autoFocus
                  placeholder="e.g. Marcus Johnson"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Role / Title <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Shift Lead, Manager, Chef"
                  value={form.title ?? ''}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value || null }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>

              {/* Phone + Carrier side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    placeholder="7045550100"
                    value={form.phone}
                    onChange={e => updatePhoneOrCarrier(e.target.value, form.carrier)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">10-digit, no dashes</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Carrier *</label>
                  <select
                    value={form.carrier ?? ''}
                    onChange={e => updatePhoneOrCarrier(form.phone, e.target.value || null)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  >
                    <option value="">— Select —</option>
                    {CARRIERS.map(c => <option key={c}>{c}</option>)}
                  </select>
                  <p className="text-[10px] text-gray-400 mt-0.5">Check phone settings if unsure</p>
                </div>
              </div>

              {/* SMS email preview */}
              {preview ? (
                <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 flex items-center gap-2">
                  <span className="text-green-600 text-sm">✓</span>
                  <div>
                    <p className="text-xs font-semibold text-green-800">Text will be sent to:</p>
                    <p className="text-xs font-mono text-green-700 mt-0.5">{preview}</p>
                  </div>
                </div>
              ) : form.phone && !form.carrier ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                  ⚠️ Select a carrier to enable text alerts for this contact.
                </div>
              ) : null}

              {/* Active toggle (edit only) */}
              {editItem && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                    className="accent-orange-600 w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">Active — appears in event alert picker</span>
                </label>
              )}

              {/* Restock alerts toggle — always shown */}
              <label className="flex items-start gap-2 cursor-pointer p-3 rounded-xl border border-gray-200 hover:border-orange-300 hover:bg-orange-50 transition-colors">
                <input
                  type="checkbox"
                  checked={form.restock_alerts}
                  onChange={e => setForm(f => ({ ...f, restock_alerts: e.target.checked }))}
                  className="accent-orange-600 w-4 h-4 mt-0.5 flex-shrink-0"
                />
                <div>
                  <p className="text-sm font-semibold text-gray-800">📦 Restock Alerts</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Text this person when inventory items fall below their reorder level.
                    Use the &ldquo;Alert Low Stock&rdquo; button on the Inventory page to trigger manually, or it runs automatically every morning.
                  </p>
                </div>
              </label>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                {editItem && (
                  <button type="button" onClick={() => setDeleteId(editItem.id)}
                    className="px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors">
                    Delete
                  </button>
                )}
                <button type="button" onClick={closeForm}
                  className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
                  {saving ? 'Saving…' : editItem ? 'Save Changes' : 'Add Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center space-y-4">
            <p className="font-bold text-gray-900">Remove this contact?</p>
            <p className="text-sm text-gray-500">They won&apos;t appear in event alert pickers anymore.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteId)}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-xl text-sm hover:bg-red-700 font-semibold">
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
