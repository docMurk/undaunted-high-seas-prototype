// Tile palette distribution. Order doesn't matter; total is ~40.
export const RECIPE = [
  { category: 'water',     count: 10 },
  { category: 'coastline', count: 12 },
  { category: 'island',    count:  8 },
  { category: 'reef',      count:  5 },
  { category: 'fog',       count:  3 },
  { category: 'fort',      count:  4 },
];

export const PALETTE_TARGET = RECIPE.reduce((n, r) => n + r.count, 0); // 42
