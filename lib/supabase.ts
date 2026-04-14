import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type ShiftWasteEntry = {
  id?: string
  created_at?: string
  date: string
  shift: 'Opening' | 'Closing'
  shift_lead: string
  time_logged?: string
  item: string
  loss_reason: string
  unit: string
  qty_wasted: number
  cost_per_unit?: number | null
  total_cost?: number | null
  notes?: string
  photo_url?: string | null
  location: string
}

export type PrepWasteEntry = {
  id?: string
  created_at?: string
  date: string
  shift: 'Opening' | 'Closing'
  prep_person: string
  time_logged?: string
  ingredient: string
  waste_type: string
  total_purchased_lbs: number
  waste_weight_lbs: number
  yield_pct?: number | null
  cost_per_lb?: number | null
  waste_cost?: number | null
  location: string
}

export type PriceListItem = {
  id?: string
  item_name: string
  unit: string
  cost_per_unit?: number | null
  notes?: string
  last_updated?: string
}
