// Pixel sprites for PixelDrive.tsx. One character per pixel; '.' is transparent.
const CAR = [
  '........K..............KK...............',
  '.......KIK............KWWK..............',
  '.......KIIK............KWWK.............',
  '.......KIIK.............KWWK............',
  '...KKKKKIIKK.............KWWK...........',
  '..KSSSSSSSSSKKKKKKKKKKKKKKKWDKKKKKKK....',
  '..KSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSK...',
  '..KSSSSSSSSSSSSSSSSSDSCCSSSSSSSSSSSSSK..',
  '.KLSDDDKKKKKDDDDDDDDDDDDDDDDKKKKKDDDHHK.',
  '.KLSSSK.....KSSSSSSSDSSSSSSK.....KSSSGK.',
  '.KSSSK.......KCCCCCCCCCCCCK.......KSSGK.',
  '.KSDDK.......KDDDDDDDDDDDDK.......KDDSK.',
  '..KKK.........KKKKKKKKKKKK.........KKK..',
  '........................................',
  '........................................',
  '........................................',
];
const WHEELS_A = [
  '........................................',
  '........................................',
  '........................................',
  '........................................',
  '........................................',
  '........................................',
  '........................................',
  '........................................',
  '........................................',
  '........TTT..................TTT........',
  '.......TTrTT................TTrTT.......',
  '......TTRRRTT..............TTRRRTT......',
  '......TRRrrRr..............TRRrrRr......',
  '......TrRrrTT..............TrRrrTT......',
  '.......TTRTT................TTRTT.......',
  '........TTr..................TTr........',
];
const WHEELS_B = [
  '........................................',
  '........................................',
  '........................................',
  '........................................',
  '........................................',
  '........................................',
  '........................................',
  '........................................',
  '........................................',
  '........TTT..................TTT........',
  '.......TTRTT................TTRTT.......',
  '......TTrRRrT..............TTrRRrT......',
  '......TRRrrRT..............TRRrrRT......',
  '......TTRrrTT..............TTRrrTT......',
  '.......TrRTr................TrRTr.......',
  '........TTT..................TTT........',
];
const DAVID = [
  '...KHHHHHHK...',
  '..KHHhHHHHHK..',
  '.KHHHHHHhHHHK.',
  '.KHHSSSSSSHHK.',
  '.KHSSSSSSSSHK.',
  'KESSKSSSSKSSEK',
  'KESSSSSSSSSSEK',
  '.KSBSSSSSSBSK.',
  '.KSBBKKKKBBSK.',
  '..KBBBwwBBBK..',
  '...KBgBBgBK...',
  '...KKBBBBKK...',
  '..KJJJJJJJJK..',
  '.KJJJJjjJJJJK.',
  'KJJJJJjjJJJJJK',
];
export const SPRITES = { CAR, WHEELS_A, WHEELS_B, DAVID } as const;

// Studio palette: silver roadster with red leather, and David (dark hair with grey,
// salt-and-pepper beard, dark hoodie). Every sprite character must appear here.
export const CAR_PALETTE: Record<string, string> = {
  K: '#14161a', S: '#c9ced6', D: '#8d99ae', C: '#f4f6f9', W: '#a9d1f2', H: '#ffe7a0',
  G: '#3a3f47', L: '#E63946', I: '#8e2b2f', T: '#1d1e21', R: '#b9c0c9', r: '#6f7680',
};
export const DAVID_PALETTE: Record<string, string> = {
  K: '#14161a', H: '#2b2421', h: '#7d7671', S: '#c08a5f', E: '#ad774e', B: '#3b3330',
  g: '#8c857f', w: '#ffffff', J: '#202124', j: '#55585e',
};

// Scrolling scenery tiles. Each tile repeats seamlessly along x; layers move by
// exactly one tile width per loop, so the animation never jumps.
const svg = (width: number, height: number, body: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' shape-rendering='crispEdges'>${body}</svg>`)}")`;
const rects = (fill: string, list: readonly (readonly [number, number, number, number])[], extra = '') =>
  list.map(([x, y, w, h]) => `<rect x='${x}' y='${y}' width='${w}' height='${h}' fill='${fill}'${extra}/>`).join('');

/** Far layer: Boyle Heights / downtown skyline with lit windows and a palm tree. */
export const SKYLINE_TILE = {
  width: 160,
  image: svg(160, 72,
    rects('#2b3954', [[0, 32, 26, 40], [28, 20, 20, 52], [50, 40, 18, 32], [90, 26, 24, 46], [116, 46, 16, 26], [134, 14, 22, 58], [143, 6, 2, 8]]) +
    rects('#ffe7a0', [[4, 38, 2, 2], [12, 46, 2, 2], [18, 38, 2, 2], [32, 26, 2, 2], [40, 34, 2, 2], [32, 42, 2, 2], [54, 46, 2, 2], [96, 32, 2, 2], [104, 40, 2, 2], [96, 52, 2, 2], [120, 52, 2, 2], [138, 20, 2, 2], [146, 30, 2, 2], [138, 44, 2, 2], [150, 52, 2, 2]], " opacity='.6'") +
    rects('#1a2335', [[77, 44, 2, 28], [78, 34, 2, 10], [79, 26, 2, 8]]) +
    rects('#1a2335', [[72, 22, 8, 2], [81, 22, 8, 2], [74, 20, 5, 2], [81, 20, 5, 2], [69, 24, 5, 2], [87, 24, 5, 2], [68, 26, 3, 2], [90, 26, 3, 2], [78, 19, 3, 3]])),
};

/** Mid layer: sidewalk streetlights. */
export const STREETLIGHT_TILE = {
  width: 140,
  image: svg(140, 64,
    rects('#14161a', [[120, 8, 3, 56], [110, 8, 13, 2], [118, 60, 7, 4]]) +
    rects('#ffe7a0', [[108, 10, 6, 2]]) +
    rects('#ffe7a0', [[106, 12, 10, 2], [104, 14, 14, 2]], " opacity='.18'")),
};

/** Near layer: dashed lane paint. */
export const LANE_TILE = {
  width: 28,
  image: svg(28, 3, rects('#f2f0eb', [[0, 0, 14, 3]], " opacity='.65'")),
};
