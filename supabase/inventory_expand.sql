-- ============================================================
-- Expand Inventory — add Food/Supplies/FOH/Walk-in lists
-- Seeds items from Surefire CNE Food_Product inventory.xlsx
-- Run this in Supabase → SQL Editor → New query
-- Safe to run multiple times (ON CONFLICT DO NOTHING).
-- ============================================================

-- 1. Add new columns
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS list_type text NOT NULL DEFAULT 'Food';
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS par_level text;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS reorder_level text;

-- 2. Swap unique constraint from (name) → (list_type, name) so Supplies/FOH can share names
ALTER TABLE inventory_items DROP CONSTRAINT IF EXISTS inventory_items_name_key;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_items_list_name_unique'
  ) THEN
    ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_list_name_unique UNIQUE (list_type, name);
  END IF;
END$$;

-- 3. Tag existing seeded items as Food
UPDATE inventory_items SET list_type = 'Food' WHERE list_type IS NULL OR list_type = '';

-- 4. Rename categories to match the spreadsheet for consistency
UPDATE inventory_items SET category = 'Condiments, Sauces & Bases' WHERE category = 'Sauces & Condiments';
UPDATE inventory_items SET category = 'Produce & Fresh Items'      WHERE category = 'Produce';

-- ============================================================
-- FOOD INVENTORY — additions
-- ============================================================

INSERT INTO inventory_items (list_type, name, category, count_unit, order_unit, vendor, storage_location, sort_order, par_level, reorder_level) VALUES
-- Proteins (most exist; make sure nothing is missing)
('Food', 'Burger Cases',             'Proteins',                    'cases',      'case',   'Ben E. Keith',     'Walk-in cooler', 5,   '40/week (20 Mon/Tue + 20 Thu)', '8 cases'),
('Food', 'Chicken Breast 6oz',       'Proteins',                    'buckets',    'case',   'US Foods',         'Walk-in cooler', 15,  '4 cases per 200 sold',          '1 bucket'),
('Food', 'Chicken Tenders Jumbo',    'Proteins',                    'containers', 'case',   'US Foods',         'Walk-in cooler', 25,  '2 cases',                        '0 buckets'),

-- Frozen
('Food', 'Udi''s Gluten Free Buns',  'Frozen',                      'boxes',      'box',    'US Foods',         'Walk-in freezer', 81, '1 box',                          '7 buns left'),
('Food', 'Lamb Wesson Fries',        'Frozen',                      'cases',      'case',   'US Foods',         'Walk-in freezer', 82, '16 cases',                       'expo full, <1/2 freezer'),

-- Dry Seasonings & Spices
('Food', 'Flour 25lb Bag',                     'Dry Seasonings & Spices', 'bags',       'bag',       'US Foods',     'Dry storage', 200, '3 bags',        'no bags / bucket low'),
('Food', 'Mustard Seeds 23oz',                 'Dry Seasonings & Spices', 'containers', 'container', 'US Foods',     'Dry storage', 201, '1 container',   '0'),
('Food', 'Spanish Paprika 5LB',                'Dry Seasonings & Spices', 'containers', 'container', 'US Foods',     'Dry storage', 202, '2 containers', '1/2 container'),
('Food', 'Louisiana Cajun Seasoning 8oz',      'Dry Seasonings & Spices', 'containers', 'container', 'US Foods',     'Dry storage', 203, '1 container',  '0'),
('Food', 'Black Pepper 5LB',                   'Dry Seasonings & Spices', 'containers', 'container', 'US Foods',     'Dry storage', 204, '1 container',  '1/2 container'),
('Food', 'Garlic Powder 5LB',                  'Dry Seasonings & Spices', 'containers', 'container', 'US Foods',     'Dry storage', 205, '1 container',  '1/2 container'),
('Food', 'Onion Powder 5LB',                   'Dry Seasonings & Spices', 'containers', 'container', 'US Foods',     'Dry storage', 206, '1 container',  '1/2 container'),
('Food', 'Salt 25LB',                          'Dry Seasonings & Spices', 'bags',       'bag',       'US Foods',     'Dry storage', 207, '1 bag',         NULL),
('Food', 'Pelle Pelle Seasoning 22L',          'Dry Seasonings & Spices', 'containers', 'container', 'US Foods',     'Dry storage', 208, '1 container',  '0'),
('Food', 'Mustard Powder 15oz',                'Dry Seasonings & Spices', 'containers', 'container', 'US Foods',     'Dry storage', 209, '1 container',  '0'),
('Food', 'Accent Seasoning 10LB',              'Dry Seasonings & Spices', 'containers', 'container', 'US Foods',     'Dry storage', 210, '1 container',  '0'),
('Food', 'Old Bay Seasoning',                  'Dry Seasonings & Spices', 'containers', 'container', 'US Foods',     'Dry storage', 211, '1 container',  '0'),
('Food', 'Cuban Island Seasoning 5LB',         'Dry Seasonings & Spices', 'bags',       'bag',       'Savory Spice', 'Dry storage', 212, '1 bag',         '0'),
('Food', 'Italian Seasoning 5LB',              'Dry Seasonings & Spices', 'containers', 'container', 'US Foods',     'Dry storage', 213, '1 container',  '0'),
('Food', 'Brown Sugar 25LB',                   'Dry Seasonings & Spices', 'bags',       'bag',       'US Foods',     'Dry storage', 214, '1 bag',         '0'),
('Food', 'Cumin Seasoning 5LB',                'Dry Seasonings & Spices', 'containers', 'container', 'US Foods',     'Dry storage', 215, '1 container',  '0'),
('Food', 'Sugar 25LB',                         'Dry Seasonings & Spices', 'bags',       'bag',       'US Foods',     'Dry storage', 216, '1 bag',         '0'),
('Food', 'Potato Starch 50LB',                 'Dry Seasonings & Spices', 'bags',       'bag',       'Webstaurantstore', 'Dry storage', 217, '1 bag',      '0'),
('Food', 'Cayenne Pepper 5LB',                 'Dry Seasonings & Spices', 'containers', 'container', 'US Foods',     'Dry storage', 218, '1 container',  '0'),
('Food', 'Ground Coriander 5LB',               'Dry Seasonings & Spices', 'containers', 'container', 'US Foods',     'Dry storage', 219, '1 container',  '0'),
('Food', 'Black Pepper Whole Seeds 18oz',      'Dry Seasonings & Spices', 'containers', 'container', 'US Foods',     'Dry storage', 220, '1 container',  '0'),
('Food', 'Ranch Seasoning 16oz',               'Dry Seasonings & Spices', 'containers', 'container', 'Sam''s Club',  'Dry storage', 221, '2 containers', '0'),
('Food', 'Baking Soda 16oz',                   'Dry Seasonings & Spices', 'boxes',      'box',       'US Foods',     'Dry storage', 222, '1 box',         '0'),
('Food', 'Baking Powder 10LB',                 'Dry Seasonings & Spices', 'containers', 'container', 'US Foods',     'Dry storage', 223, '1 container',  '0'),

-- Condiments, Sauces & Bases
('Food', 'Maple Syrup 32oz',                   'Condiments, Sauces & Bases', 'jugs',    'bottle', 'Sam''s Club',      'Dry storage',   300, '14 bottles',  '8'),
('Food', 'Hellmann''s Spicy Mayo 1 Gallon',    'Condiments, Sauces & Bases', 'jugs',    'bottle', 'Webstaurantstore', 'Dry storage',   301, '2 bottles',   '1 jug'),
('Food', 'Mustard 105oz',                      'Condiments, Sauces & Bases', 'jugs',    'bottle', 'US Foods',         'Dry storage',   302, '2 bottles',   '1 jug'),
('Food', 'Ketchup 105oz',                      'Condiments, Sauces & Bases', 'jugs',    'bottle', 'US Foods',         'Dry storage',   303, '2 jugs',      '1 jug'),
('Food', 'Vinegar',                            'Condiments, Sauces & Bases', 'jugs',    'case',   'US Foods',         'Dry storage',   304, '1 case',      '1 jug'),
('Food', 'Sour Cream',                         'Condiments, Sauces & Bases', 'containers','container','Sam''s Club',  'Walk-in cooler',305, '2 containers','1/2 container'),
('Food', 'Buttermilk',                         'Condiments, Sauces & Bases', 'jugs',    'case',   'US Foods',         'Walk-in cooler',306, '1 case',      '1/2 jug'),
('Food', 'Mambo Sauce 1 Gallon',               'Condiments, Sauces & Bases', 'bottles', 'bottle', 'Amazon',           'Dry storage',   307, '2 bottles',   '3 jugs'),
('Food', 'Worcestershire Sauce 1 Gallon',      'Condiments, Sauces & Bases', 'jugs',    'jug',    'US Foods',         'Dry storage',   308, '1 jug',       '<1/2 jug'),
('Food', 'Extra Heavy Mayo Harvest Value 1gal','Condiments, Sauces & Bases', 'jugs',    'case',   'US Foods',         'Dry storage',   309, '2 cases',     '2 bottles'),
('Food', 'Chicken Broth',                      'Condiments, Sauces & Bases', 'cases',   'case',   'Sam''s Club',      'Dry storage',   310, '4 cases',     '2 cases'),

-- Produce additions
('Food', 'Sweet Heat Pickles',                 'Produce & Fresh Items', 'jars',    'jar',    'Food Lion',         'Walk-in cooler', 400, '10 jars',  '0'),
('Food', 'Cilantro Bunch',                     'Produce & Fresh Items', 'bunches', 'bunch',  'Martin''s Produce', 'Walk-in cooler', 401, '1 bunch',  '0'),
('Food', 'Parsley Bunch',                      'Produce & Fresh Items', 'bunches', 'bunch',  'Martin''s Produce', 'Walk-in cooler', 402, '1 bunch',  '0'),
('Food', 'Garlic Cloves',                      'Produce & Fresh Items', 'jars',    'jar',    'Martin''s Produce', 'Walk-in cooler', 403, '1 jar',    '0'),
('Food', 'Fresh Dill 1LB',                     'Produce & Fresh Items', 'bags',    'bag',    'Martin''s Produce', 'Walk-in cooler', 404, '1 bag',    '0'),
('Food', 'Minced Garlic',                      'Produce & Fresh Items', 'jars',    'jar',    'US Foods',          'Walk-in cooler', 405, NULL,       NULL),
('Food', 'Lemon Juice 48oz',                   'Produce & Fresh Items', 'bottles', 'bottle', 'US Foods',          'Dry storage',    406, '1 bottle', '0'),
('Food', 'Lime Juice 1 Gallon',                'Produce & Fresh Items', 'bottles', 'bottle', 'US Foods',          'Dry storage',    407, '1 bottle', '0'),
('Food', 'Butter (Sticks)',                    'Dairy & Cheese',        'sticks',  'case',   'US Foods',          'Walk-in cooler', 155, '2 cases',  '<10 sticks')
ON CONFLICT (list_type, name) DO NOTHING;

-- ============================================================
-- SUPPLIES INVENTORY
-- ============================================================

INSERT INTO inventory_items (list_type, name, category, count_unit, order_unit, vendor, storage_location, sort_order, par_level, reorder_level) VALUES
-- Packaging & Branding
('Supplies', '1.5oz Lids',                         'Packaging & Branding', 'cases', 'case', 'Webstaurantstore', 'Bodega',   10, '1',  '0'),
('Supplies', '2oz Cups',                            'Packaging & Branding', 'cases', 'case', 'Webstaurantstore', 'Bodega',   20, '1',  '0'),
('Supplies', 'Sandwich Bag (Grease Resistant)',     'Packaging & Branding', 'boxes', 'box',  'US Foods',         'In-Store', 30, '1',  '0'),
('Supplies', 'Wax Paper',                           'Packaging & Branding', 'cases', 'case', 'US Foods',         'Bodega',   40, '1',  '0'),
('Supplies', 'Fry Bags',                            'Packaging & Branding', 'cases', 'case', 'Webstaurantstore', 'In-Store', 50, '2 cases', '1'),
('Supplies', 'White Side Trays',                    'Packaging & Branding', 'cases', 'case', 'US Foods',         'In-Store', 60, NULL, '0'),
('Supplies', 'Side Cup Lids (6oz)',                 'Packaging & Branding', 'cases', 'case', 'Webstaurantstore', 'In-Store', 70, NULL, NULL),
('Supplies', 'Side Cups (6oz)',                     'Packaging & Branding', 'cases', 'case', 'Webstaurantstore', 'In-Store', 80, NULL, NULL),
('Supplies', 'Surefire Paper',                      'Packaging & Branding', 'cases', 'case', 'No Issue',         'Bodega',   90, NULL, NULL),
('Supplies', 'Sandwich Bags',                       'Packaging & Branding', 'boxes', 'box',  'Walmart',          'In-Store', 100,'1 box', '0'),
('Supplies', 'Monogram Sandwich Wrap (Aluminum)',   'Packaging & Branding', 'cases', 'case', 'US Foods',         'In-Store', 110,'1 case','0'),
('Supplies', 'Surefire Sticker',                    'Packaging & Branding', 'rolls', 'roll', 'No Issue',         'In-Store', 120, NULL, '2'),
('Supplies', 'Smack Sauce Sticker',                 'Packaging & Branding', 'rolls', 'roll', 'No Issue',         'In-Store', 130, NULL, '2'),
('Supplies', 'Ranch Sticker',                       'Packaging & Branding', 'rolls', 'roll', 'No Issue',         'In-Store', 140, NULL, '2'),
('Supplies', 'Mambo Sauce Sticker',                 'Packaging & Branding', 'rolls', 'roll', 'No Issue',         'In-Store', 150, NULL, '2'),
('Supplies', 'Use First Sticker',                   'Packaging & Branding', 'rolls', 'roll', 'Amazon',           'In-Store', 160, NULL, '0'),
('Supplies', 'Food Labels Sticker',                 'Packaging & Branding', 'rolls', 'roll', 'Amazon',           'In-Store', 170, NULL, '1'),

-- Cleaning Supplies & Tools
('Supplies', 'Grill Cleaner Packs',                 'Cleaning Supplies & Tools', 'packs',   'case', 'Ben E. Keith',     'In-Store', 200, NULL, '7 packs'),
('Supplies', 'Grill Brick',                         'Cleaning Supplies & Tools', 'each',    'case', 'US Foods',         'In-Store', 210, NULL, '0'),
('Supplies', 'Dish Soap',                           'Cleaning Supplies & Tools', 'bottles', 'case', NULL,               'In-Store', 220, NULL, '1'),
('Supplies', 'Sanitizer',                           'Cleaning Supplies & Tools', 'bottles', 'case', 'US Foods',         'In-Store', 230, NULL, '0'),
('Supplies', 'Bleach',                              'Cleaning Supplies & Tools', 'bottles', 'case', NULL,               'In-Store', 240, NULL, '0'),
('Supplies', 'Fry Filter Powder',                   'Cleaning Supplies & Tools', 'boxes',   'box',  'Amazon',           'In-Store', 250, NULL, NULL),
('Supplies', 'Filter Paper',                        'Cleaning Supplies & Tools', 'boxes',   'box',  'RTI',              'In-Store', 260, '1', NULL),
('Supplies', 'Multi-Surface Degreaser',             'Cleaning Supplies & Tools', 'bottles', 'case', 'US Foods',         'In-Store', 270, NULL, NULL),
('Supplies', 'Blue Tape',                           'Cleaning Supplies & Tools', 'rolls',   'roll', NULL,               'In-Store', 280, NULL, NULL),
('Supplies', 'Black Trash Bags',                    'Cleaning Supplies & Tools', 'boxes',   'box',  'Sam''s Club',      'In-Store', 290, NULL, NULL),

-- Beverage & Service Supplies
('Supplies', 'Tea Bags (Pickles)',                  'Beverage & Service Supplies', 'boxes', 'box', 'Amazon',   'In-Store', 300, NULL, NULL),
('Supplies', 'Ice Bags',                            'Beverage & Service Supplies', 'packs', 'pack', NULL,      'In-Store', 310, NULL, NULL),
('Supplies', 'Teflon Paper (Bun Toaster)',          'Beverage & Service Supplies', 'rolls', 'roll', 'Amazon',  'In-Store', 320, NULL, NULL),

-- Safety & Apparel
('Supplies', 'Hair Nets',                           'Safety & Apparel', 'boxes', 'box', 'US Foods',     'In-Store', 400, NULL, NULL),
('Supplies', 'Beard Nets',                          'Safety & Apparel', 'boxes', 'box', 'US Foods',     'In-Store', 410, NULL, NULL),
('Supplies', 'Medium Gloves',                       'Safety & Apparel', 'boxes', 'box', 'US Foods',     'In-Store', 420, NULL, NULL),
('Supplies', 'Extra Large Gloves',                  'Safety & Apparel', 'boxes', 'box', 'US Foods',     'In-Store', 430, NULL, NULL),
('Supplies', 'Small Blue Gloves',                   'Safety & Apparel', 'boxes', 'box', 'US Foods',     'In-Store', 440, NULL, NULL),
('Supplies', 'First Aid Kit',                       'Safety & Apparel', 'each',  'each','Sam''s Club',  'In-Store', 450, NULL, NULL),

-- Equipment & Maintenance
('Supplies', 'Heat Lamp Bulb',                      'Equipment & Maintenance', 'each', 'each', 'Lowe''s', 'Bodega', 500, NULL, NULL),
('Supplies', 'Light Bulbs',                         'Equipment & Maintenance', 'each', 'pack', 'Lowe''s', 'Bodega', 510, NULL, NULL),

-- Office/Utility
('Supplies', 'Sharpies',                            'Office/Utility', 'each', 'pack', 'Amazon', 'In-Store', 600, NULL, NULL),
('Supplies', 'Expo Markers',                        'Office/Utility', 'each', 'pack', 'Amazon', 'In-Store', 610, NULL, NULL)
ON CONFLICT (list_type, name) DO NOTHING;

-- ============================================================
-- FOH INVENTORY
-- ============================================================

INSERT INTO inventory_items (list_type, name, category, count_unit, order_unit, vendor, storage_location, sort_order, par_level, reorder_level) VALUES
-- Packaging & Branding
('FOH', 'Brown Bags',                     'Packaging & Branding', 'cases', 'case', 'Webstaurantstore', 'Bodega',   10, '1', '0'),
('FOH', 'Napkins',                        'Packaging & Branding', 'cases', 'case', NULL,               'Bodega',   20, NULL, NULL),
('FOH', 'Drink Straws',                   'Packaging & Branding', 'cases', 'case', 'Webstaurantstore', 'Bodega',   30, '1', '0'),
('FOH', 'Milkshake Straws',               'Packaging & Branding', 'cases', 'case', 'US Foods',         'In-Store', 40, '1', '0'),
('FOH', 'Pepsi Cups',                     'Packaging & Branding', 'sleeves','case','US Foods',         'Bodega',   50, '1', '0'),
('FOH', 'Pepsi Lids',                     'Packaging & Branding', 'sleeves','case',NULL,               'Bodega',   60, NULL, NULL),
('FOH', 'Milkshake Cups',                 'Packaging & Branding', 'cases', 'case', 'Webstaurantstore', 'In-Store', 70, '2 cases','1'),
('FOH', 'Milkshake Lids',                 'Packaging & Branding', 'cases', 'case', 'US Foods',         'In-Store', 80, NULL, '0'),
('FOH', 'Shake Stickers',                 'Packaging & Branding', 'rolls', 'roll', 'Webstaurantstore', 'In-Store', 90, NULL, NULL),
('FOH', 'Surefire Stickers',              'Packaging & Branding', 'rolls', 'roll', 'Webstaurantstore', 'In-Store', 100,NULL, NULL),
('FOH', 'Surefire Paper',                 'Packaging & Branding', 'cases', 'case', 'No Issue',         'Bodega',   110,NULL, NULL),
('FOH', 'Sandwich Bags',                  'Packaging & Branding', 'boxes', 'box',  'Walmart',          'In-Store', 120,'1 box','0'),
('FOH', 'Monogram Sandwich Wrap (Aluminum)','Packaging & Branding','cases','case', 'US Foods',         'In-Store', 130,'1 case','0'),
('FOH', 'Use First Sticker',              'Packaging & Branding', 'rolls', 'roll', 'Amazon',           'In-Store', 140,NULL, '0'),
('FOH', 'Food Labels Sticker',            'Packaging & Branding', 'rolls', 'roll', 'Amazon',           'In-Store', 150,NULL, '1'),

-- Cleaning Supplies & Tools
('FOH', 'Orange Towels',                  'Cleaning Supplies & Tools', 'packs',   'case', NULL,               'In-Store', 200,NULL, NULL),
('FOH', 'Bathroom Cleaner',               'Cleaning Supplies & Tools', 'bottles', 'case', 'Ben E. Keith',     'In-Store', 210,NULL, '7 packs'),
('FOH', 'Febreze',                        'Cleaning Supplies & Tools', 'bottles', 'case', 'US Foods',         'In-Store', 220,NULL, '0'),
('FOH', 'Glass Cleaner',                  'Cleaning Supplies & Tools', 'bottles', 'case', NULL,               'In-Store', 230,NULL, '1'),
('FOH', 'Milkshake Sanitizer',            'Cleaning Supplies & Tools', 'packs',   'case', 'US Foods',         'In-Store', 240,NULL, '0'),
('FOH', 'Taylor Lube (Milkshake)',        'Cleaning Supplies & Tools', 'tubes',   'each', NULL,               'In-Store', 250,NULL, '0'),
('FOH', 'Drain Cleaner Sticks',           'Cleaning Supplies & Tools', 'boxes',   'box',  'Amazon',           'In-Store', 260,NULL, NULL),
('FOH', 'Filter Paper',                   'Cleaning Supplies & Tools', 'boxes',   'box',  'RTI',              'In-Store', 270,'1', NULL),
('FOH', 'Multi-Surface Degreaser',        'Cleaning Supplies & Tools', 'bottles', 'case', 'US Foods',         'In-Store', 280,NULL, NULL),
('FOH', 'Blue Tape',                      'Cleaning Supplies & Tools', 'rolls',   'roll', NULL,               'In-Store', 290,NULL, NULL),
('FOH', 'Black Trash Bags',               'Cleaning Supplies & Tools', 'boxes',   'box',  'Sam''s Club',      'In-Store', 300,NULL, NULL),

-- Beverage & Service Supplies
('FOH', 'Tea Bags (Pickles)',             'Beverage & Service Supplies', 'boxes', 'box', 'Amazon',  'In-Store', 400, NULL, NULL),
('FOH', 'Ice Bags',                       'Beverage & Service Supplies', 'packs', 'pack', NULL,     'In-Store', 410, NULL, NULL),
('FOH', 'Teflon Paper (Bun Toaster)',     'Beverage & Service Supplies', 'rolls', 'roll', 'Amazon', 'In-Store', 420, NULL, NULL),

-- Safety & Apparel
('FOH', 'Hair Nets',                      'Safety & Apparel', 'boxes', 'box', 'US Foods',    'In-Store', 500, NULL, NULL),
('FOH', 'Beard Nets',                     'Safety & Apparel', 'boxes', 'box', 'US Foods',    'In-Store', 510, NULL, NULL),
('FOH', 'Medium Gloves',                  'Safety & Apparel', 'boxes', 'box', 'US Foods',    'In-Store', 520, NULL, NULL),
('FOH', 'Extra Large Gloves',             'Safety & Apparel', 'boxes', 'box', 'US Foods',    'In-Store', 530, NULL, NULL),
('FOH', 'Small Blue Gloves',              'Safety & Apparel', 'boxes', 'box', 'US Foods',    'In-Store', 540, NULL, NULL),
('FOH', 'First Aid Kit',                  'Safety & Apparel', 'each',  'each','Sam''s Club', 'In-Store', 550, NULL, NULL),

-- Equipment & Maintenance
('FOH', 'Heat Lamp Bulb',                 'Equipment & Maintenance', 'each', 'each', 'Lowe''s', 'Bodega', 600, NULL, NULL),
('FOH', 'Light Bulbs',                    'Equipment & Maintenance', 'each', 'pack', 'Lowe''s', 'Bodega', 610, NULL, NULL),

-- Office/Utility
('FOH', 'Sharpies',                       'Office/Utility', 'each', 'pack', 'Amazon', 'In-Store', 700, NULL, NULL),
('FOH', 'Expo Markers',                   'Office/Utility', 'each', 'pack', 'Amazon', 'In-Store', 710, NULL, NULL)
ON CONFLICT (list_type, name) DO NOTHING;

-- ============================================================
-- WALK-IN COOLER — dedicated quick-check list
-- (Same items exist in Food, these are their cooler counterparts)
-- ============================================================

INSERT INTO inventory_items (list_type, name, category, count_unit, order_unit, vendor, storage_location, sort_order, par_level, reorder_level) VALUES
('Walk-in', 'Burger Balls',              'Proteins',                'each',       'case', 'Ben E. Keith',      'Walk-in cooler',   10, '30',  '4'),
('Walk-in', 'Chicken Breast',            'Proteins',                'buckets',    'case', 'US Foods',          'Walk-in cooler',   20, NULL,  '0'),
('Walk-in', 'Bacon',                     'Proteins',                'lbs',        'box',  'US Foods',          'Walk-in cooler',   30, NULL,  '0'),
('Walk-in', 'Chicken Tenders',           'Proteins',                'containers', 'case', 'Prestige Farms',    'Walk-in cooler',   40, '0',   '0'),
('Walk-in', 'American Cheese Slices',    'Dairy & Cheese',          'cases',      'case', 'Sam''s Club',       'Walk-in cooler',   60, '2',   '4'),
('Walk-in', 'Vegan Mayo',                'Dairy & Cheese',          'jugs',       'jug',  'Webstaurantstore',  'Walk-in cooler',   70, NULL,  NULL),
('Walk-in', 'Butter (Sticks)',           'Dairy & Cheese',          'sticks',     'case', 'US Foods',          'Walk-in cooler',   80, '12',  NULL),
('Walk-in', 'Buttermilk',                'Condiments, Sauces & Bases','jugs',     'case', 'US Foods',          'Walk-in cooler',   90, '2',   '0'),
('Walk-in', 'House Pickles',             'Produce & Fresh Items',   'containers', 'each', 'In-House',          'Walk-in cooler',  100, '1',   NULL),
('Walk-in', 'Cauliflower',               'Produce & Fresh Items',   'heads',      'case', 'Martin''s Produce', 'Walk-in cooler',  110, NULL,  NULL),
('Walk-in', 'Sweet Heat Pickles',        'Produce & Fresh Items',   'jars',       'case', 'Food Lion',         'Walk-in cooler',  120, NULL,  NULL),
('Walk-in', 'Coleslaw Mix',              'Produce & Fresh Items',   'buckets',    'case', 'Sam''s Club',       'Walk-in cooler',  130, '0 6L bucket', NULL)
ON CONFLICT (list_type, name) DO NOTHING;
