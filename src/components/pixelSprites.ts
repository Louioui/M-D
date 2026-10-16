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
