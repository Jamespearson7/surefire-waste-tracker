-- ============================================================
-- Inventory & Ordering System — Supabase setup
-- Run this in: Supabase → SQL Editor → New query
-- ============================================================

-- 1. Inventory items master list
CREATE TABLE IF NOT EXISTS inventory_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL UNIQUE,
  category         text NOT NULL,
  count_unit       text NOT NULL,   -- what shift lead counts in (each, case, bag, oz, lbs)
  order_unit       text NOT NULL,   -- what you order in (case, box, bag)
  units_per_order_unit numeric,     -- e.g. 24 patties per box
  vendor           text,
  storage_location text,            -- e.g. "Walk-in cooler", "Dry storage"
  active           boolean NOT NULL DEFAULT true,
  sort_order       integer NOT NULL DEFAULT 100,
  created_at       timestamptz DEFAULT now()
);

-- 2. Inventory counts (shift-level snapshots)
CREATE TABLE IF NOT EXISTS inventory_counts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id      uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  count_date   date NOT NULL,
  shift        text NOT NULL CHECK (shift IN ('Opening','Closing')),
  counted_by   text NOT NULL,
  on_hand      numeric NOT NULL,
  created_at   timestamptz DEFAULT now(),
  UNIQUE (item_id, count_date, shift)
);

-- 3. Weekly sales from Toast
CREATE TABLE IF NOT EXISTS weekly_sales (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL,
  week_end   date NOT NULL,
  menu_item  text NOT NULL,
  qty_sold   integer NOT NULL,
  net_sales  numeric,
  source     text DEFAULT 'toast_upload',
  created_at timestamptz DEFAULT now(),
  UNIQUE (week_start, menu_item)
);

-- 4. Event log (special events that affect volume)
CREATE TABLE IF NOT EXISTS event_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date  date NOT NULL,
  event_name  text NOT NULL,
  impact_pct  integer NOT NULL DEFAULT 10,  -- % volume boost expected
  notes       text,
  logged_by   text,
  created_at  timestamptz DEFAULT now()
);

-- ============================================================
-- RLS policies
-- ============================================================

ALTER TABLE inventory_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_counts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_sales      ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_log         ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read inventory_items"   ON inventory_items;
DROP POLICY IF EXISTS "Public write inventory_items"  ON inventory_items;
DROP POLICY IF EXISTS "Public read inventory_counts"  ON inventory_counts;
DROP POLICY IF EXISTS "Public write inventory_counts" ON inventory_counts;
DROP POLICY IF EXISTS "Public read weekly_sales"      ON weekly_sales;
DROP POLICY IF EXISTS "Public write weekly_sales"     ON weekly_sales;
DROP POLICY IF EXISTS "Public read event_log"         ON event_log;
DROP POLICY IF EXISTS "Public write event_log"        ON event_log;

CREATE POLICY "Public read inventory_items"   ON inventory_items   FOR SELECT USING (true);
CREATE POLICY "Public write inventory_items"  ON inventory_items   FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "Public read inventory_counts"  ON inventory_counts  FOR SELECT USING (true);
CREATE POLICY "Public write inventory_counts" ON inventory_counts  FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "Public read weekly_sales"      ON weekly_sales      FOR SELECT USING (true);
CREATE POLICY "Public write weekly_sales"     ON weekly_sales      FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "Public read event_log"         ON event_log         FOR SELECT USING (true);
CREATE POLICY "Public write event_log"        ON event_log         FOR ALL    USING (true) WITH CHECK (true);

-- ============================================================
-- Seed inventory items
-- ============================================================

INSERT INTO inventory_items (name, category, count_unit, order_unit, units_per_order_unit, vendor, storage_location, sort_order) VALUES
-- Proteins
('Beef Patty',             'Proteins',        'each',  'box',   24,   'Ben E. Keith',         'Walk-in cooler',  10),
('Chicken Breast',         'Proteins',        'lbs',   'case',  40,   'US Foods',             'Walk-in cooler',  20),
('Chicken Tenders',        'Proteins',        'lbs',   'case',  40,   'US Foods',             'Walk-in cooler',  30),
('Falafel Patty',          'Proteins',        'each',  'case',  48,   'US Foods',             'Walk-in freezer', 40),
('Bacon',                  'Proteins',        'lbs',   'box',   15,   'Chef Store',           'Walk-in cooler',  50),

-- Bread & Buns
('Burger Bun (Martin''s)', 'Bread & Buns',    'each',  'case',  48,   'Martin''s Potato Buns','Dry storage',     60),
('Chicken Bun (Martin''s)','Bread & Buns',    'each',  'case',  48,   'Martin''s Potato Buns','Dry storage',     70),

-- Frozen
('Fries',                  'Frozen',          'lbs',   'case',  30,   'US Foods',             'Walk-in freezer', 80),

-- Produce
('Cauliflower',            'Produce',         'heads', 'case',  12,   'Ben E. Keith',         'Walk-in cooler',  90),
('Lettuce',                'Produce',         'bags',  'case',  NULL, 'Ben E. Keith',         'Walk-in cooler',  100),
('Tomatoes',               'Produce',         'lbs',   'box',   25,   'Ben E. Keith',         'Walk-in cooler',  110),
('Yellow Onion',           'Produce',         'lbs',   'bag',   50,   'US Foods',             'Dry storage',     120),
('Cucumber (for pickles)', 'Produce',         'boxes', 'box',   1,    'Ben E. Keith',         'Walk-in cooler',  130),
('Coleslaw Mix (Cabbage)', 'Produce',         'bags',  'case',  NULL, 'Ben E. Keith',         'Walk-in cooler',  140),

-- Dairy & Cheese
('American Cheese Slice',  'Dairy & Cheese',  'slices','case',  160,  'Sam''s Club',          'Walk-in cooler',  150),
('Vegan Cheese Slice',     'Dairy & Cheese',  'slices','pack',  10,   'Walmart',              'Walk-in cooler',  160),
('Soft Serve Mix',         'Dairy & Cheese',  'bags',  'case',  NULL, 'US Foods',             'Walk-in cooler',  170),
('Milk',                   'Dairy & Cheese',  'gallons','case', NULL, 'US Foods',             'Walk-in cooler',  180),

-- Sauces & Condiments
('Mayonnaise',             'Sauces & Condiments', 'jugs', 'case', NULL, 'US Foods',           'Dry storage',     190),
('Vegan Mayo',             'Sauces & Condiments', 'jugs', 'jug',  1,   'Webstaurantstore',    'Dry storage',     200),
('Mambo Sauce',            'Sauces & Condiments', 'bottles','case',NULL,'US Foods',            'Dry storage',     210),
('Honey Dip / Honey Butta','Sauces & Condiments', 'bottles','case',NULL,'US Foods',            'Dry storage',     220)
ON CONFLICT (name) DO NOTHING;
