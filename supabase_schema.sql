-- Surefire Market Waste Tracker — Supabase Schema
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/dniwcnzvryhymyzkpaju/sql

-- ============================================================
-- PRICE LIST
-- ============================================================
create table if not exists price_list (
  id uuid primary key default gen_random_uuid(),
  item_name text not null unique,
  unit text not null,
  cost_per_unit numeric,  -- null = TBD
  notes text,
  last_updated date default current_date
);

-- ============================================================
-- SHIFT WASTE ENTRIES
-- ============================================================
create table if not exists shift_waste_entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  date date not null,
  shift text not null check (shift in ('Opening', 'Closing')),
  shift_lead text not null,
  time_logged time,
  item text not null,
  loss_reason text not null,
  unit text not null,
  qty_wasted numeric not null,
  cost_per_unit numeric,
  total_cost numeric generated always as (
    case when cost_per_unit is not null then qty_wasted * cost_per_unit else null end
  ) stored,
  notes text,
  location text not null default 'Camp North End'
);

-- ============================================================
-- PREP WASTE ENTRIES
-- ============================================================
create table if not exists prep_waste_entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  date date not null,
  shift text not null check (shift in ('Opening', 'Closing')),
  prep_person text not null,
  time_logged time,
  ingredient text not null,
  waste_type text not null,
  total_purchased_lbs numeric not null,
  waste_weight_lbs numeric not null,
  yield_pct numeric generated always as (
    case when total_purchased_lbs > 0
      then round(((total_purchased_lbs - waste_weight_lbs) / total_purchased_lbs * 100)::numeric, 1)
      else null end
  ) stored,
  cost_per_lb numeric,
  waste_cost numeric generated always as (
    case when cost_per_lb is not null then waste_weight_lbs * cost_per_lb else null end
  ) stored,
  location text not null default 'Camp North End'
);

-- ============================================================
-- ROW LEVEL SECURITY (open for now — anon key can read/write)
-- ============================================================
alter table price_list enable row level security;
alter table shift_waste_entries enable row level security;
alter table prep_waste_entries enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'public read write price_list' and tablename = 'price_list') then
    create policy "public read write price_list" on price_list for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'public read write shift_waste' and tablename = 'shift_waste_entries') then
    create policy "public read write shift_waste" on shift_waste_entries for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'public read write prep_waste' and tablename = 'prep_waste_entries') then
    create policy "public read write prep_waste" on prep_waste_entries for all using (true) with check (true);
  end if;
end $$;

-- ============================================================
-- SEED PRICE LIST
-- ============================================================
insert into price_list (item_name, unit, cost_per_unit, notes, last_updated) values
  ('Fries', 'per lb', 1.53, 'Colossal Crisp $45.94/cs, 6x5lb bags', '2026-04-01'),
  ('Cauliflower Bites', 'per lb', null, '$29.95/case, case weight unknown — update when known', '2026-04-01'),
  ('Coleslaw Mix (Cabbage)', 'per lb', 1.24, 'Taylor Farms 2lb bag $2.47', '2026-04-01'),
  ('Chicken Breast', 'per lb', 3.56, 'Patuxent Farms $71.11/cs, 4x5lb', '2026-04-01'),
  ('Chicken Tenders', 'per lb', 1.93, 'Patuxent Farms $77.32/cs, 4x10lb', '2026-04-01'),
  ('Lettuce', 'per lb', 2.70, '$26.95/case, 2x5lb bags', '2026-04-01'),
  ('Tomatoes', 'per lb', 2.16, '$53.95/25lb case', '2026-04-01'),
  ('Yellow Onion', 'per lb', 0.32, 'Cross Valley $15.86/50lb bag', '2026-04-01'),
  ('Bacon', 'per lb', 4.64, 'Patuxent Farms $69.61/15lb cs', '2026-04-01'),
  ('Cucumber (for pickles)', 'per lb', 1.40, '$55.95/40lb case', '2026-04-01'),
  ('Burger Bun (Martin''s)', 'per bun', 0.34, 'Martin''s potato roll', '2026-04-01'),
  ('Chicken Bun (Martin''s)', 'per bun', 0.34, 'Martin''s sandwich bun', '2026-04-01'),
  ('Beef Patty', 'per patty', 0.85, 'Winn Meat $40.92/48ct, 2.6oz each', '2026-04-01'),
  ('Falafel Patty', 'per patty', 0.05, 'Chickpea cost only — 3 cups dry → 24 patties', '2026-04-01'),
  ('American Cheese Slice', 'per slice', 0.07, 'Member''s Mark $10.94/160 slices', '2026-04-01'),
  ('Vegan Cheese Slice', 'per slice', 0.48, 'Follow Your Heart $4.77/10 slices', '2026-04-01'),
  ('Onion Ring', 'per oz', null, 'House made — needs costing', '2026-04-01'),
  ('Mayonnaise', 'per oz', 0.09, 'Harvest Value $40.85/cs, 4x1gal', '2026-04-01'),
  ('Vegan Mayo', 'per oz', 0.22, 'Hellmann''s Vegan $112.99/4gal case', '2026-04-01'),
  ('Mambo Sauce', 'per oz', 0.24, 'Capital City $123.99/4x128oz', '2026-04-01'),
  ('Sweet Heat Pickles', 'per oz', 0.19, 'Mt. Olive $4.49/24oz jar', '2026-04-01'),
  ('Dill Pickles (house)', 'per 4-slice portion', null, 'House made — cucumber $1.40/lb + brine, needs yield count', '2026-04-01'),
  ('Smack Sauce (house)', 'per oz', null, 'Mayo/ketchup/mustard base, ~400 portions/batch', '2026-04-01'),
  ('Surefire Sauce (house)', 'per oz', null, 'Mayo/spicy mayo/sour cream base, ~400 portions/batch', '2026-04-01'),
  ('Honey Dip / Honey Butta', 'per oz portion', null, 'Maple syrup $0.37/oz, butter $2.53/lb — needs yield count', '2026-04-01'),
  ('Soft Serve Mix', 'per oz', 0.072, 'Glenview Farms $46.20/2x2.5gal; 12oz per shake', '2026-04-01'),
  ('Milk', 'per oz', 0.03, 'Glenview Farms $17.74/4gal; 2oz per shake', '2026-04-01'),
  ('Chocolate Syrup', 'per oz', 0.13, 'Hershey $92.61/cs 6x7.5lb; 1.5oz per shake', '2026-04-01'),
  ('Strawberry Topping', 'per oz', 0.16, 'Monarch $55.00/cs 3x118oz; 2oz per shake', '2026-04-01'),
  ('Oreo Crumble', 'per oz', 0.275, 'Oreo $110.00/25lb cs; ~1.4oz per shake', '2026-04-01'),
  ('Whipped Cream', 'per oz', 0.18, 'Glenview Farms $33.73/cs 12x15oz', '2026-04-01'),
  ('All-Purpose Flour', 'per cup', null, 'Seasoned flour ingredient — needs cost', '2026-04-01'),
  ('Potato Starch', 'per cup', null, 'Seasoned flour ingredient — needs cost', '2026-04-01'),
  ('Garlic Powder', 'per cup', null, 'Seasoned flour ingredient — needs cost', '2026-04-01'),
  ('Onion Powder', 'per cup', null, 'Seasoned flour ingredient — needs cost', '2026-04-01'),
  ('Pelle Pelle Seasoning', 'per cup', null, 'Seasoned flour ingredient — needs cost', '2026-04-01'),
  ('Mustard Powder', 'per cup', null, 'Seasoned flour ingredient — needs cost', '2026-04-01'),
  ('Accent Seasoning', 'per cup', null, 'Seasoned flour ingredient — needs cost', '2026-04-01'),
  ('Baking Powder', 'per cup', null, 'Seasoned flour ingredient — needs cost', '2026-04-01')
on conflict (item_name) do nothing;
