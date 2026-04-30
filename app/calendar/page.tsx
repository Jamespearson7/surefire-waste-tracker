'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import type { SFContact } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────────
type SFEvent = {
  id: string
  title: string
  event_date: string
  start_time: string | null
  end_time: string | null
  event_type: string
  location: string | null
  notes: string | null
  contact_name: string | null
  contact_phone: string | null
  alert_phones: string | null
  alert_contact_ids: string | null
  alert_days_before: number
  alert_sent: boolean
}

const EVENT_TYPES = ['Catering', 'Private Event', 'Pop-up', 'Festival', 'Farmers Market', 'Reminder', 'Other']

const TYPE_COLORS: Record<string, { bg: string; text: string; dot: string; chip: string }> = {
  'Catering':       { bg: 'bg-orange-50',  text: 'text-orange-800', dot: 'bg-orange-500',  chip: 'bg-orange-500 text-white' },
  'Private Event':  { bg: 'bg-purple-50',  text: 'text-purple-800', dot: 'bg-purple-500',  chip: 'bg-purple-500 text-white' },
  'Pop-up':         { bg: 'bg-blue-50',    text: 'text-blue-800',   dot: 'bg-blue-500',    chip: 'bg-blue-500 text-white' },
  'Festival':       { bg: 'bg-pink-50',    text: 'text-pink-800',   dot: 'bg-pink-500',    chip: 'bg-pink-500 text-white' },
  'Farmers Market': { bg: 'bg-green-50',   text: 'text-green-800',  dot: 'bg-green-500',   chip: 'bg-green-500 text-white' },
  'Reminder':       { bg: 'bg-yellow-50',  text: 'text-yellow-800', dot: 'bg-yellow-400',  chip: 'bg-yellow-400 text-white' },
  'Other':          { bg: 'bg-gray-50',    text: 'text-gray-700',   dot: 'bg-gray-400',    chip: 'bg-gray-400 text-white' },
}

const DOW   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function dateFmt(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
function todayStr() {
  const n = new Date()
  return dateFmt(n.getFullYear(), n.getMonth(), n.getDate())
}
function fmtTime(t: string | null) { return t ? t.slice(0, 5) : '' }
function fmtShortDate(dateStr: string) {
  const [, m, d] = dateStr.split('-')
  return `${MONTHS[parseInt(m) - 1].slice(0, 3)} ${parseInt(d)}`
}

const emptyForm = (date = ''): Omit<SFEvent, 'id'> => ({
  title: '', event_date: date, start_time: null, end_time: null,
  event_type: 'Catering', location: null, notes: null,
  contact_name: null, contact_phone: null,
  alert_phones: null, alert_contact_ids: null, alert_days_before: 1, alert_sent: false,
})

export default function CalendarPage() {
  const { isManager } = useAuth()
  const now = new Date()
  const [viewYear,  setViewYear]  = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [events,    setEvents]    = useState<SFEvent[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [editEvent, setEditEvent] = useState<SFEvent | null>(null)
  const [form,      setForm]      = useState<Omit<SFEvent, 'id'>>(emptyForm())
  const [saving,    setSaving]    = useState(false)
  const [deleteId,  setDeleteId]  = useState<string | null>(null)
  const [sending,   setSending]   = useState(false)
  const [alertMsg,  setAlertMsg]  = useState('')
  const [contacts,  setContacts]  = useState<SFContact[]>([])

  const loadEvents = useCallback(async () => {
    setLoading(true)
    const start = dateFmt(viewYear, viewMonth - 1, 1)
    const end   = new Date(viewYear, viewMonth + 2, 0)
    const endStr = dateFmt(end.getFullYear(), end.getMonth(), end.getDate())
    const { data } = await supabase
      .from('events')
      .select('*')
      .gte('event_date', start)
      .lte('event_date', endStr)
      .order('event_date')
    if (data) setEvents(data)
    setLoading(false)
  }, [viewYear, viewMonth])

  useEffect(() => { loadEvents() }, [loadEvents])

  useEffect(() => {
    supabase.from('contacts').select('*').eq('active', true).order('name')
      .then(({ data }) => { if (data) setContacts(data) })
  }, [])

  // Calendar grid data
  const firstDow    = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const eventsByDate: Record<string, SFEvent[]> = {}
  events.forEach(e => {
    if (!eventsByDate[e.event_date]) eventsByDate[e.event_date] = []
    eventsByDate[e.event_date].push(e)
  })

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  function openAdd(date: string) {
    setEditEvent(null); setForm(emptyForm(date)); setAlertMsg(''); setShowForm(true)
  }
  function openEdit(e: SFEvent) {
    setEditEvent(e); setForm({ ...e }); setAlertMsg(''); setShowForm(true)
  }
  function closeForm() { setShowForm(false); setEditEvent(null) }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!form.title.trim()) return alert('Please enter an event name.')
    if (!form.event_date)   return alert('Please select a date.')
    setSaving(true)
    if (editEvent) {
      await supabase.from('events').update({ ...form }).eq('id', editEvent.id)
    } else {
      await supabase.from('events').insert([form])
    }
    setSaving(false)
    closeForm()
    loadEvents()
  }

  async function handleDelete(id: string) {
    await supabase.from('events').delete().eq('id', id)
    setDeleteId(null)
    closeForm()
    loadEvents()
  }

  function toggleContact(id: string) {
    const current = form.alert_contact_ids ? form.alert_contact_ids.split(',').filter(Boolean) : []
    const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id]
    setForm(f => ({ ...f, alert_contact_ids: next.length > 0 ? next.join(',') : null }))
  }

  async function sendAlert() {
    if (!editEvent) return
    const hasContacts = form.alert_contact_ids?.trim()
    const hasPhones   = form.alert_phones?.trim()
    if (!hasContacts && !hasPhones) return setAlertMsg('⚠️ No contacts or phone numbers selected.')
    setSending(true)
    setAlertMsg('')
    try {
      const res  = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form }),
      })
      const data = await res.json()
      setAlertMsg(data.ok ? `✓ Text sent to ${data.sent} number${data.sent !== 1 ? 's' : ''}!` : `❌ ${data.error}`)
    } catch {
      setAlertMsg('❌ Failed to send')
    }
    setSending(false)
  }

  const today    = todayStr()
  const upcoming = events
    .filter(e => e.event_date >= today)
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
    .slice(0, 12)

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events & Catering</h1>
          <p className="text-sm text-gray-500 mt-1">Schedule events and send text alerts to your team.</p>
        </div>
        {isManager && (
          <button
            onClick={() => openAdd(today)}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-700 transition-colors"
          >
            + Add Event
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6 items-start">

        {/* ── Calendar ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Month nav */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
            <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-500 text-lg font-bold">‹</button>
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-gray-900">{MONTHS[viewMonth]} {viewYear}</h2>
              <button
                onClick={() => { setViewYear(now.getFullYear()); setViewMonth(now.getMonth()) }}
                className="text-xs text-orange-600 hover:text-orange-800 font-semibold px-2 py-0.5 rounded-full bg-orange-50 hover:bg-orange-100 transition-colors"
              >
                Today
              </button>
            </div>
            <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-500 text-lg font-bold">›</button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
            {DOW.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-gray-400 py-2">{d}</div>
            ))}
          </div>

          {/* Grid */}
          {loading ? (
            <div className="py-16 text-center text-sm text-gray-400">Loading…</div>
          ) : (
            <div className="grid grid-cols-7">
              {/* Blank cells before month starts */}
              {Array.from({ length: firstDow }).map((_, i) => (
                <div key={`pre-${i}`} className="min-h-[88px] border-b border-r border-gray-100 bg-gray-50/40" />
              ))}
              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day     = i + 1
                const dateStr = dateFmt(viewYear, viewMonth, day)
                const evts    = eventsByDate[dateStr] ?? []
                const isToday = dateStr === today
                const isPast  = dateStr < today
                const col     = (firstDow + i) % 7
                const isLast  = col === 6
                return (
                  <div
                    key={day}
                    onClick={() => isManager && openAdd(dateStr)}
                    className={`min-h-[88px] border-b border-r border-gray-100 p-1 flex flex-col transition-colors
                      ${isLast ? 'border-r-0' : ''}
                      ${isManager ? 'cursor-pointer hover:bg-orange-50/30' : ''}
                      ${isPast && !isToday ? 'bg-gray-50/50' : ''}`}
                  >
                    <div className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full mb-1 self-start
                      ${isToday ? 'bg-orange-600 text-white' : isPast ? 'text-gray-400' : 'text-gray-700'}`}>
                      {day}
                    </div>
                    <div className="space-y-0.5 flex-1">
                      {evts.slice(0, 2).map(e => {
                        const c = TYPE_COLORS[e.event_type] ?? TYPE_COLORS['Other']
                        return (
                          <button
                            key={e.id}
                            onClick={ev => { ev.stopPropagation(); openEdit(e) }}
                            className={`w-full text-left text-[10px] font-semibold px-1.5 py-0.5 rounded truncate ${c.chip} hover:opacity-80 transition-opacity`}
                          >
                            {fmtTime(e.start_time) ? `${fmtTime(e.start_time)} ` : ''}{e.title}
                          </button>
                        )
                      })}
                      {evts.length > 2 && (
                        <button
                          onClick={ev => { ev.stopPropagation(); openEdit(evts[2]) }}
                          className="text-[10px] text-gray-400 px-1 hover:text-gray-600"
                        >
                          +{evts.length - 2} more
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Right sidebar ── */}
        <div className="space-y-4">

          {/* Legend */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Event Types</p>
            <div className="grid grid-cols-2 gap-y-2">
              {EVENT_TYPES.map(t => {
                const c = TYPE_COLORS[t] ?? TYPE_COLORS['Other']
                return (
                  <div key={t} className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
                    <span className="text-xs text-gray-600">{t}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Upcoming events */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <p className="text-sm font-semibold text-gray-800">Upcoming Events</p>
            </div>
            {upcoming.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No upcoming events.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {upcoming.map(e => {
                  const c = TYPE_COLORS[e.event_type] ?? TYPE_COLORS['Other']
                  return (
                    <button
                      key={e.id}
                      onClick={() => openEdit(e)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${c.dot}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{e.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {fmtShortDate(e.event_date)}
                            {e.start_time ? ` · ${fmtTime(e.start_time)}` : ''}
                          </p>
                          {e.location && (
                            <p className="text-xs text-gray-400 truncate">{e.location}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── Event Form Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
             onClick={closeForm}>
          <div className="bg-white w-full sm:rounded-2xl sm:max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl rounded-t-2xl"
               onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="font-bold text-gray-900 text-base">
                {editEvent ? 'Edit Event' : 'New Event'}
              </h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600 text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">

              {/* Event name */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Event Name *</label>
                <input
                  type="text" autoFocus
                  placeholder="e.g. Johnson Wedding Catering"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>

              {/* Type + Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Event Type</label>
                  <select value={form.event_type} onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                    {EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Date *</label>
                  <input type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
              </div>

              {/* Start + End time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Start Time</label>
                  <input type="time" value={form.start_time ?? ''} onChange={e => setForm(f => ({ ...f, start_time: e.target.value || null }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">End Time</label>
                  <input type="time" value={form.end_time ?? ''} onChange={e => setForm(f => ({ ...f, end_time: e.target.value || null }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Location</label>
                <input type="text" placeholder="e.g. 3200 N Davidson St, Charlotte NC"
                  value={form.location ?? ''}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value || null }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>

              {/* Contact */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Contact Name</label>
                  <input type="text" placeholder="Client name"
                    value={form.contact_name ?? ''}
                    onChange={e => setForm(f => ({ ...f, contact_name: e.target.value || null }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Contact Phone</label>
                  <input type="tel" placeholder="(704) 555-0100"
                    value={form.contact_phone ?? ''}
                    onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value || null }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                <textarea placeholder="Menu, headcount, special requests, prep notes…"
                  value={form.notes ?? ''}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value || null }))}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
              </div>

              {/* Text Alert Settings */}
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📲</span>
                    <span className="text-sm font-bold text-orange-800">Text Alert Settings</span>
                  </div>
                  <Link href="/contacts" target="_blank"
                    className="text-[11px] text-orange-600 hover:text-orange-800 font-semibold underline">
                    Manage contacts →
                  </Link>
                </div>

                {/* Saved contacts picker */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2">Alert Team Members</label>
                  {contacts.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">
                      No contacts saved yet.{' '}
                      <Link href="/contacts" target="_blank" className="text-orange-600 underline">Add contacts</Link>
                      {' '}to select them here.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                      {contacts.map(c => {
                        const selected = form.alert_contact_ids?.split(',').includes(c.id) ?? false
                        return (
                          <label
                            key={c.id}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors border ${
                              selected
                                ? 'bg-orange-100 border-orange-300'
                                : 'bg-white border-gray-200 hover:border-orange-200 hover:bg-orange-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleContact(c.id)}
                              className="accent-orange-600 w-4 h-4 flex-shrink-0"
                            />
                            <div className="w-7 h-7 rounded-full bg-orange-200 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-orange-800">
                                {c.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-800 leading-tight">{c.name}</p>
                              {c.title && <p className="text-[11px] text-gray-400 leading-tight">{c.title}</p>}
                            </div>
                            {selected && (
                              <span className="ml-auto text-[10px] text-orange-700 font-semibold">✓ Alerting</span>
                            )}
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* One-off manual numbers */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Additional Numbers
                    <span className="font-normal text-gray-400 ml-1">(one-off, comma-separated, include +1)</span>
                  </label>
                  <input type="text" placeholder="+17045550100, +17045550200"
                    value={form.alert_phones ?? ''}
                    onChange={e => setForm(f => ({ ...f, alert_phones: e.target.value || null }))}
                    className="w-full border border-orange-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>

                {/* Auto-send timing */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Auto-send Alert</label>
                  <select value={form.alert_days_before}
                    onChange={e => setForm(f => ({ ...f, alert_days_before: parseInt(e.target.value) }))}
                    className="w-full border border-orange-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                    <option value={0}>Morning of the event</option>
                    <option value={1}>1 day before</option>
                    <option value={2}>2 days before</option>
                    <option value={3}>3 days before</option>
                    <option value={7}>1 week before</option>
                  </select>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Alert fires automatically at 9am on the selected day. Requires Twilio setup.
                  </p>
                </div>

                {/* Manual send now */}
                {editEvent && (
                  <div className="border-t border-orange-200 pt-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-gray-700">Send Text Now</p>
                        <p className="text-[11px] text-gray-500">Manually trigger alert to all selected contacts &amp; numbers</p>
                      </div>
                      <button type="button" onClick={sendAlert} disabled={sending}
                        className="text-xs bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700 font-semibold disabled:opacity-50 transition-colors">
                        {sending ? 'Sending…' : '📲 Send Text'}
                      </button>
                    </div>
                    {alertMsg && (
                      <p className={`text-xs mt-2 font-medium ${alertMsg.startsWith('✓') ? 'text-green-700' : 'text-red-600'}`}>
                        {alertMsg}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Form actions */}
              <div className="flex gap-2 pt-1">
                {editEvent && isManager && (
                  <button type="button" onClick={() => setDeleteId(editEvent.id)}
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
                  {saving ? 'Saving…' : editEvent ? 'Save Changes' : 'Add Event'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center space-y-4">
            <p className="font-bold text-gray-900 text-base">Delete this event?</p>
            <p className="text-sm text-gray-500">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteId)}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-xl text-sm hover:bg-red-700 font-semibold">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
