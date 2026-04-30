// ============================================================================
// CONFIRMED INGREDIENT PRICES — per oz, sourced from vendor invoices
// Keep updated — these are referenced across multiple recipes
// ============================================================================
export const INGREDIENT_PRICES: Record<string, { perOz: number; source: string }> = {
  // ── Proteins ──────────────────────────────────────────────────────────────
  'Chicken Breast':       { perOz: 0.216,  source: 'Patuxent Farms #2725711 · $3.45/lb' },
  'Beef Patty (2.5oz)':  { perOz: 0.34,   source: '$0.85 per patty / 2.5oz' },

  // ── Dairy ─────────────────────────────────────────────────────────────────
  'Mayonnaise':           { perOz: 0.1038, source: 'Harvest Value #7329113 · $40.85cs · 4/1gal' },
  'Buttermilk':           { perOz: 0.030,  source: 'Glenview Farms #5353909 · $17.03cs · 9/0.5gal' },
  'Soft Serve Mix':       { perOz: 0.055,  source: '$0.77 / 14oz serving (confirmed batch)' },
  'Milk':                 { perOz: 0.035,  source: 'confirmed batch · $0.07 / 2oz' },

  // ── Sauces & Condiments ───────────────────────────────────────────────────
  'Ketchup':              { perOz: 0.0516, source: 'Monarch #667089 · $35.32cs · 6/114oz' },
  'Yellow Mustard':       { perOz: 0.0558, source: "French's #5736780 · $23.46cs · 4/105oz" },
  'Worcestershire':       { perOz: 0.060,  source: "French's case · $36.76cs (confirmed)" },
  'Mambo Sauce':          { perOz: 0.242,  source: 'Capital City Sweet Hot · $123.99 / 4×128oz' },
  'Hellmanns Spicy Mayo': { perOz: 0.260,  source: 'confirmed batch (Surefire Sauce)' },
  'Sour Cream':           { perOz: 0.116,  source: 'confirmed batch (Surefire Sauce)' },
  'Lime Juice':           { perOz: 0.120,  source: 'confirmed batch (Surefire Sauce)' },
  'Maple Syrup':          { perOz: 0.370,  source: "Member's Mark · $0.37/oz confirmed" },
  'Butter':               { perOz: 0.166,  source: 'Glenview Farms · $2.65/lb' },

  // ── Spices & Seasonings ───────────────────────────────────────────────────
  'Black Pepper':         { perOz: 0.620,  source: 'confirmed batch (Surefire Sauce)' },
  'Paprika':              { perOz: 0.384,  source: 'Monarch #760900 · $30.73cs · 5lb' },
  'Garlic Powder':        { perOz: 0.357,  source: 'Gran Sabor #104933 · $29.99 · 5.25lb' },
  'Onion Powder':         { perOz: 0.249,  source: 'Gran Sabor #166635 · $19.88 · 5lb' },
  'Accent MSG':           { perOz: 0.137,  source: 'Accent Flavor Enhancer #158664 · $219.97 / 100lb' },
  'Salt':                 { perOz: 0.030,  source: 'confirmed batch (Surefire Sauce)' },
  'Ranch Seasoning':      { perOz: 0.561,  source: 'Hidden Valley Original 16oz · $8.98 (Costco)' },
  'Mustard Powder':       { perOz: 0.302,  source: 'confirmed · 15oz jar' },

  // ── Fries & Sides ────────────────────────────────────────────────────────
  'Fries (Lamb Weston)':  { perOz: 0.096,  source: 'Lamb Weston #1375526 · $45.94cs · 6/5lb (480oz)' },
  'Cajun Seasoning':      { perOz: 0.327,  source: 'La Fish Fry #6717524 · $31.42cs · 12/8oz (96oz)' },

  // ── Produce & Fresh ───────────────────────────────────────────────────────
  'Fresh Dill':           { perOz: 0.747,  source: 'HERBS-DILL-1LB · $11.95/lb case' },
  'Yellow Onion':         { perOz: 0.050,  source: 'estimated (caramelized/fried)' },
  'Garlic (minced)':      { perOz: 0.120,  source: 'confirmed batch (Surefire Sauce)' },

  // ── Bakery ────────────────────────────────────────────────────────────────
  "Martin's Potato Bun":  { perOz: 0.085,  source: "$0.34 per bun / ~4oz (confirmed)" },

  // ── Packaging ────────────────────────────────────────────────────────────
  'Souffle Cup 1.5oz':    { perOz: 0.007,  source: 'Choice #127P150C · $17.99 / 2500' },
  'Souffle Lid 1.5oz':    { perOz: 0.006,  source: 'Choice #127PL2 · $15.99 / 2500' },
  'Food Cup 6oz':         { perOz: 0.011,  source: 'Choice #760SOUP6WB · $63.99 / 1000' },
  'Food Cup Lid 6oz':     { perOz: 0.009,  source: 'Choice #760SOUP16PBL · $55.99 / 1000' },
  'Shake Cup':            { perOz: 0.005,  source: '$0.08 per cup (confirmed)' },
  'Shake Lid':            { perOz: 0.003,  source: '$0.05 per lid (confirmed)' },
  'Straw':                { perOz: 0.001,  source: '$0.01 per straw (confirmed)' },
}
// ============================================================================
// Food Costing reference data
// Source: "Food Costing .xlsx" — per-item ingredient breakdowns, menu prices,
// and competitor comparisons (Harriet's, Ace no3, Skinny Burger).
//
// Costs are documented at the time of authoring. To re-cost against live
// prices from the Price List, the UI lets you toggle a "live" view — see
// `recipeKeyFor()` and `ingredientToPriceNames` in app/costing/page.tsx.
// ============================================================================

export type CostingComponent = {
  name: string
  cost: number
  priceListName?: string // optional hint — name in price_list table to pull live price from
  qtyForLiveCalc?: number // how many units of that price-list item this line consumes
  isEstimate?: boolean   // flag — shown with ⚠ in UI, confirms with manager
  note?: string          // sourcing/calc note shown on hover / in the row
}

export type CostingSize = {
  label: string            // e.g. "Single", "Double", "Triple", or "Vanilla"
  foodCost: number         // documented $ cost from spreadsheet
  menuPrice: number        // our menu price
  components: CostingComponent[]
  // Competitor prices for the same size/flavor (optional)
  competitors?: {
    harriets?: number
    ace_no3?: number
    skinny?: number
  }
}

export type CostingItem = {
  slug: string             // URL-safe ID
  menuItem: string         // display name
  category: 'Burger' | 'Shake' | 'Chicken' | 'Side' | 'Sauce' | 'Other'
  sizes: CostingSize[]
}

// ─── Shared component price-list hints ──────────────────────────────────────
// Most burger ingredient costs come from the same inventory items; we map
// them once here so the "live" view can re-cost each row against the
// current price_list. These priceListName values should match entries in
// the price_list table by item_name.

const COMPONENT_MAP: Record<string, { priceListName?: string; qtyPerBurger?: (n: number) => number }> = {
  'Patty':            { priceListName: 'Beef Patty' },
  'Cheese Slices':    { priceListName: 'American Cheese Slice' },
  'Pickles':          { priceListName: 'Cucumber (for pickles)' },
  'Sweet Pickles':    { priceListName: 'Cucumber (for pickles)' },
  'Smacked Sauce':    { priceListName: 'Mayonnaise' },
  'Potato Bun':       { priceListName: 'Burger Bun (Martin\'s)' },
  'Potatto Bun':      { priceListName: 'Burger Bun (Martin\'s)' },
  'Bacon':            { priceListName: 'Bacon' },
  'Caramelized Onions': { priceListName: 'Yellow Onion' },
  'Fried Onions':     { priceListName: 'Yellow Onion' },
  'Mambo':            { priceListName: 'Mambo Sauce' },
  'Mambo Sauce':      { priceListName: 'Mambo Sauce' },
  'Cup':              { priceListName: undefined },
  'Lid':              { priceListName: undefined },
  'Straw':            { priceListName: undefined },
  'Milk':             { priceListName: 'Milk' },
  'Soft Serve':       { priceListName: 'Soft Serve Mix' },
}

function enrich(components: CostingComponent[]): CostingComponent[] {
  return components.map(c => {
    // Find the first key in COMPONENT_MAP whose key appears in the name
    const match = Object.keys(COMPONENT_MAP).find(k => c.name.toLowerCase().includes(k.toLowerCase()))
    if (match) return { ...c, priceListName: COMPONENT_MAP[match].priceListName }
    return c
  })
}

// ─── The Classic ────────────────────────────────────────────────────────────
const classic: CostingItem = {
  slug: 'classic',
  menuItem: 'The Classic',
  category: 'Burger',
  sizes: [
    {
      label: 'Single',
      foodCost: 1.47,
      menuPrice: 7.99,
      competitors: { harriets: 7.95, ace_no3: 6.95 },
      components: enrich([
        { name: '1 Patty (2.5oz)',   cost: 0.85 },
        { name: '2 Cheese Slices',   cost: 0.16 },
        { name: 'Pickles',           cost: 0.07 },
        { name: 'Smacked Sauce',     cost: 0.05 },
        { name: 'Potato Bun',        cost: 0.34 },
      ]),
    },
    {
      label: 'Double',
      foodCost: 2.40,
      menuPrice: 10.99,
      competitors: { harriets: 9.95, ace_no3: 10.35 },
      components: enrich([
        { name: '2 Patty',           cost: 1.70 },
        { name: '3 Cheese Slices',   cost: 0.24 },
        { name: 'Pickles',           cost: 0.07 },
        { name: 'Smacked Sauce',     cost: 0.05 },
        { name: 'Potato Bun',        cost: 0.34 },
      ]),
    },
    {
      label: 'Triple',
      foodCost: 2.82,
      menuPrice: 14.89,
      competitors: { harriets: 12.95, ace_no3: 13.75 },
      components: enrich([
        { name: '3 Patty',           cost: 2.04 },
        { name: '4 Cheese Slices',   cost: 0.32 },
        { name: 'Pickles',           cost: 0.07 },
        { name: 'Smacked Sauce',     cost: 0.05 },
        { name: 'Potato Bun',        cost: 0.34 },
      ]),
    },
  ],
}

// ─── The Ogden ──────────────────────────────────────────────────────────────
const ogden: CostingItem = {
  slug: 'ogden',
  menuItem: 'The Ogden',
  category: 'Burger',
  sizes: [
    {
      label: 'Single',
      foodCost: 2.04,
      menuPrice: 10.99,
      components: enrich([
        { name: '1 Patty',           cost: 0.68 },
        { name: '2 Cheese Slices',   cost: 0.16 },
        { name: 'Pickles',           cost: 0.07 },
        { name: 'Smacked Sauce',     cost: 0.05 },
        { name: 'Potato Bun',        cost: 0.34 },
        { name: 'Bacon',             cost: 0.60 },
        { name: 'Caramelized Onions',cost: 0.14 },
      ]),
    },
    {
      label: 'Double',
      foodCost: 2.80,
      menuPrice: 12.99,
      components: enrich([
        { name: '2 Patty',           cost: 1.36 },
        { name: '3 Cheese Slices',   cost: 0.24 },
        { name: 'Pickles',           cost: 0.07 },
        { name: 'Smacked Sauce',     cost: 0.05 },
        { name: 'Potato Bun',        cost: 0.34 },
        { name: 'Bacon',             cost: 0.60 },
        { name: 'Caramelized Onions',cost: 0.14 },
      ]),
    },
    {
      label: 'Triple',
      foodCost: 3.56,
      menuPrice: 15.99,
      components: enrich([
        { name: '3 Patty',           cost: 2.04 },
        { name: '4 Cheese Slices',   cost: 0.32 },
        { name: 'Pickles',           cost: 0.07 },
        { name: 'Smacked Sauce',     cost: 0.05 },
        { name: 'Potato Bun',        cost: 0.34 },
        { name: 'Bacon',             cost: 0.60 },
        { name: 'Caramelized Onions',cost: 0.14 },
      ]),
    },
  ],
}

// ─── Tyson Corner ───────────────────────────────────────────────────────────
const tyson: CostingItem = {
  slug: 'tyson-corner',
  menuItem: 'Tyson Corner',
  category: 'Burger',
  sizes: [
    {
      label: 'Single',
      foodCost: 1.53,
      menuPrice: 12.95,
      components: enrich([
        { name: '1 Patty',           cost: 0.68 },
        { name: '2 Cheese Slices',   cost: 0.16 },
        { name: 'Sweet Pickles',     cost: 0.09 },
        { name: 'Mambo',             cost: 0.05 },
        { name: 'Potato Bun',        cost: 0.34 },
        { name: 'Fried Onions',      cost: 0.07 },
        { name: 'Caramelized Onions',cost: 0.14 },
      ]),
    },
    {
      label: 'Double',
      foodCost: 2.29,
      menuPrice: 14.95,
      components: enrich([
        { name: '2 Patty',           cost: 1.36 },
        { name: '3 Cheese Slices',   cost: 0.24 },
        { name: 'Sweet Pickles',     cost: 0.09 },
        { name: 'Mambo',             cost: 0.05 },
        { name: 'Potato Bun',        cost: 0.34 },
        { name: 'Fried Onions',      cost: 0.07 },
        { name: 'Caramelized Onions',cost: 0.14 },
      ]),
    },
    {
      label: 'Triple',
      foodCost: 3.05,
      menuPrice: 17.95,
      components: enrich([
        { name: '3 Patty',           cost: 2.04 },
        { name: '4 Cheese Slices',   cost: 0.32 },
        { name: 'Sweet Pickles',     cost: 0.09 },
        { name: 'Mambo Sauce',       cost: 0.05 },
        { name: 'Potato Bun',        cost: 0.34 },
        { name: 'Fried Onions',      cost: 0.07 },
        { name: 'Caramelized Onions',cost: 0.14 },
      ]),
    },
  ],
}

// ─── Milkshakes ─────────────────────────────────────────────────────────────
// Base: Cup $0.08 + Lid $0.05 + Straw $0.01 + Milk 2oz $0.07 + Soft Serve 14oz $0.77
//       + Whipped Cream 0.5oz $0.11 = $1.09
// Whipped cream: Glenview Farms #843771 · $39.28/cs · 12/15oz · $0.21/oz · 0.5oz serving
// Chocolate: Hershey's #8060501 · $94.70/cs · 6/7.5lb (720oz) · $0.13/oz · 1.5oz = $0.20
// Strawberry: Monarch #5396163 · $60.06/cs · 3/118oz (354oz) · $0.17/oz · 2oz = $0.34
// Oreo crumble: #5232566 · $110/cs · 25lb (400oz) · $0.275/oz · 1/3 cup (~1.4oz) = $0.39

const shakeBase: CostingComponent[] = [
  { name: 'Cup (1)',             cost: 0.08, priceListName: undefined },
  { name: 'Lid (1)',             cost: 0.05, priceListName: undefined },
  { name: 'Straw (1)',           cost: 0.01, priceListName: undefined },
  { name: 'Milk (2 oz)',         cost: 0.07, priceListName: 'Milk' },
  { name: 'Soft Serve (14 oz)',  cost: 0.77, priceListName: 'Soft Serve Mix' },
  { name: 'Whipped Cream (0.5 oz)', cost: 0.11,
    note: 'Glenview Farms #843771 · $39.28/cs · 12/15oz · $0.21/oz · 0.5oz serving' },
]

const milkshakes: CostingItem = {
  slug: 'milkshakes',
  menuItem: 'Milkshakes',
  category: 'Shake',
  sizes: [
    {
      label: 'Vanilla',
      foodCost: 1.09,
      menuPrice: 6.99,
      competitors: { harriets: 7.95, ace_no3: 6.95 },
      components: shakeBase,
    },
    {
      label: 'Cookies & Cream',
      foodCost: 1.48,
      menuPrice: 6.99,
      components: [
        ...shakeBase,
        { name: 'Oreo Crumble (1/3 cup · ~1.4oz)', cost: 0.39,
          note: 'Oreo #5232566 · $110/cs · 25lb (400oz) · $0.275/oz · 1/3 cup ≈ 1.4oz' },
      ],
    },
    {
      label: 'Chocolate',
      foodCost: 1.29,
      menuPrice: 6.99,
      competitors: { harriets: 9.95, ace_no3: 10.35 },
      components: [
        ...shakeBase,
        { name: "Hershey's Chocolate Syrup (1.5 oz)", cost: 0.20,
          note: "Hershey's #8060501 · $94.70/cs · 6/7.5lb (720oz) · $0.13/oz · 1.5oz" },
      ],
    },
    {
      label: 'Strawberry',
      foodCost: 1.43,
      menuPrice: 6.99,
      competitors: { harriets: 12.95, ace_no3: 13.75 },
      components: [
        ...shakeBase,
        { name: 'Strawberry Topping (2 oz)', cost: 0.34,
          note: 'Monarch #5396163 · $60.06/cs · 3/118oz (354oz) · $0.17/oz · 2oz' },
      ],
    },
  ],
}

// ─── Honey Butta (Chicken Sandwich) ─────────────────────────────────────────
// Chicken breast: Patuxent Farms #2725711, 6oz single-lobe boneless skinless.
// Purchase price: $3.45/lb → 6oz × $3.45/16 = $1.29 per breast.
// Sauces all in-house per Surefire recipe cards. Sweet pickles: Mt. Olive
// Bread & Butter 24oz jar, $4.49 ($0.19/oz).
// ─── Surefire Sauce cost (CONFIRMED Apr 2026) ────────────────────────────────
// Batch: 406 oz total · $44.93 cost · $0.111/oz · 0.7oz serving = $0.08
// Mayo $0.09/oz · Hellmann's Spicy $0.26/oz · Garlic $0.12/oz
// Lime Juice $0.12/oz · Sour Cream $0.116/oz · Salt $0.03/oz
// Black Pepper $0.62/oz · Worcestershire $0.06/oz (French's case $36.76)

const honeyButtaComponents: CostingComponent[] = [
  { name: 'Chicken Breast (6 oz)',
    cost: 1.29, priceListName: 'Chicken Breast',
    note: 'Patuxent Farms #2725711 · 6oz lobe · $3.45/lb' },
  { name: "Martin's Potato Bun",
    cost: 0.34, priceListName: "Martin's Potato Bun" },
  { name: 'Sweet Heat Pickles (4 chips)',
    cost: 0.13,
    note: 'Mt. Olive Sweet Heat B&B · $4.49/24oz jar · 4 chips ≈ 0.7oz · $0.19/oz' },
  { name: 'Surefire Sauce (0.7 oz)',
    cost: 0.08,
    note: 'CONFIRMED: $44.93/406oz batch = $0.111/oz · 0.7oz serving' },
  { name: 'Seasoned Flour Dredge',
    cost: 0.14,
    note: 'CONFIRMED: $20.35/batch ÷ ~150 sandwiches = $0.14 · AP flour+potato starch+10 spices · Mustard powder confirmed 15oz jar' },
  { name: 'Slaw (1.5 oz side)',
    cost: 0.15,
    note: 'CONFIRMED: Cross Valley Farms mix $0.103/oz + dressing (mayo/sugar/pepper) · $26.21/batch ÷ ~175 servings' },
  { name: '1.5 oz Souffle Cup + Lid',
    cost: 0.01,
    note: 'CONFIRMED: Choice #127P150C $17.99/2500 cups = $0.007 + Choice #127PL2 $15.99/2500 lids = $0.006 → $0.013 rounded' },
]
// Confirmed: chicken $1.29 + bun $0.34 + pickles $0.13 + sauce $0.08 + dredge $0.14 + slaw $0.15 + cup/lid $0.01 = $2.14

const honeyButta: CostingItem = {
  slug: 'honey-butta',
  menuItem: 'Honey Butta',
  category: 'Chicken',
  sizes: [
    {
      label: 'Standard',
      foodCost: 2.55, // $2.14 confirmed + $0.41 confirmed dip
      menuPrice: 12.99,
      components: [
        ...honeyButtaComponents,
        { name: 'Honey Butta Dip',
          cost: 0.41,
          note: 'CONFIRMED: Member\'s Mark maple syrup $0.37/oz (8 cups=64oz) + Glenview butter $2.65/lb (2 blocks) · $28.98/batch ÷ ~70 dips' },
      ],
    },
  ],
}

// ─── Retha Mae ──────────────────────────────────────────────────────────────
// Per James: identical to Honey Butta except NO honey butta dip after frying.
const rethaMae: CostingItem = {
  slug: 'retha-mae',
  menuItem: 'Retha Mae',
  category: 'Chicken',
  sizes: [
    {
      label: 'Standard',
      foodCost: 2.14, // $2.14 fully confirmed (no dip)
      menuPrice: 10.99,
      components: honeyButtaComponents,
    },
  ],
}

// ─── Creamy Coleslaw ────────────────────────────────────────────────────────
// 6oz paper cup: Choice #760SOUP6WB · $63.99/1000 = $0.064
// 6oz lid:       Choice #760SOUP16PBL · $55.99/1000 = $0.056
// Slaw filling:  $0.10/oz confirmed (Cross Valley Farms batch) · 6oz = $0.60
const creamyColeslaw: CostingItem = {
  slug: 'creamy-coleslaw',
  menuItem: 'Creamy Coleslaw',
  category: 'Side',
  sizes: [
    {
      label: 'Regular (6 oz)',
      foodCost: 0.72,
      menuPrice: 3.95,
      components: [
        { name: 'Coleslaw Mix + Dressing (6 oz)', cost: 0.60,
          note: 'Cross Valley Farms mix $0.103/oz + dressing · confirmed $0.10/oz · 6oz serving' },
        { name: '6 oz Paper Food Cup', cost: 0.06,
          note: 'Choice #760SOUP6WB · $63.99/1000 = $0.064' },
        { name: '6 oz Cup Lid', cost: 0.06,
          note: 'Choice #760SOUP16PBL · $55.99/1000 = $0.056' },
      ],
    },
  ],
}

// ─── Dipping Sauces ─────────────────────────────────────────────────────────
// All sauces served in 1.5oz souffle cup + lid ($0.01 confirmed)
// Smacked Sauce recipe: Mayo 2gal + Ketchup 11c + Yellow Mustard 5.5c +
//   Black Pepper 7tbsp + Paprika 7tbsp + Accent 3tbsp + Worcestershire 1⅓c
//   Prices needed: mayo, ketchup, mustard, paprika
const dippingSauces: CostingItem = {
  slug: 'dipping-sauces',
  menuItem: 'Dipping Sauces',
  category: 'Sauce',
  sizes: [
    {
      label: 'Smacked Sauce',
      foodCost: 0.15,
      menuPrice: 0.50,
      // Batch: 407oz total · $37.87 cost · $0.093/oz · 1.5oz serving = $0.14 + $0.01 cup
      // Mayo $0.1038/oz (Harvest Value #7329113 $13.28/gal) · Ketchup $0.0516/oz (Monarch 6/114oz $35.32cs)
      // Mustard $0.0558/oz (French's 4/105oz $23.46cs) · Black Pepper $0.62/oz · Paprika $0.384/oz
      // Worcestershire $0.06/oz · Accent/MSG: ⚠ price TBD (negligible ~1.5oz in 407oz batch)
      components: [
        { name: 'Mayonnaise (2 gal · 256 oz)',       cost: 26.57,
          note: 'Harvest Value #7329113 · $13.28/gal · $0.1038/oz' },
        { name: 'Ketchup (11 cups · 88 oz)',          cost: 4.54,
          note: 'Monarch #667089 · $35.32/cs · 6/114oz · $0.0516/oz' },
        { name: 'Yellow Mustard (5.5 cups · 44 oz)', cost: 2.46,
          note: "French's #5736780 · $23.46/cs · 4/105oz · $0.0558/oz" },
        { name: 'Black Pepper (7 tbsp · 3.5 oz)',    cost: 2.17,
          note: '$0.62/oz confirmed' },
        { name: 'Paprika (7 tbsp · 3.5 oz)',         cost: 1.34,
          note: 'Monarch #760900 · $30.73/cs · 5lb (80oz) · $0.384/oz' },
        { name: 'Worcestershire (1⅓ cups · 10.7 oz)', cost: 0.64,
          note: "French's case · $0.06/oz confirmed" },
        { name: 'Accent/MSG (3 tbsp · ~1.4 oz)',        cost: 0.19,
          note: 'Accent #158664 · $219.97/100lb · $0.137/oz · 3 tbsp ≈ 1.4oz' },
        { name: '1.5 oz Souffle Cup + Lid',           cost: 0.01,
          note: 'Choice #127P150C + #127PL2 · $0.013 per set' },
      ],
    },
    {
      label: 'House Ranch',
      foodCost: 0.14,
      menuPrice: 0.50,
      // Batch: ~536oz total · $46.54 cost · $0.087/oz · 1.5oz serving = $0.13 + $0.01 cup
      // Buttermilk $0.030/oz · Mayo $0.1038/oz · Ranch Seasoning $0.561/oz
      // Accent $0.137/oz · Fresh Dill $0.747/oz · Garlic Powder $0.357/oz · Onion Powder $0.249/oz
      components: [
        { name: 'Buttermilk (8 qt · 256 oz)',          cost: 7.68,
          note: 'Glenview Farms #5353909 · $17.03cs · 9/0.5gal · $0.030/oz' },
        { name: 'Mayonnaise (2 gal · 256 oz)',          cost: 26.57,
          note: 'Harvest Value #7329113 · $13.28/gal · $0.1038/oz' },
        { name: 'Ranch Seasoning (5 cups · ~20 oz)',    cost: 11.22,
          note: 'Hidden Valley Original 16oz $8.98 (Costco) · $0.561/oz · ~4oz/cup' },
        { name: 'Accent/MSG (¼ cup · ~1.9 oz)',         cost: 0.26,
          note: 'Accent #158664 · $219.97/100lb · $0.137/oz' },
        { name: 'Fresh Dill (¼ cup · ~0.15 oz)',        cost: 0.11,
          note: 'HERBS-DILL-1LB · $11.95/lb · $0.747/oz' },
        { name: 'Garlic Powder (¼ cup · ~1.2 oz)',      cost: 0.43,
          note: 'Gran Sabor #104933 · $29.99/5.25lb · $0.357/oz' },
        { name: 'Onion Powder (¼ cup · ~1.1 oz)',       cost: 0.27,
          note: 'Gran Sabor #166635 · $19.88/5lb · $0.249/oz' },
        { name: '1.5 oz Souffle Cup + Lid',             cost: 0.01,
          note: 'Choice #127P150C + #127PL2 · $0.013 per set' },
      ],
    },
    {
      label: 'Mambo Sauce',
      foodCost: 0.37,
      menuPrice: 0.75,
      // Capital City Mambo Sauce Sweet Hot · $123.99 / 4-pack (4×128oz = 512oz) · $0.242/oz
      components: [
        { name: 'Capital City Mambo Sauce (1.5 oz)', cost: 0.36,
          note: 'Capital City Sweet Hot · $123.99/4-pack · 512oz total · $0.242/oz · 1.5oz serving' },
        { name: '1.5 oz Souffle Cup + Lid', cost: 0.01,
          note: 'Choice #127P150C + #127PL2 · $0.013 per set' },
      ],
    },
    {
      label: 'Surefire Sauce',
      foodCost: 0.18,
      menuPrice: 0.50,
      components: [
        { name: 'Surefire Sauce (1.5 oz)', cost: 0.17,
          note: 'CONFIRMED: $44.93/406oz batch = $0.111/oz · 1.5oz serving' },
        { name: '1.5 oz Souffle Cup + Lid', cost: 0.01,
          note: 'Choice #127P150C + #127PL2 · $0.013 per set' },
      ],
    },
    {
      label: 'Honey Butta',
      foodCost: 0.42,
      menuPrice: 0.75,
      components: [
        { name: 'Honey Butta Sauce (1.5 oz)', cost: 0.41,
          note: 'CONFIRMED: $28.98/batch ÷ ~70 servings = $0.414 · maple syrup + butter' },
        { name: '1.5 oz Souffle Cup + Lid', cost: 0.01,
          note: 'Choice #127P150C + #127PL2 · $0.013 per set' },
      ],
    },
  ],
}

// ─── Seasoned Fries ─────────────────────────────────────────────────────────
// Fries: Lamb Weston #1375526 · $45.94cs · 6/5lb (480oz) · $0.096/oz
// Seasoning: La Fish Fry CJN #6717524 · $31.42cs · 12/8oz (96oz) · $0.327/oz
const seasonedFries: CostingItem = {
  slug: 'seasoned-fries',
  menuItem: 'Seasoned Fries',
  category: 'Side',
  sizes: [
    {
      label: 'Regular (7 oz)',
      foodCost: 0.70,
      menuPrice: 3.95,
      components: [
        { name: 'Fries (7 oz)',               cost: 0.67,
          note: 'Lamb Weston #1375526 · $45.94cs · 6/5lb · $0.096/oz' },
        { name: 'Cajun Seasoning (1 tsp · ~0.1 oz)', cost: 0.03,
          note: 'La Fish Fry #6717524 · $31.42cs · 12/8oz · $0.327/oz' },
      ],
    },
  ],
}

// ─── Grilled Cheese ─────────────────────────────────────────────────────────
// Butter: Glenview Farms $2.65/lb · $0.166/oz · 1oz per sandwich (both bun sides + cheese)
const grilledCheese: CostingItem = {
  slug: 'grilled-cheese',
  menuItem: 'Grilled Cheese',
  category: 'Other',
  sizes: [
    {
      label: 'Standard',
      foodCost: 0.67,
      menuPrice: 4.99,
      components: enrich([
        { name: "Martin's Potato Bun",  cost: 0.34 },
        { name: '2 Cheese Slices',      cost: 0.16 },
        { name: 'Butter (1 oz)',        cost: 0.17,
          note: 'Glenview Farms · $2.65/lb · $0.166/oz · both bun sides + on cheese to melt' },
      ]),
    },
  ],
}

// ─── Plain Hamburger ────────────────────────────────────────────────────────
const plainHamburger: CostingItem = {
  slug: 'plain-hamburger',
  menuItem: 'Plain Hamburger',
  category: 'Burger',
  sizes: [
    {
      label: 'Single',
      foodCost: 1.19,
      menuPrice: 6.39,
      components: enrich([
        { name: '1 Patty (2.5oz)', cost: 0.85 },
        { name: 'Potato Bun',      cost: 0.34 },
      ]),
    },
  ],
}

export const FOOD_COSTING: CostingItem[] = [classic, ogden, tyson, plainHamburger, grilledCheese, honeyButta, rethaMae, milkshakes, seasonedFries, creamyColeslaw, dippingSauces]

// Helper: compute documented food cost % for a size
export function foodCostPct(size: CostingSize): number | null {
  if (!size.menuPrice || size.menuPrice <= 0) return null
  return size.foodCost / size.menuPrice
}

// Helper: sum of component costs (may differ slightly from documented foodCost)
export function sumComponents(size: CostingSize): number {
  return size.components.reduce((s, c) => s + c.cost, 0)
}
