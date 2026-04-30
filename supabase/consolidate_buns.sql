-- ============================================================
-- Consolidate Chicken Bun into the single Martin's Potato Bun SKU
-- Per James: same bun used for burgers & chicken, same price.
-- Run this in: Supabase → SQL Editor → New query
-- ============================================================

-- 1. Rename the primary bun to a clean name
UPDATE inventory_items
SET name = 'Martin''s Potato Bun'
WHERE name = 'Burger Bun (Martin''s)';

-- 2. Reassign any counts that were logged against the Chicken Bun
--    to the consolidated Martin's Potato Bun, then delete the chicken bun row.
DO $$
DECLARE
  keep_id uuid;
  drop_id uuid;
BEGIN
  SELECT id INTO keep_id FROM inventory_items WHERE name = 'Martin''s Potato Bun' LIMIT 1;
  SELECT id INTO drop_id FROM inventory_items WHERE name = 'Chicken Bun (Martin''s)' LIMIT 1;

  IF drop_id IS NOT NULL AND keep_id IS NOT NULL THEN
    -- Move any historical counts over (UPSERT to avoid unique key clash on same date/shift)
    INSERT INTO inventory_counts (item_id, count_date, shift, counted_by, on_hand)
    SELECT keep_id, count_date, shift, counted_by, on_hand
    FROM inventory_counts
    WHERE item_id = drop_id
    ON CONFLICT (item_id, count_date, shift) DO UPDATE
      SET on_hand = inventory_counts.on_hand + EXCLUDED.on_hand;

    DELETE FROM inventory_counts WHERE item_id = drop_id;
    DELETE FROM inventory_items  WHERE id = drop_id;
  END IF;
END $$;
