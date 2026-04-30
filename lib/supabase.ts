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
  default_batch_lbs?: number | null
  notes?: string
  last_updated?: string
}

export type InventoryListType = 'Food' | 'Supplies' | 'FOH' | 'Walk-in Cooler'

export type InventoryItem = {
  id: string
  name: string
  category: string
  list_type: InventoryListType
  count_unit: string
  order_unit: string
  units_per_order_unit?: number | null
  vendor?: string | null
  storage_location?: string | null
  par_level?: number | null
  reorder_level?: number | null
  active: boolean
  sort_order: number
}

export type InventoryCount = {
  id?: string
  item_id: string
  count_date: string
  shift: 'Opening' | 'Closing'
  counted_by: string
  on_hand: number
  created_at?: string
}

export type WeeklySales = {
  id?: string
  week_start: string
  week_end: string
  menu_item: string
  qty_sold: number
  net_sales?: number | null
  source?: string | null   // 'toast_upload' | 'manual'
  created_at?: string
}

export type EventLog = {
  id?: string
  event_date: string
  event_name: string
  impact_pct: number      // e.g. 20 = +20% volume expected
  notes?: string | null
  logged_by?: string | null
  created_at?: string
}

export type SFContact = {
  id: string
  created_at?: string
  name: string
  phone: string
  title: string | null
  carrier: string | null
  sms_email: string | null   // e.g. 7045551234@txt.att.net
  active: boolean
  restock_alerts: boolean
}

export type SFEvent = {
  id: string
  created_at?: string
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
