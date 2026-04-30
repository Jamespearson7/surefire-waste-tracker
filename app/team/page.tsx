'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import {
  ALL_BADGES, BOH_BADGES, FOH_BADGES, getBadge, getNextBadge,
  type Badge, type Track,
} from '@/lib/badge-definitions'

// ─── Types ────────────────────────────────────────────────────────────────────

type TeamMember = {
  id: string
  name: string
  track: Track
  current_badge: string
  start_date: string | null
  total_shifts: number
  servsafe_active: boolean
  servsafe_expiry: string | null
  boh_hours: number
  foh_hours: number
  notes: string | null
  active: boolean
}

type SkillProgress = {
  member_id: string
  badge_id: string
  skill_key: string
  count_done: number
  completed: boolean
  completed_date: string | null
  completed_by: string | null
}

type AwardedBadge = {
  id: string
  badge_id: string
  awarded_at: string
  awarded_by: string | null
  shifts_at_award: number | null
  pay_rate: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
}

function badgeColor(badgeId: string) {
  if (badgeId.includes('hell_raiser')) return 'bg-red-600 text-white'
  if (badgeId.includes('shift_lead'))  return 'bg-purple-600 text-white'
  if (badgeId.includes('trainer'))     return 'bg-blue-600 text-white'
  if (badgeId.includes('line') || badgeId.includes('market_floor')) return 'bg-green-600 text-white'
  return 'bg-gray-400 text-white'
}

function trackColor(track: Track) {
  return track === 'BOH' ? 'bg-orange-100 text-orange-800' : 'bg-sky-100 text-sky-800'
}

// ─── Add Member Modal ─────────────────────────────────────────────────────────

function AddMemberModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [track, setTrack] = useState<Track>('BOH')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    if (!name.trim()) { setErr('Name is required'); return }
    setSaving(true)
    const badge = track === 'BOH' ? 'boh_team_member' : 'foh_team_member'
    const { error } = await supabase.from('team_members').insert({
      name: name.trim(), track, current_badge: badge, start_date: startDate,
    })
    setSaving(false)
    if (error) { setErr(error.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-800">Add Team Member</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
          <input
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            placeholder="e.g. Jordan Smith"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Track</label>
          <div className="flex gap-3">
            {(['BOH', 'FOH'] as Track[]).map(t => (
              <button
                key={t}
                onClick={() => setTrack(t)}
                className={`flex-1 py-2 rounded text-sm font-semibold border transition-colors ${
                  track === t
                    ? t === 'BOH' ? 'bg-orange-500 text-white border-orange-500' : 'bg-sky-500 text-white border-sky-500'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
          <input
            type="date"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
        </div>
        {err && <p className="text-red-600 text-sm">{err}</p>}
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2 rounded border border-gray-300 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 py-2 rounded bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Add Member'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Skill Row ────────────────────────────────────────────────────────────────

function SkillRow({
  skill, progress, badgeId, memberId, isManager, onUpdate,
}: {
  skill: { key: string; label: string; repsRequired: number }
  progress: SkillProgress | undefined
  badgeId: string
  memberId: string
  isManager: boolean
  onUpdate: (updated: SkillProgress) => void
}) {
  const done = progress?.count_done ?? 0
  const required = skill.repsRequired
  const completed = progress?.completed ?? false
  const [saving, setSaving] = useState(false)

  async function increment() {
    if (!isManager || completed) return
    setSaving(true)
    const newCount = done + 1
    const nowCompleted = required === 0 ? false : newCount >= required
    const today = new Date().toISOString().slice(0, 10)

    const { data, error } = await supabase
      .from('badge_progress')
      .upsert({
        member_id: memberId,
        badge_id: badgeId,
        skill_key: skill.key,
        count_done: newCount,
        completed: nowCompleted,
        completed_date: nowCompleted ? today : null,
      }, { onConflict: 'member_id,badge_id,skill_key' })
      .select()
      .single()

    setSaving(false)
    if (!error && data) onUpdate(data as SkillProgress)
  }

  async function toggleCheckbox() {
    if (!isManager) return
    setSaving(true)
    const today = new Date().toISOString().slice(0, 10)
    const nowCompleted = !completed

    const { data, error } = await supabase
      .from('badge_progress')
      .upsert({
        member_id: memberId,
        badge_id: badgeId,
        skill_key: skill.key,
        count_done: nowCompleted ? 1 : 0,
        completed: nowCompleted,
        completed_date: nowCompleted ? today : null,
      }, { onConflict: 'member_id,badge_id,skill_key' })
      .select()
      .single()

    setSaving(false)
    if (!error && data) onUpdate(data as SkillProgress)
  }

  const pct = required === 0 ? (completed ? 100 : 0) : Math.min(100, Math.round((done / required) * 100))

  return (
    <div className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-colors ${completed ? 'bg-green-50' : 'bg-gray-50'}`}>
      {required === 0 ? (
        // Checkbox skill (pass/fail)
        <button
          onClick={toggleCheckbox}
          disabled={saving || !isManager}
          className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
            completed
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-gray-300 bg-white'
          } ${isManager ? 'cursor-pointer hover:border-green-400' : 'cursor-default'}`}
        >
          {completed && <span className="text-xs">✓</span>}
        </button>
      ) : (
        // Rep counter
        <button
          onClick={increment}
          disabled={saving || completed || !isManager}
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-xs font-bold transition-colors ${
            completed
              ? 'bg-green-500 border-green-500 text-white cursor-default'
              : isManager
                ? 'border-orange-400 bg-white text-orange-600 hover:bg-orange-50 cursor-pointer'
                : 'border-gray-300 bg-white text-gray-400 cursor-default'
          }`}
        >
          {completed ? '✓' : '+'}
        </button>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm ${completed ? 'text-green-700 font-medium' : 'text-gray-700'}`}>
            {skill.label}
          </span>
          {required > 0 && (
            <span className={`text-xs font-mono flex-shrink-0 ${completed ? 'text-green-600' : 'text-gray-500'}`}>
              {done}/{required}
            </span>
          )}
        </div>
        {required > 0 && (
          <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${completed ? 'bg-green-500' : 'bg-orange-400'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>

      {completed && progress?.completed_date && (
        <span className="text-xs text-green-600 flex-shrink-0">
          {new Date(progress.completed_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      )}
    </div>
  )
}

// ─── Member Detail View ───────────────────────────────────────────────────────

function MemberDetail({
  member, onBack, onUpdated, isManager,
}: {
  member: TeamMember
  onBack: () => void
  onUpdated: (m: TeamMember) => void
  isManager: boolean
}) {
  const [progress, setProgress] = useState<SkillProgress[]>([])
  const [awarded, setAwarded] = useState<AwardedBadge[]>([])
  const [loading, setLoading] = useState(true)
  const [savingShifts, setSavingShifts] = useState(false)
  const [savingHours, setSavingHours] = useState(false)
  const [awardingBadge, setAwardingBadge] = useState(false)
  const [showAwardConfirm, setShowAwardConfirm] = useState(false)

  const currentBadge = getBadge(member.current_badge)
  const nextBadge = getNextBadge(member.current_badge, member.track)
  const trackBadges = member.track === 'BOH' ? BOH_BADGES : FOH_BADGES

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: prog }, { data: aw }] = await Promise.all([
        supabase.from('badge_progress').select('*').eq('member_id', member.id),
        supabase.from('awarded_badges').select('*').eq('member_id', member.id).order('awarded_at', { ascending: false }),
      ])
      setProgress((prog as SkillProgress[]) ?? [])
      setAwarded((aw as AwardedBadge[]) ?? [])
      setLoading(false)
    }
    load()
  }, [member.id])

  function handleSkillUpdate(updated: SkillProgress) {
    setProgress(prev => {
      const idx = prev.findIndex(p => p.badge_id === updated.badge_id && p.skill_key === updated.skill_key)
      if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next }
      return [...prev, updated]
    })
  }

  // Check if next badge requirements are met
  const nextBadgeReady = useMemo(() => {
    if (!nextBadge) return false
    const daysWorked = daysSince(member.start_date)

    if (nextBadge.minDays && (daysWorked ?? 0) < nextBadge.minDays) return false
    if (nextBadge.minShifts && member.total_shifts < nextBadge.minShifts) return false
    if (nextBadge.requiresServsafe && !member.servsafe_active) return false
    if (nextBadge.requiresHours) {
      const total = (member.boh_hours ?? 0) + (member.foh_hours ?? 0)
      if (total < nextBadge.requiresHours) return false
    }
    if (nextBadge.requiresBadge) {
      const hasIt = awarded.some(a => a.badge_id === nextBadge.requiresBadge)
      if (!hasIt) return false
    }
    // All skills completed?
    for (const skill of nextBadge.skills) {
      const p = progress.find(p => p.badge_id === nextBadge.id && p.skill_key === skill.key)
      if (skill.repsRequired === 0) {
        if (!p?.completed) return false
      } else {
        if ((p?.count_done ?? 0) < skill.repsRequired) return false
      }
    }
    return true
  }, [nextBadge, member, progress, awarded])

  async function addShift() {
    if (!isManager) return
    setSavingShifts(true)
    const newShifts = member.total_shifts + 1
    const { error } = await supabase.from('team_members').update({ total_shifts: newShifts }).eq('id', member.id)
    setSavingShifts(false)
    if (!error) onUpdated({ ...member, total_shifts: newShifts })
  }

  async function updateHours(field: 'boh_hours' | 'foh_hours', val: string) {
    const num = parseFloat(val)
    if (isNaN(num) || num < 0) return
    setSavingHours(true)
    const { error } = await supabase.from('team_members').update({ [field]: num }).eq('id', member.id)
    setSavingHours(false)
    if (!error) onUpdated({ ...member, [field]: num })
  }

  async function toggleServsafe() {
    if (!isManager) return
    const val = !member.servsafe_active
    const { error } = await supabase.from('team_members').update({ servsafe_active: val }).eq('id', member.id)
    if (!error) onUpdated({ ...member, servsafe_active: val })
  }

  async function awardBadge() {
    if (!isManager || !nextBadge) return
    setAwardingBadge(true)
    const { error: badgeErr } = await supabase.from('awarded_badges').insert({
      member_id: member.id,
      badge_id: nextBadge.id,
      shifts_at_award: member.total_shifts,
      pay_rate: nextBadge.pay,
    })
    if (!badgeErr) {
      const { error: memberErr } = await supabase.from('team_members').update({ current_badge: nextBadge.id }).eq('id', member.id)
      if (!memberErr) {
        onUpdated({ ...member, current_badge: nextBadge.id })
        const newAward: AwardedBadge = {
          id: Date.now().toString(),
          badge_id: nextBadge.id,
          awarded_at: new Date().toISOString(),
          awarded_by: null,
          shifts_at_award: member.total_shifts,
          pay_rate: nextBadge.pay,
        }
        setAwarded(prev => [newAward, ...prev])
      }
    }
    setAwardingBadge(false)
    setShowAwardConfirm(false)
  }

  async function deactivateMember() {
    if (!isManager) return
    const { error } = await supabase.from('team_members').update({ active: false }).eq('id', member.id)
    if (!error) { onUpdated({ ...member, active: false }); onBack() }
  }

  const daysWorked = daysSince(member.start_date)
  const totalHours = (member.boh_hours ?? 0) + (member.foh_hours ?? 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-orange-600 hover:text-orange-800 text-sm font-medium">← Back</button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{member.name}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${trackColor(member.track)}`}>{member.track}</span>
            {currentBadge && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeColor(member.current_badge)}`}>
                {currentBadge.title}
              </span>
            )}
            {currentBadge && (
              <span className="text-xs text-gray-500">{currentBadge.pay}</span>
            )}
            {!member.active && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Inactive</span>}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-gray-900">{member.total_shifts}</div>
          <div className="text-xs text-gray-500 mt-0.5">Total Shifts</div>
          {isManager && (
            <button
              onClick={addShift}
              disabled={savingShifts}
              className="mt-2 text-xs bg-orange-100 text-orange-700 px-3 py-1 rounded-full hover:bg-orange-200 disabled:opacity-50"
            >
              + Add Shift
            </button>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-gray-900">{daysWorked ?? '—'}</div>
          <div className="text-xs text-gray-500 mt-0.5">Days Employed</div>
          {member.start_date && (
            <div className="text-xs text-gray-400 mt-1">{new Date(member.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-gray-900">{totalHours.toFixed(0)}</div>
          <div className="text-xs text-gray-500 mt-0.5">Total Hours</div>
          {isManager && (
            <div className="flex gap-1 mt-2 justify-center">
              <input
                type="number"
                min="0"
                defaultValue={member.boh_hours}
                onBlur={e => updateHours('boh_hours', e.target.value)}
                className="w-14 text-xs border border-gray-200 rounded px-1 py-0.5 text-center"
                placeholder="BOH"
                title="BOH hours"
              />
              <input
                type="number"
                min="0"
                defaultValue={member.foh_hours}
                onBlur={e => updateHours('foh_hours', e.target.value)}
                className="w-14 text-xs border border-gray-200 rounded px-1 py-0.5 text-center"
                placeholder="FOH"
                title="FOH hours"
              />
            </div>
          )}
        </div>
        <div className={`border rounded-xl p-3 text-center ${member.servsafe_active ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
          <div className={`text-2xl font-bold ${member.servsafe_active ? 'text-green-600' : 'text-gray-400'}`}>
            {member.servsafe_active ? '✓' : '✗'}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">ServSafe</div>
          {isManager && (
            <button
              onClick={toggleServsafe}
              className={`mt-2 text-xs px-3 py-1 rounded-full ${member.servsafe_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {member.servsafe_active ? 'Active' : 'Mark Active'}
            </button>
          )}
        </div>
      </div>

      {/* Award badge banner */}
      {nextBadge && nextBadgeReady && isManager && (
        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl p-4 flex items-center justify-between shadow-md">
          <div>
            <p className="font-bold text-white text-lg">🎉 Ready for {nextBadge.title}!</p>
            <p className="text-yellow-100 text-sm">All requirements met — {nextBadge.pay}</p>
          </div>
          <button
            onClick={() => setShowAwardConfirm(true)}
            className="bg-white text-orange-600 font-bold px-4 py-2 rounded-lg hover:bg-yellow-50 text-sm"
          >
            Award Badge
          </button>
        </div>
      )}

      {/* Next badge requirements */}
      {nextBadge && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-800">Working toward: {nextBadge.title}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{nextBadge.pay} · {nextBadge.notes}</p>
            </div>
          </div>

          {/* Minimums */}
          {(nextBadge.minShifts || nextBadge.minDays || nextBadge.requiresServsafe || nextBadge.requiresHours || nextBadge.requiresBadge) && (
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Requirements</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {nextBadge.minShifts && (
                  <div className={`text-xs px-3 py-2 rounded-lg border ${member.total_shifts >= nextBadge.minShifts ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-600'}`}>
                    <span className="font-semibold">{member.total_shifts}/{nextBadge.minShifts}</span> shifts
                  </div>
                )}
                {nextBadge.minDays && (
                  <div className={`text-xs px-3 py-2 rounded-lg border ${(daysWorked ?? 0) >= nextBadge.minDays ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-600'}`}>
                    <span className="font-semibold">{daysWorked ?? 0}/{nextBadge.minDays}</span> days
                  </div>
                )}
                {nextBadge.requiresServsafe && (
                  <div className={`text-xs px-3 py-2 rounded-lg border ${member.servsafe_active ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-600'}`}>
                    {member.servsafe_active ? '✓' : '✗'} ServSafe
                  </div>
                )}
                {nextBadge.requiresHours && (
                  <div className={`text-xs px-3 py-2 rounded-lg border ${totalHours >= nextBadge.requiresHours ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-600'}`}>
                    <span className="font-semibold">{totalHours.toFixed(0)}/{nextBadge.requiresHours}</span> hrs
                  </div>
                )}
                {nextBadge.requiresBadge && (
                  <div className={`text-xs px-3 py-2 rounded-lg border ${awarded.some(a => a.badge_id === nextBadge.requiresBadge) ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-600'}`}>
                    {awarded.some(a => a.badge_id === nextBadge.requiresBadge) ? '✓' : '✗'} {getBadge(nextBadge.requiresBadge)?.title ?? nextBadge.requiresBadge}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Skills */}
          {nextBadge.skills.length > 0 && (
            <div className="p-4 space-y-2">
              {loading ? (
                <p className="text-sm text-gray-400 text-center py-4">Loading progress…</p>
              ) : (
                nextBadge.skills.map(skill => (
                  <SkillRow
                    key={skill.key}
                    skill={skill}
                    progress={progress.find(p => p.badge_id === nextBadge.id && p.skill_key === skill.key)}
                    badgeId={nextBadge.id}
                    memberId={member.id}
                    isManager={isManager}
                    onUpdate={handleSkillUpdate}
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Full track progress */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">{member.track} Career Path</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {trackBadges.map((badge, idx) => {
            const isEarned = badge.sortOrder < (currentBadge?.sortOrder ?? 0) || badge.id === member.current_badge
            const awardRecord = awarded.find(a => a.badge_id === badge.id)
            return (
              <div key={badge.id} className={`flex items-center gap-4 px-4 py-3 ${isEarned ? '' : 'opacity-50'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${isEarned ? badgeColor(badge.id) : 'bg-gray-200 text-gray-400'}`}>
                  {isEarned ? '✓' : idx + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold text-sm ${badge.id === member.current_badge ? 'text-orange-700' : isEarned ? 'text-gray-700' : 'text-gray-400'}`}>
                      {badge.title}
                    </span>
                    {badge.id === member.current_badge && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">Current</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {badge.pay}
                    {awardRecord && ` · Awarded ${new Date(awardRecord.awarded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Deactivate */}
      {isManager && member.active && (
        <div className="pt-2">
          <button
            onClick={deactivateMember}
            className="text-xs text-red-500 hover:text-red-700 hover:underline"
          >
            Mark as inactive / no longer employed
          </button>
        </div>
      )}

      {/* Award confirm modal */}
      {showAwardConfirm && nextBadge && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4 text-center">
            <div className="text-4xl">🏅</div>
            <h2 className="text-lg font-bold text-gray-800">Award {nextBadge.title}?</h2>
            <p className="text-sm text-gray-600">
              This will promote <strong>{member.name}</strong> to <strong>{nextBadge.title}</strong> ({nextBadge.pay}) and record the badge in their history.
            </p>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAwardConfirm(false)} className="flex-1 py-2 rounded border border-gray-300 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button
                onClick={awardBadge}
                disabled={awardingBadge}
                className="flex-1 py-2 rounded bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 disabled:opacity-50"
              >
                {awardingBadge ? 'Awarding…' : '🎉 Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const { isManager } = useAuth()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [filterTrack, setFilterTrack] = useState<Track | 'ALL'>('ALL')
  const [showInactive, setShowInactive] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('team_members')
      .select('*')
      .order('name')
    setMembers((data as TeamMember[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function handleMemberUpdated(updated: TeamMember) {
    setMembers(prev => prev.map(m => m.id === updated.id ? updated : m))
    setSelectedMember(updated)
  }

  const filtered = members.filter(m => {
    if (!showInactive && !m.active) return false
    if (filterTrack !== 'ALL' && m.track !== filterTrack) return false
    return true
  })

  const activeCount = members.filter(m => m.active).length
  const bohCount = members.filter(m => m.active && m.track === 'BOH').length
  const fohCount = members.filter(m => m.active && m.track === 'FOH').length

  // Member detail view
  if (selectedMember) {
    const live = members.find(m => m.id === selectedMember.id) ?? selectedMember
    return (
      <main className="max-w-2xl mx-auto px-4 py-6">
        <MemberDetail
          member={live}
          onBack={() => setSelectedMember(null)}
          onUpdated={handleMemberUpdated}
          isManager={isManager}
        />
      </main>
    )
  }

  // Team roster view
  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Growth</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {activeCount} active · {bohCount} BOH · {fohCount} FOH
          </p>
        </div>
        {isManager && (
          <button
            onClick={() => setShowAdd(true)}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-700"
          >
            + Add Member
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(['ALL', 'BOH', 'FOH'] as const).map(t => (
          <button
            key={t}
            onClick={() => setFilterTrack(t)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filterTrack === t
                ? 'bg-orange-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t === 'ALL' ? 'All Tracks' : t}
          </button>
        ))}
        <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 text-sm text-gray-600 cursor-pointer hover:bg-gray-200">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)}
            className="accent-orange-500"
          />
          Show inactive
        </label>
      </div>

      {/* Member cards */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading team…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {members.length === 0
            ? 'No team members yet — add your first one!'
            : 'No members match this filter.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(m => {
            const badge = getBadge(m.current_badge)
            const next = getNextBadge(m.current_badge, m.track)
            const days = daysSince(m.start_date)
            return (
              <button
                key={m.id}
                onClick={() => setSelectedMember(m)}
                className={`w-full text-left bg-white border rounded-xl p-4 hover:border-orange-300 hover:shadow-sm transition-all ${!m.active ? 'opacity-60 border-dashed border-gray-200' : 'border-gray-200'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900">{m.name}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${trackColor(m.track)}`}>{m.track}</span>
                      {!m.active && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Inactive</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {badge && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeColor(m.current_badge)}`}>
                          {badge.title}
                        </span>
                      )}
                      {badge && <span className="text-xs text-gray-500">{badge.pay}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-gray-700">{m.total_shifts} shifts</div>
                    {days !== null && <div className="text-xs text-gray-400">{days}d employed</div>}
                  </div>
                </div>
                {next && (
                  <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-1">
                    <span className="text-xs text-gray-400">Next:</span>
                    <span className="text-xs text-orange-600 font-medium">{next.title}</span>
                    <span className="text-xs text-gray-400">→ {next.pay}</span>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {showAdd && (
        <AddMemberModal
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load() }}
        />
      )}
    </main>
  )
}
