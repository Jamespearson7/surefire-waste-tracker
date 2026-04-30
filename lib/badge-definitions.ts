// ─────────────────────────────────────────────────────────────────────────────
// Surefire Market — Badge & Promotion Definitions
// All badge IDs, skills, rep requirements, and advancement rules live here.
// ─────────────────────────────────────────────────────────────────────────────

export type Track = 'BOH' | 'FOH'

export type Skill = {
  key: string          // unique within a badge
  label: string
  repsRequired: number // 0 = pass/fail checkbox
}

export type Badge = {
  id: string
  track: Track
  title: string
  pay: string          // e.g. "$15/hr"
  sortOrder: number    // 1 = entry level
  minShifts: number | null
  minDays: number | null
  requiresServsafe: boolean
  requiresBadge: string | null   // badge id that must be earned first (cross-train)
  requiresHours: number | null   // e.g. 1000 milestone
  skills: Skill[]
  notes?: string
}

// ─── BOH Badges ──────────────────────────────────────────────────────────────

const BOH_LINE: Badge = {
  id: 'boh_line',
  track: 'BOH',
  title: 'Kitchen Line',
  pay: '$15/hr',
  sortOrder: 2,
  minShifts: null,
  minDays: 90,
  requiresServsafe: false,
  requiresBadge: null,
  requiresHours: null,
  skills: [
    { key: 'fryer',      label: 'Fryer',             repsRequired: 4 },
    { key: 'grill',      label: 'Grill',              repsRequired: 4 },
    { key: 'saute',      label: 'Sauté/Expo',         repsRequired: 4 },
    { key: 'sandwich',   label: 'Sandwich Station',   repsRequired: 4 },
    { key: 'salad',      label: 'Salad Station',      repsRequired: 4 },
    { key: 'prep',       label: 'Prep Work',          repsRequired: 4 },
  ],
  notes: 'Must work all 6 stations with at least 4 reps each. Minimum 90 days employed.',
}

const BOH_TRAINER: Badge = {
  id: 'boh_trainer',
  track: 'BOH',
  title: 'BOH Trainer',
  pay: '$16/hr',
  sortOrder: 3,
  minShifts: 50,
  minDays: 60,
  requiresServsafe: false,
  requiresBadge: 'boh_line',
  requiresHours: null,
  skills: [
    { key: 'fryer',       label: 'Fryer (train)',            repsRequired: 2 },
    { key: 'grill',       label: 'Grill (train)',            repsRequired: 2 },
    { key: 'saute',       label: 'Sauté/Expo (train)',       repsRequired: 2 },
    { key: 'sandwich',    label: 'Sandwich Station (train)', repsRequired: 2 },
    { key: 'salad',       label: 'Salad Station (train)',    repsRequired: 2 },
    { key: 'prep',        label: 'Prep Work (train)',        repsRequired: 2 },
    { key: 'new_hire',    label: 'Trained a New Hire',       repsRequired: 1 },
    { key: 'opening',     label: 'Opening Duties',           repsRequired: 3 },
    { key: 'closing',     label: 'Closing Duties',           repsRequired: 3 },
  ],
  notes: 'Must hold Kitchen Line badge. 50+ shifts, 60+ days.',
}

const BOH_SHIFT_LEAD: Badge = {
  id: 'boh_shift_lead',
  track: 'BOH',
  title: 'BOH Shift Lead',
  pay: '$17/hr',
  sortOrder: 4,
  minShifts: 80,
  minDays: 90,
  requiresServsafe: true,
  requiresBadge: 'boh_trainer',
  requiresHours: null,
  skills: [
    { key: 'open_lead',    label: 'Led Opening Shift',         repsRequired: 5 },
    { key: 'close_lead',   label: 'Led Closing Shift',         repsRequired: 5 },
    { key: 'ordering',     label: 'Placed Supply Order',       repsRequired: 3 },
    { key: 'waste_log',    label: 'Completed Waste Log',       repsRequired: 5 },
    { key: 'temp_log',     label: 'Completed Temp Log',        repsRequired: 5 },
    { key: 'staff_mgmt',   label: 'Managed Staff Conflict',    repsRequired: 2 },
    { key: 'coaching',     label: 'Coached a Team Member',     repsRequired: 3 },
    { key: 'servsafe',     label: 'ServSafe Certified',        repsRequired: 0 },
    { key: 'inventory',    label: 'Full Inventory Count',      repsRequired: 3 },
  ],
  notes: 'Must hold BOH Trainer badge + valid ServSafe. 80+ shifts, 90+ days.',
}

const BOH_HELL_RAISER: Badge = {
  id: 'boh_hell_raiser',
  track: 'BOH',
  title: 'BOH Hell Raiser',
  pay: '$20/hr',
  sortOrder: 5,
  minShifts: 84,
  minDays: null,
  requiresServsafe: true,
  requiresBadge: 'foh_market_floor',  // must cross-train and earn MF badge
  requiresHours: 1000,
  skills: [
    { key: 'full_open',    label: 'Full Open (BOH+FOH)',        repsRequired: 5 },
    { key: 'full_close',   label: 'Full Close (BOH+FOH)',       repsRequired: 5 },
    { key: 'catering',     label: 'Catering/Event Execution',   repsRequired: 2 },
    { key: 'menu_dev',     label: 'Menu Dev / Specials Input',  repsRequired: 1 },
    { key: 'schedules',    label: 'Built a Schedule',           repsRequired: 2 },
    { key: 'hiring',       label: 'Participated in Hiring',     repsRequired: 1 },
    { key: 'p_and_l',      label: 'Reviewed P&L with GM',       repsRequired: 2 },
    { key: 'thousand_hrs', label: '1,000 Total Hours Worked',   repsRequired: 0 },
    { key: 'cross_foh',    label: 'Cross-trained FOH (MF badge)',repsRequired: 0 },
  ],
  notes: 'Must hold BOH Shift Lead + Market Floor badge. 84+ shifts, 1,000+ hours, active ServSafe.',
}

// ─── FOH Badges ──────────────────────────────────────────────────────────────

const FOH_MARKET_FLOOR: Badge = {
  id: 'foh_market_floor',
  track: 'FOH',
  title: 'Market Floor',
  pay: '$14/hr',
  sortOrder: 2,
  minShifts: 51,
  minDays: 90,
  requiresServsafe: false,
  requiresBadge: null,
  requiresHours: null,
  skills: [
    { key: 'register',    label: 'Register / POS',         repsRequired: 5 },
    { key: 'stocking',    label: 'Stocking Shelves',       repsRequired: 5 },
    { key: 'customer',    label: 'Customer Service',       repsRequired: 5 },
    { key: 'deli',        label: 'Deli Counter',           repsRequired: 4 },
    { key: 'coffee',      label: 'Coffee / Drinks Bar',    repsRequired: 4 },
    { key: 'cleaning',    label: 'Opening/Closing Clean',  repsRequired: 4 },
    { key: 'receiving',   label: 'Receiving Delivery',     repsRequired: 3 },
    { key: 'catering',    label: 'Catering Assist',        repsRequired: 2 },
    { key: 'cash_count',  label: 'Cash Drawer Count',      repsRequired: 3 },
  ],
  notes: '51+ shifts, 90+ days employed.',
}

const FOH_TRAINER: Badge = {
  id: 'foh_trainer',
  track: 'FOH',
  title: 'MF Trainer',
  pay: '$14.50/hr',
  sortOrder: 3,
  minShifts: 65,
  minDays: 90,
  requiresServsafe: false,
  requiresBadge: 'foh_market_floor',
  requiresHours: null,
  skills: [
    { key: 'register_t',  label: 'Register/POS (train)',        repsRequired: 2 },
    { key: 'stocking_t',  label: 'Stocking (train)',            repsRequired: 2 },
    { key: 'deli_t',      label: 'Deli Counter (train)',        repsRequired: 2 },
    { key: 'coffee_t',    label: 'Coffee/Drinks (train)',       repsRequired: 2 },
    { key: 'new_hire',    label: 'Trained a New Hire',          repsRequired: 1 },
    { key: 'opening',     label: 'Led Opening (FOH)',           repsRequired: 3 },
    { key: 'closing',     label: 'Led Closing (FOH)',           repsRequired: 3 },
    { key: 'cash_close',  label: 'Cash Close / Reconcile',      repsRequired: 3 },
    { key: 'receiving',   label: 'Receiving + Check-in Order',  repsRequired: 3 },
    { key: 'catering',    label: 'Catering Setup/Breakdown',    repsRequired: 2 },
    { key: 'customer_esc',label: 'Resolved Customer Issue',     repsRequired: 2 },
    { key: 'daily_check', label: 'Daily Temp / Safety Check',   repsRequired: 4 },
  ],
  notes: 'Must hold Market Floor badge. 65+ shifts, 90+ days.',
}

const FOH_SHIFT_LEAD: Badge = {
  id: 'foh_shift_lead',
  track: 'FOH',
  title: 'MF Shift Lead',
  pay: '$16/hr',
  sortOrder: 4,
  minShifts: null,
  minDays: 90,
  requiresServsafe: false,
  requiresBadge: 'foh_trainer',
  requiresHours: null,
  skills: [
    { key: 'open_lead',   label: 'Led Full Open',              repsRequired: 5 },
    { key: 'close_lead',  label: 'Led Full Close',             repsRequired: 5 },
    { key: 'ordering',    label: 'Placed FOH Supply Order',    repsRequired: 3 },
    { key: 'staff_lead',  label: 'Managed Floor Staff',        repsRequired: 5 },
    { key: 'conflict',    label: 'Handled Staff/Guest Issue',  repsRequired: 2 },
  ],
  notes: 'Must hold MF Trainer badge. 90+ days.',
}

const FOH_HELL_RAISER: Badge = {
  id: 'foh_hell_raiser',
  track: 'FOH',
  title: 'FOH Hell Raiser',
  pay: '$20/hr',
  sortOrder: 5,
  minShifts: 84,
  minDays: null,
  requiresServsafe: false,
  requiresBadge: 'boh_line',  // must cross-train and earn Kitchen Line badge
  requiresHours: 1000,
  skills: [
    { key: 'full_open',   label: 'Full Open (FOH+BOH)',        repsRequired: 5 },
    { key: 'full_close',  label: 'Full Close (FOH+BOH)',       repsRequired: 5 },
    { key: 'catering_lead', label: 'Led Catering Event',       repsRequired: 2 },
    { key: 'menu_dev',    label: 'Menu / Specials Input',       repsRequired: 1 },
    { key: 'schedules',   label: 'Built a Schedule',            repsRequired: 2 },
    { key: 'hiring',      label: 'Participated in Hiring',      repsRequired: 1 },
    { key: 'p_and_l',     label: 'Reviewed P&L with GM',        repsRequired: 2 },
    { key: 'thousand_hrs',label: '1,000 Total Hours Worked',    repsRequired: 0 },
    { key: 'cross_boh',   label: 'Cross-trained BOH (KL badge)', repsRequired: 0 },
  ],
  notes: 'Must hold FOH Shift Lead + Kitchen Line badge. 84+ shifts, 1,000+ hours.',
}

// ─── Team Member base levels (entry) ─────────────────────────────────────────

export const ENTRY_BADGE_BOH: Badge = {
  id: 'boh_team_member',
  track: 'BOH',
  title: 'BOH Team Member',
  pay: '$13/hr',
  sortOrder: 1,
  minShifts: null,
  minDays: null,
  requiresServsafe: false,
  requiresBadge: null,
  requiresHours: null,
  skills: [],
  notes: 'Starting position — BOH track.',
}

export const ENTRY_BADGE_FOH: Badge = {
  id: 'foh_team_member',
  track: 'FOH',
  title: 'FOH Team Member',
  pay: '$12/hr',
  sortOrder: 1,
  minShifts: null,
  minDays: null,
  requiresServsafe: false,
  requiresBadge: null,
  requiresHours: null,
  skills: [],
  notes: 'Starting position — FOH track.',
}

// ─── Master lists ─────────────────────────────────────────────────────────────

export const ALL_BADGES: Badge[] = [
  ENTRY_BADGE_BOH,
  BOH_LINE,
  BOH_TRAINER,
  BOH_SHIFT_LEAD,
  BOH_HELL_RAISER,
  ENTRY_BADGE_FOH,
  FOH_MARKET_FLOOR,
  FOH_TRAINER,
  FOH_SHIFT_LEAD,
  FOH_HELL_RAISER,
]

export const BOH_BADGES = ALL_BADGES.filter(b => b.track === 'BOH').sort((a, b) => a.sortOrder - b.sortOrder)
export const FOH_BADGES = ALL_BADGES.filter(b => b.track === 'FOH').sort((a, b) => a.sortOrder - b.sortOrder)

export function getBadge(id: string): Badge | undefined {
  return ALL_BADGES.find(b => b.id === id)
}

export function getNextBadge(currentBadgeId: string, track: Track): Badge | undefined {
  const list = track === 'BOH' ? BOH_BADGES : FOH_BADGES
  const current = list.find(b => b.id === currentBadgeId)
  if (!current) return undefined
  return list.find(b => b.sortOrder === current.sortOrder + 1)
}
