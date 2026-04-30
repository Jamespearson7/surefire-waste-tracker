// ─── Recipe yields ────────────────────────────────────────────────────────────
// Based on last-week product mix (Apr 13-19) and Surefire menu specs.
// All quantities in the unit noted; oz for weight ingredients.

export type RecipeIngredient = {
  item: string       // matches price_list item_name / SHIFT_ITEMS
  qty: number        // amount per menu item sold
  unit: string       // oz | each | lbs
}

export type Recipe = {
  menuItem: string
  ingredients: RecipeIngredient[]
}

// Weighted avg patties per burger order (806 single / 809 double / 49 triple from modifier data)
const AVG_PATTIES_PER_BURGER = 1.545
// Weighted avg cheese slices per burger (from modifier data)
const AVG_CHEESE_PER_BURGER = 2.54

export const RECIPES: Recipe[] = [
  {
    menuItem: 'The Classic',
    ingredients: [
      { item: 'Beef Patty',           qty: AVG_PATTIES_PER_BURGER, unit: 'each' },
      { item: "Burger Bun (Martin's)", qty: 1,                       unit: 'each' },
      { item: 'American Cheese Slice', qty: AVG_CHEESE_PER_BURGER,   unit: 'each' },
      { item: 'Cucumber (for pickles)', qty: 0.023,                  unit: 'lbs' }, // ~4 pickle slices ≈ 0.37oz
    ],
  },
  {
    menuItem: 'Plain Hamburger',
    ingredients: [
      { item: 'Beef Patty',            qty: 1,    unit: 'each' },
      { item: "Burger Bun (Martin's)", qty: 1,    unit: 'each' },
    ],
  },
  {
    menuItem: 'The Ogden',
    ingredients: [
      { item: 'Beef Patty',            qty: AVG_PATTIES_PER_BURGER, unit: 'each' },
      { item: "Burger Bun (Martin's)", qty: 1,                      unit: 'each' },
      { item: 'American Cheese Slice', qty: AVG_CHEESE_PER_BURGER,  unit: 'each' },
      { item: 'Bacon',                 qty: 1,                      unit: 'oz'   },
      { item: 'Yellow Onion',          qty: 1,                      unit: 'oz'   },
      { item: 'Cucumber (for pickles)', qty: 0.023,                 unit: 'lbs' },
    ],
  },
  {
    menuItem: 'Tyson Corner',
    ingredients: [
      { item: 'Beef Patty',            qty: AVG_PATTIES_PER_BURGER, unit: 'each' },
      { item: "Burger Bun (Martin's)", qty: 1,                      unit: 'each' },
      { item: 'American Cheese Slice', qty: AVG_CHEESE_PER_BURGER,  unit: 'each' },
      { item: 'Yellow Onion',          qty: 1.5,                    unit: 'oz'   },
      { item: 'Sweet Heat Pickles',    qty: 1,                      unit: 'oz'   },
    ],
  },
  {
    menuItem: 'Baker Street',
    ingredients: [
      { item: 'Falafel Patty',         qty: 1,   unit: 'each' },
      { item: 'Vegan Cheese Slice',    qty: 1,   unit: 'each' },
      { item: 'Vegan Mayo',            qty: 1,   unit: 'oz'   },
      { item: 'Dill Pickles (house)',  qty: 1,   unit: 'portion' },
    ],
  },
  {
    menuItem: 'Grilled Cheese',
    ingredients: [
      { item: "Burger Bun (Martin's)", qty: 1,                     unit: 'each' },
      { item: 'American Cheese Slice', qty: AVG_CHEESE_PER_BURGER, unit: 'each' },
    ],
  },
  {
    menuItem: 'Retha Mae',
    ingredients: [
      { item: 'Chicken Breast',        qty: 6,   unit: 'oz' },
      { item: "Chicken Bun (Martin's)", qty: 1,  unit: 'each' },
      { item: 'Coleslaw Mix (Cabbage)', qty: 1.5, unit: 'oz' },
    ],
  },
  {
    menuItem: 'Honey Butta',
    ingredients: [
      { item: 'Chicken Breast',        qty: 6,   unit: 'oz' },
      { item: "Chicken Bun (Martin's)", qty: 1,  unit: 'each' },
      { item: 'Coleslaw Mix (Cabbage)', qty: 1.5, unit: 'oz' },
      { item: 'Honey Dip / Honey Butta', qty: 1, unit: 'oz' },
    ],
  },
  {
    menuItem: 'Chicken Tenders',
    ingredients: [
      { item: 'Chicken Tenders', qty: 0.275, unit: 'lbs' }, // 40lb case, order by case
    ],
  },
  {
    menuItem: 'Seasoned Fries',
    ingredients: [
      { item: 'Fries', qty: 7, unit: 'oz' },
    ],
  },
  {
    menuItem: 'Cauliflower Bites',
    ingredients: [
      { item: 'Cauliflower Bites', qty: 5, unit: 'oz' },
    ],
  },
]

// ─── Modifier add-ons ──────────────────────────────────────────────────────────
// These are counted separately from the base recipe (customer add-ons)
// Based on observed modifier data: 574 lettuce, 433 tomato add-ons last week

export type ModifierRate = {
  modifierName: string
  item: string
  qtyPerOrder: number
  unit: string
  // Rate calculated at runtime from last week's total orders
}

export const MODIFIER_INGREDIENTS: ModifierRate[] = [
  { modifierName: 'Add Lettuce',  item: 'Lettuce',  qtyPerOrder: 0.75, unit: 'oz' },
  { modifierName: 'Add Tomato',   item: 'Tomatoes', qtyPerOrder: 1.5,  unit: 'oz' },
]

// ─── Order conversions ─────────────────────────────────────────────────────────
// Maps ingredient item → how it's actually ordered from vendor

export type OrderConversion = {
  item: string
  vendor: string
  orderUnit: string          // e.g. "case", "bag", "box"
  orderUnitLabel: string     // display label e.g. "cases (40 lb)"
  // convert: takes total raw need (in item's native unit) → how many order units to buy
  convertFn: (rawTotal: number, rawUnit: string) => number
  roundUp: boolean           // always round up to next full order unit
  notes?: string
}

// Helper: oz → lbs
const ozToLbs = (oz: number) => oz / 16

export const ORDER_CONVERSIONS: OrderConversion[] = [
  {
    item: 'Beef Patty',
    vendor: 'Ben E. Keith',
    orderUnit: 'box',
    orderUnitLabel: 'boxes',
    convertFn: (qty) => qty / 24,  // typical box = 24 patties (approx — adjust per invoice)
    roundUp: true,
    notes: 'Confirm patties per box from Ben E. Keith invoice',
  },
  {
    item: 'Falafel Patty',
    vendor: 'US Foods',
    orderUnit: 'case',
    orderUnitLabel: 'cases',
    convertFn: (qty) => qty / 48,
    roundUp: true,
  },
  {
    item: 'Chicken Breast',
    vendor: 'US Foods',
    orderUnit: 'case',
    orderUnitLabel: 'cases (40 lb)',
    convertFn: (oz) => ozToLbs(oz) / 40,
    roundUp: true,
  },
  {
    item: 'Chicken Tenders',
    vendor: 'US Foods',
    orderUnit: 'case',
    orderUnitLabel: 'cases (40 lb)',
    convertFn: (lbs) => lbs / 40,
    roundUp: true,
    notes: 'Jumbo tenders — variable individual size, order by 40 lb case',
  },
  {
    item: 'Bacon',
    vendor: 'Chef Store',
    orderUnit: 'box',
    orderUnitLabel: 'boxes',
    convertFn: (oz) => ozToLbs(oz) / 15, // typical 15 lb box
    roundUp: true,
  },
  {
    item: "Burger Bun (Martin's)",
    vendor: "Martin's Potato Buns",
    orderUnit: 'case',
    orderUnitLabel: 'cases (8-pk bags)',
    convertFn: (qty) => qty / 48, // 6 bags × 8 buns = 48 per case (verify)
    roundUp: true,
  },
  {
    item: "Chicken Bun (Martin's)",
    vendor: "Martin's Potato Buns",
    orderUnit: 'case',
    orderUnitLabel: 'cases (8-pk bags)',
    convertFn: (qty) => qty / 48,
    roundUp: true,
  },
  {
    item: 'Fries',
    vendor: 'US Foods',
    orderUnit: 'case',
    orderUnitLabel: 'cases (6 × 5 lb bags)',
    convertFn: (oz) => ozToLbs(oz) / 30, // 30 lb/case
    roundUp: true,
  },
  {
    item: 'Cauliflower Bites',
    vendor: 'Ben E. Keith',
    orderUnit: 'case',
    orderUnitLabel: 'cases (12 heads)',
    convertFn: (oz) => ozToLbs(oz) / 14, // ~14 lb usable per 12-head case (estimate)
    roundUp: true,
    notes: 'Weight per head varies — update case yield in Price List',
  },
  {
    item: 'Lettuce',
    vendor: 'Ben E. Keith',
    orderUnit: 'case',
    orderUnitLabel: 'cases',
    convertFn: (oz) => ozToLbs(oz) / 24,
    roundUp: true,
  },
  {
    item: 'Tomatoes',
    vendor: 'Ben E. Keith',
    orderUnit: 'box',
    orderUnitLabel: 'boxes (25 lb)',
    convertFn: (oz) => ozToLbs(oz) / 25,
    roundUp: true,
  },
  {
    item: 'Yellow Onion',
    vendor: 'US Foods',
    orderUnit: 'bag',
    orderUnitLabel: 'bags (50 lb)',
    convertFn: (oz) => ozToLbs(oz) / 50,
    roundUp: true,
  },
  {
    item: 'Cucumber (for pickles)',
    vendor: 'Ben E. Keith',
    orderUnit: 'box',
    orderUnitLabel: 'boxes (40 lb)',
    convertFn: () => 1,  // Always 1 box/week → 2 × 22L containers pickles
    roundUp: false,
    notes: '1 box/week regardless of volume; makes 2 × 22L containers',
  },
  {
    item: 'Coleslaw Mix (Cabbage)',
    vendor: 'Ben E. Keith',
    orderUnit: 'case',
    orderUnitLabel: 'cases',
    convertFn: (oz) => ozToLbs(oz) / 10,
    roundUp: true,
  },
  {
    item: 'American Cheese Slice',
    vendor: "Sam's Club",
    orderUnit: 'case',
    orderUnitLabel: 'cases (160-ct)',
    convertFn: (qty) => qty / 160,
    roundUp: true,
  },
  {
    item: 'Vegan Cheese Slice',
    vendor: 'Walmart',
    orderUnit: 'pack',
    orderUnitLabel: 'packs',
    convertFn: (qty) => qty / 10,
    roundUp: true,
  },
  {
    item: 'Vegan Mayo',
    vendor: 'Webstaurantstore',
    orderUnit: 'jug',
    orderUnitLabel: 'jugs',
    convertFn: (oz) => oz / 128, // 1 gallon = 128 oz
    roundUp: true,
  },
]

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getRecipeForMenuItem(menuItem: string): Recipe | undefined {
  return RECIPES.find(r => r.menuItem === menuItem)
}

export function getOrderConversion(item: string): OrderConversion | undefined {
  return ORDER_CONVERSIONS.find(c => c.item === item)
}

// ─── Calculate total ingredient need from sales data ─────────────────────────

export type SalesRow = { menuItem: string; qtySold: number }
export type ModifierRow = { modifierName: string; qtySold: number }

export type IngredientNeed = {
  item: string
  totalOz?: number      // for weight items
  totalEach?: number    // for count items
  totalLbs?: number     // for lb items
  vendor?: string
  orderQty?: number
  orderUnitLabel?: string
  notes?: string
}

export function calcIngredientNeeds(
  sales: SalesRow[],
  modifiers: ModifierRow[],
  volumeMultiplier = 1.0,
  wasteBuffer = 0.05,    // 5% waste buffer on top
): IngredientNeed[] {
  const needs: Record<string, { oz: number; each: number; lbs: number }> = {}

  const add = (item: string, qty: number, unit: string) => {
    if (!needs[item]) needs[item] = { oz: 0, each: 0, lbs: 0 }
    const scaled = qty * volumeMultiplier * (1 + wasteBuffer)
    if (unit === 'oz')   needs[item].oz   += scaled
    if (unit === 'each') needs[item].each += scaled
    if (unit === 'lbs')  needs[item].lbs  += scaled
  }

  // Recipe ingredients from menu item sales
  for (const { menuItem, qtySold } of sales) {
    const recipe = getRecipeForMenuItem(menuItem)
    if (!recipe) continue
    for (const ing of recipe.ingredients) {
      add(ing.item, ing.qty * qtySold, ing.unit)
    }
  }

  // Modifier add-ons
  for (const { modifierName, qtySold } of modifiers) {
    const mod = MODIFIER_INGREDIENTS.find(m => m.modifierName === modifierName)
    if (!mod) continue
    add(mod.item, mod.qtyPerOrder * qtySold, mod.unit)
  }

  // Build result array
  return Object.entries(needs).map(([item, { oz, each, lbs }]) => {
    const conv = getOrderConversion(item)
    let orderQty: number | undefined

    if (conv) {
      if (oz > 0)   orderQty = conv.convertFn(oz, 'oz')
      if (each > 0) orderQty = conv.convertFn(each, 'each')
      if (lbs > 0)  orderQty = conv.convertFn(lbs, 'lbs')
      if (conv.roundUp && orderQty !== undefined) orderQty = Math.ceil(orderQty)
    }

    return {
      item,
      totalOz:   oz   > 0 ? oz   : undefined,
      totalEach: each > 0 ? each : undefined,
      totalLbs:  lbs  > 0 ? lbs  : undefined,
      vendor: conv?.vendor,
      orderQty,
      orderUnitLabel: conv?.orderUnitLabel,
      notes: conv?.notes,
    }
  })
}

// Group needs by vendor for the order sheet
export function groupByVendor(needs: IngredientNeed[]): Record<string, IngredientNeed[]> {
  const groups: Record<string, IngredientNeed[]> = {}
  for (const need of needs) {
    const vendor = need.vendor ?? 'Other'
    if (!groups[vendor]) groups[vendor] = []
    groups[vendor].push(need)
  }
  return groups
}
