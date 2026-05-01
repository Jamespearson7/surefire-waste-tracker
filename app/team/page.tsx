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
// Matches the physical badge sheet exactly:
//   STATION NAME  [1][2][3]...[n]   SHIFTS DONE __/n   DATE COMPLETED ___

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
  const allDone = required === 0 ? (progress?.completed ?? false) : done >= required
  const [saving, setSaving] = useState(false)

  async function tapBox(boxIndex: number) {
    if (!isManager || saving) return
    let newCount: number
    if (boxIndex === done) {
      newCount = done + 1           // check next box
    } else if (boxIndex === done - 1) {
      newCount = done - 1           // uncheck last box (undo)
    } else {
      return
    }
    setSaving(true)
    const nowCompleted = newCount >= required
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

  async function toggleSingle() {
    if (!isManager || saving) return
    setSaving(true)
    const nowCompleted = !allDone
    const today = new Date().toISOString().slice(0, 10)
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

  return (
    <div className={`border-b border-gray-200 last:border-b-0 py-3 px-4 ${allDone ? 'bg-green-50' : 'bg-white'}`}>
      <div className="flex items-center gap-3">

        {/* Station name — bold, left, fixed width like the sheet */}
        <span className={`text-base font-bold w-20 flex-shrink-0 ${allDone ? 'text-green-700' : 'text-gray-900'}`}>
          {skill.label}
        </span>

        {/* Numbered boxes */}
        <div className="flex items-center gap-1 flex-1">
          {required === 0 ? (
            <button
              onClick={toggleSingle}
              disabled={saving || !isManager}
              className={`w-8 h-8 rounded border-2 flex items-center justify-center font-bold text-sm transition-colors
                ${allDone ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-400 text-gray-400 hover:border-green-400'}
                ${isManager ? 'cursor-pointer' : 'cursor-default'}`}
            >
              ✓
            </button>
          ) : (
            Array.from({ length: required }).map((_, i) => {
              const isChecked = i < done
              const isNext = i === done
              const isLast = i === done - 1
              return (
                <button
                  key={i}
                  onClick={() => tapBox(i)}
                  disabled={saving || !isManager || (!isNext && !isLast)}
                  title={isNext && isManager ? 'Tap to check' : isLast && isManager ? 'Tap to undo' : undefined}
                  className={`w-8 h-8 rounded border-2 flex items-center justify-center text-xs font-bold transition-all select-none
                    ${isChecked && allDone
                      ? 'bg-green-500 border-green-600 text-white'
                      : isChecked
                        ? 'bg-gray-800 border-gray-800 text-white'
                        : isNext && isManager
                          ? 'bg-white border-gray-400 text-gray-300 hover:border-gray-700 hover:text-gray-600 cursor-pointer'
                          : 'bg-white border-gray-200 text-gray-200 cursor-default'}
                  `}
                >
                  {i + 1}
                </button>
              )
            })
          )}
        </div>

        {/* Right side: SHIFTS DONE + DATE COMPLETED */}
        <div className="flex-shrink-0 text-right min-w-[100px]">
          <div className="text-xs text-gray-400 uppercase tracking-wide leading-none mb-0.5">Shifts Done</div>
          <div className={`text-sm font-bold ${allDone ? 'text-green-600' : 'text-gray-700'}`}>
            {required === 0 ? (allDone ? '1 / 1' : '0 / 1') : `${done} / ${required}`}
          </div>
          <div className="text-xs text-gray-400 uppercase tracking-wide leading-none mt-1.5 mb-0.5">Date Completed</div>
          <div className="text-xs text-gray-600 font-medium h-4">
            {allDone && progress?.completed_date
              ? new Date(progress.completed_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
              : <span className="text-gray-300">——</span>}
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Badge Section (reusable for both primary + cross-train tracks) ───────────

function BadgeSection({
  targetBadge,
  isPrimary,
  member,
  progress,
  awarded,
  loading,
  isManager,
  onSkillUpdate,
  onAward,
}: {
  targetBadge: Badge
  isPrimary: boolean
  member: TeamMember
  progress: SkillProgress[]
  awarded: AwardedBadge[]
  loading: boolean
  isManager: boolean
  onSkillUpdate: (u: SkillProgress) => void
  onAward: (badge: Badge) => void
}) {
  const daysWorked = daysSince(member.start_date)
  const totalHours = (member.boh_hours ?? 0) + (member.foh_hours ?? 0)

  const meetsRequirements = useMemo(() => {
    if (targetBadge.minDays && (daysWorked ?? 0) < targetBadge.minDays) return false
    if (targetBadge.minShifts && member.total_shifts < targetBadge.minShifts) return false
    if (targetBadge.requiresServsafe && !member.servsafe_active) return false
    if (targetBadge.requiresHours && totalHours < targetBadge.requiresHours) return false
    if (targetBadge.requiresBadge && !awarded.some(a => a.badge_id === targetBadge.requiresBadge)) return false
    for (const skill of targetBadge.skills) {
      const p = progress.find(p => p.badge_id === targetBadge.id && p.skill_key === skill.key)
      if (skill.repsRequired === 0) { if (!p?.completed) return false }
      else { if ((p?.count_done ?? 0) < skill.repsRequired) return false }
    }
    return true
  }, [targetBadge, member, progress, awarded, daysWorked, totalHours])

  const crossTrackLabel = targetBadge.track === 'BOH' ? 'BOH Cross-Training' : 'FOH Cross-Training'
  const sectionLabel = isPrimary ? `Working toward: ${targetBadge.title}` : `${crossTrackLabel}: ${targetBadge.title}`
  const headerColor = isPrimary
    ? 'bg-orange-50 border-orange-200'
    : targetBadge.track === 'BOH'
      ? 'bg-orange-50 border-orange-200'
      : 'bg-sky-50 border-sky-200'
  const labelColor = isPrimary ? 'text-orange-800' : targetBadge.track === 'BOH' ? 'text-orange-700' : 'text-sky-700'

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className={`px-4 py-3 border-b flex items-center justify-between ${headerColor}`}>
        <div>
          <h2 className={`font-bold text-base ${labelColor}`}>{sectionLabel}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{targetBadge.pay} · {targetBadge.notes}</p>
        </div>
        {!isPrimary && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${targetBadge.track === 'BOH' ? 'bg-orange-100 text-orange-700' : 'bg-sky-100 text-sky-700'}`}>
            {targetBadge.track}
          </span>
        )}
      </div>

      {/* Requirements chips */}
      {(targetBadge.minShifts || targetBadge.minDays || targetBadge.requiresServsafe || targetBadge.requiresHours || targetBadge.requiresBadge) && (
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Requirements</p>
          <div className="flex flex-wrap gap-2">
            {targetBadge.minShifts && (
              <div className={`text-xs px-3 py-1.5 rounded-lg border font-medium ${member.total_shifts >= targetBadge.minShifts ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-600'}`}>
                {member.total_shifts}/{targetBadge.minShifts} shifts
              </div>
            )}
            {targetBadge.minDays && (
              <div className={`text-xs px-3 py-1.5 rounded-lg border font-medium ${(daysWorked ?? 0) >= targetBadge.minDays ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-600'}`}>
                {daysWorked ?? 0}/{targetBadge.minDays} days
              </div>
            )}
            {targetBadge.requiresServsafe && (
              <div className={`text-xs px-3 py-1.5 rounded-lg border font-medium ${member.servsafe_active ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-600'}`}>
                {member.servsafe_active ? '✓' : '✗'} ServSafe
              </div>
            )}
            {targetBadge.requiresHours && (
              <div className={`text-xs px-3 py-1.5 rounded-lg border font-medium ${totalHours >= targetBadge.requiresHours ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-600'}`}>
                {totalHours.toFixed(0)}/{targetBadge.requiresHours} hrs
              </div>
            )}
            {targetBadge.requiresBadge && (
              <div className={`text-xs px-3 py-1.5 rounded-lg border font-medium ${awarded.some(a => a.badge_id === targetBadge.requiresBadge) ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-600'}`}>
                {awarded.some(a => a.badge_id === targetBadge.requiresBadge) ? '✓' : '✗'} {getBadge(targetBadge.requiresBadge)?.title}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Skill rows */}
      {targetBadge.skills.length > 0 && (
        <div className="divide-y divide-gray-100">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-4">Loading…</p>
          ) : (
            targetBadge.skills.map(skill => (
              <SkillRow
                key={skill.key}
                skill={skill}
                progress={progress.find(p => p.badge_id === targetBadge.id && p.skill_key === skill.key)}
                badgeId={targetBadge.id}
                memberId={member.id}
                isManager={isManager}
                onUpdate={onSkillUpdate}
              />
            ))
          )}
        </div>
      )}

      {/* Award button */}
      {meetsRequirements && isManager && (
        <div className="px-4 py-3 border-t border-gray-100 bg-gradient-to-r from-yellow-50 to-orange-50">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-orange-800">🎉 All requirements met!</p>
            <button
              onClick={() => onAward(targetBadge)}
              className="bg-orange-600 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-orange-700"
            >
              Award Badge
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Career Path Row ──────────────────────────────────────────────────────────

function CareerPathRow({ badges, currentBadgeId, awarded, label, color }: {
  badges: Badge[]
  currentBadgeId: string
  awarded: AwardedBadge[]
  label: string
  color: string
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className={`px-4 py-2.5 border-b border-gray-100 ${color}`}>
        <h3 className="font-bold text-sm text-gray-700">{label} Career Path</h3>
      </div>
      <div className="divide-y divide-gray-100">
        {badges.map((badge, idx) => {
          const isEarned = awarded.some(a => a.badge_id === badge.id) || badge.id === currentBadgeId
          const isCurrent = badge.id === currentBadgeId
          const awardRecord = awarded.find(a => a.badge_id === badge.id)
          return (
            <div key={badge.id} className={`flex items-center gap-3 px-4 py-2.5 ${!isEarned ? 'opacity-40' : ''}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isEarned ? badgeColor(badge.id) : 'bg-gray-200 text-gray-400'}`}>
                {isEarned ? '✓' : idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-sm font-semibold ${isCurrent ? 'text-orange-700' : isEarned ? 'text-gray-700' : 'text-gray-400'}`}>{badge.title}</span>
                  {isCurrent && <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">Current</span>}
                </div>
                <div className="text-xs text-gray-400">
                  {badge.pay}{awardRecord ? ` · ${new Date(awardRecord.awarded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                </div>
              </div>
            </div>
          )
        })}
      </div>
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
  const [awardConfirm, setAwardConfirm] = useState<Badge | null>(null)
  const [awarding, setAwarding] = useState(false)

  const crossTrack: Track = member.track === 'BOH' ? 'FOH' : 'BOH'
  const crossBadges = crossTrack === 'BOH' ? BOH_BADGES : FOH_BADGES
  const primaryBadges = member.track === 'BOH' ? BOH_BADGES : FOH_BADGES

  // Primary next badge
  const currentBadge = getBadge(member.current_badge)
  const nextPrimaryBadge = getNextBadge(member.current_badge, member.track)

  // Cross-track: find highest earned cross badge, then get the next one
  const nextCrossBadge = useMemo(() => {
    let highestEarned: Badge | undefined
    for (const b of crossBadges) {
      if (awarded.some(a => a.badge_id === b.id)) highestEarned = b
    }
    if (!highestEarned) return crossBadges.find(b => b.sortOrder === 2) // first real badge
    return crossBadges.find(b => b.sortOrder === highestEarned!.sortOrder + 1)
  }, [awarded, crossBadges])

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
    const { error } = await supabase.from('team_members').update({ [field]: num }).eq('id', member.id)
    if (!error) onUpdated({ ...member, [field]: num })
  }

  async function toggleServsafe() {
    if (!isManager) return
    const val = !member.servsafe_active
    const { error } = await supabase.from('team_members').update({ servsafe_active: val }).eq('id', member.id)
    if (!error) onUpdated({ ...member, servsafe_active: val })
  }

  async function confirmAward(badge: Badge) {
    if (!isManager) return
    setAwarding(true)
    const isPrimaryBadge = badge.track === member.track
    const { error: badgeErr } = await supabase.from('awarded_badges').insert({
      member_id: member.id,
      badge_id: badge.id,
      shifts_at_award: member.total_shifts,
      pay_rate: badge.pay,
    })
    if (!badgeErr) {
      // Only update current_badge for primary track awards
      if (isPrimaryBadge) {
        await supabase.from('team_members').update({ current_badge: badge.id }).eq('id', member.id)
        onUpdated({ ...member, current_badge: badge.id })
      }
      setAwarded(prev => [{
        id: Date.now().toString(),
        badge_id: badge.id,
        awarded_at: new Date().toISOString(),
        awarded_by: null,
        shifts_at_award: member.total_shifts,
        pay_rate: badge.pay,
      }, ...prev])
    }
    setAwarding(false)
    setAwardConfirm(null)
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
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeColor(member.current_badge)}`}>{currentBadge.title}</span>
            )}
            {currentBadge && <span className="text-xs text-gray-500">{currentBadge.pay}</span>}
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
            <button onClick={addShift} disabled={savingShifts} className="mt-2 text-xs bg-orange-100 text-orange-700 px-3 py-1 rounded-full hover:bg-orange-200 disabled:opacity-50">
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
              <input type="number" min="0" defaultValue={member.boh_hours} onBlur={e => updateHours('boh_hours', e.target.value)} className="w-14 text-xs border border-gray-200 rounded px-1 py-0.5 text-center" placeholder="BOH" title="BOH hours" />
              <input type="number" min="0" defaultValue={member.foh_hours} onBlur={e => updateHours('foh_hours', e.target.value)} className="w-14 text-xs border border-gray-200 rounded px-1 py-0.5 text-center" placeholder="FOH" title="FOH hours" />
            </div>
          )}
        </div>
        <div className={`border rounded-xl p-3 text-center ${member.servsafe_active ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
          <div className={`text-2xl font-bold ${member.servsafe_active ? 'text-green-600' : 'text-gray-400'}`}>{member.servsafe_active ? '✓' : '✗'}</div>
          <div className="text-xs text-gray-500 mt-0.5">ServSafe</div>
          {isManager && (
            <button onClick={toggleServsafe} className={`mt-2 text-xs px-3 py-1 rounded-full ${member.servsafe_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {member.servsafe_active ? 'Active' : 'Mark Active'}
            </button>
          )}
        </div>
      </div>

      {/* ── Primary track badge section ── */}
      {nextPrimaryBadge && (
        <BadgeSection
          targetBadge={nextPrimaryBadge}
          isPrimary={true}
          member={member}
          progress={progress}
          awarded={awarded}
          loading={loading}
          isManager={isManager}
          onSkillUpdate={handleSkillUpdate}
          onAward={b => setAwardConfirm(b)}
        />
      )}

      {/* ── Cross-training section (other track) ── */}
      {nextCrossBadge && (
        <BadgeSection
          targetBadge={nextCrossBadge}
          isPrimary={false}
          member={member}
          progress={progress}
          awarded={awarded}
          loading={loading}
          isManager={isManager}
          onSkillUpdate={handleSkillUpdate}
          onAward={b => setAwardConfirm(b)}
        />
      )}

      {/* ── Career paths side by side ── */}
      <CareerPathRow
        badges={primaryBadges}
        currentBadgeId={member.current_badge}
        awarded={awarded}
        label={member.track}
        color="bg-orange-50"
      />
      <CareerPathRow
        badges={crossBadges}
        currentBadgeId=""
        awarded={awarded}
        label={crossTrack}
        color="bg-sky-50"
      />

      {/* Deactivate */}
      {isManager && member.active && (
        <div className="pt-2">
          <button onClick={deactivateMember} className="text-xs text-red-500 hover:text-red-700 hover:underline">
            Mark as inactive / no longer employed
          </button>
        </div>
      )}

      {/* Award confirm modal */}
      {awardConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4 text-center">
            <div className="text-4xl">🏅</div>
            <h2 className="text-lg font-bold text-gray-800">Award {awardConfirm.title}?</h2>
            <p className="text-sm text-gray-600">
              This will award <strong>{member.name}</strong> the <strong>{awardConfirm.title}</strong> badge ({awardConfirm.pay}) and record it in their history.
              {awardConfirm.track !== member.track && (
                <span className="block mt-1 text-sky-600 font-medium">Cross-training badge — does not change primary pay rate.</span>
              )}
            </p>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setAwardConfirm(null)} className="flex-1 py-2 rounded border border-gray-300 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => confirmAward(awardConfirm)}
                disabled={awarding}
                className="flex-1 py-2 rounded bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 disabled:opacity-50"
              >
                {awarding ? 'Awarding…' : '🎉 Confirm'}
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
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ ok: boolean; msg: string } | null>(null)

  async function syncFromToast() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/toast-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysBack: 365 }),
      })
      const data = await res.json()
      if (data.ok) {
        setSyncResult({ ok: true, msg: `✓ Synced ${data.employeesFromToast} employees from Toast — ${data.created} new, ${data.updated} updated.` })
        await load()
      } else {
        setSyncResult({ ok: false, msg: data.error ?? 'Sync failed.' })
      }
    } catch {
      setSyncResult({ ok: false, msg: 'Network error — could not reach Toast.' })
    }
    setSyncing(false)
  }

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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Growth</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {activeCount} active · {bohCount} BOH · {fohCount} FOH
          </p>
        </div>
        {isManager && (
          <div className="flex gap-2">
            <button
              onClick={syncFromToast}
              disabled={syncing}
              className="flex items-center gap-1.5 bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              {syncing ? (
                <><span className="animate-spin">⟳</span> Syncing…</>
              ) : (
                <><span>⟳</span> Sync Toast</>
              )}
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-700"
            >
              + Add Member
            </button>
          </div>
        )}
      </div>

      {/* Sync result banner */}
      {syncResult && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium ${syncResult.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {syncResult.msg}
          <button onClick={() => setSyncResult(null)} className="ml-3 text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

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
