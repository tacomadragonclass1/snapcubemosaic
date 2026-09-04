/*
 * templates.js — built-in designs.
 *
 * ADDING A DESIGN IS A DATA-ONLY EDIT. Append an object to TEMPLATES below and
 * reload the page. No other file needs to change, and no code needs to change.
 * See README.md for the full format documentation.
 *
 *   id     stable slug, lowercase, unique. Used for sharing and never shown.
 *   name   what appears in the dropdown.
 *   group  the optgroup heading. Designs with the same group are listed together.
 *   cols   width in cubes.
 *   rows   height in cubes.
 *   cells  array of exactly `rows` strings, each exactly `cols` characters long.
 *          Each character is a palette letter code from palette.js, or "." for an
 *          empty cell (no cube). Empty cells are what make a shape read as an
 *          object rather than a rectangle, so use them freely.
 *
 * Letter codes: R red, O orange, Y yellow, G green, B blue, V purple,
 *               N brown, K black, W white, P pink, "." empty.
 *
 * The app validates every template at load time and reports problems in a banner
 * at the top of the page, so a typo in a pull request is caught immediately
 * rather than silently producing a broken design.
 *
 * Keep new designs to 3–4 colours. Classroom cube sets run thin on brown, purple
 * and white, so lean on red / orange / yellow / green / blue / black.
 */

const TEMPLATES = [

  /* ── 5 × 6 shapes ──────────────────────────────────────────── */
  {
    id: 'heart',
    name: 'Heart',
    group: '5 × 6 Shapes',
    cols: 5,
    rows: 6,
    cells: [
      '.R.R.',
      'RRRRR',
      'RRRRR',
      'RRRRR',
      '.RRR.',
      '..R..',
    ],
  },
  {
    id: 'star',
    name: 'Star',
    group: '5 × 6 Shapes',
    cols: 5,
    rows: 6,
    cells: [
      '..Y..',
      '.YYY.',
      'YYYYY',
      '.YYY.',
      '.YYY.',
      '.Y.Y.',
    ],
  },
  {
    id: 'circle',
    name: 'Circle',
    group: '5 × 6 Shapes',
    cols: 5,
    rows: 6,
    cells: [
      '.BBB.',
      'BBBBB',
      'BBBBB',
      'BBBBB',
      'BBBBB',
      '.BBB.',
    ],
  },
  {
    id: 'triangle',
    name: 'Triangle',
    group: '5 × 6 Shapes',
    cols: 5,
    rows: 6,
    cells: [
      '.....',
      '..G..',
      '.GGG.',
      '.GGG.',
      'GGGGG',
      'GGGGG',
    ],
  },
  {
    id: 'arrow',
    name: 'Arrow',
    group: '5 × 6 Shapes',
    cols: 5,
    rows: 6,
    cells: [
      '..O..',
      '.OOO.',
      'OOOOO',
      '..O..',
      '..O..',
      '..O..',
    ],
  },
  {
    id: 'diamond',
    name: 'Diamond',
    group: '5 × 6 Shapes',
    cols: 5,
    rows: 6,
    cells: [
      '..P..',
      '.PPP.',
      'PPPPP',
      'PPPPP',
      '.PPP.',
      '..P..',
    ],
  },

  /* ── 10 × 10 classics ──────────────────────────────────────── */
  {
    id: 'pumpkin',
    name: 'Pumpkin',
    group: '10 × 10 Classics',
    cols: 10,
    rows: 10,
    cells: [
      '....GG....',
      '....GG....',
      '..OOOOOO..',
      '.OOOOOOOO.',
      'OOOOOOOOOO',
      'OOKKOOKKOO',
      'OOOOOOOOOO',
      'OOKOOOOKOO',
      '.OOKKKKOO.',
      '..OOOOOO..',
    ],
  },
  {
    id: 'dinosaur',
    name: 'Dinosaur',
    group: '10 × 10 Classics',
    cols: 10,
    rows: 10,
    cells: [
      '.......GG.',
      '......GGGG',
      '......GKGG',
      '.......GGG',
      '.GG...GGG.',
      'GGGGGGGGG.',
      'GGGGGGGGGG',
      'GGGGGGGGGG',
      '.GG..GG...',
      '.GG..GG...',
    ],
  },
  {
    id: 'apple',
    name: 'Apple',
    group: '10 × 10 Classics',
    cols: 10,
    rows: 10,
    cells: [
      '....GG....',
      '...GG.....',
      '..RRRRRR..',
      '.RRRRRRRR.',
      'RRRRRRRRRR',
      'RRRRRRRRRR',
      'RRRRRRRRRR',
      '.RRRRRRRR.',
      '.RRRRRRRR.',
      '..RR..RR..',
    ],
  },
  {
    id: 'tree',
    name: 'Tree',
    group: '10 × 10 Classics',
    cols: 10,
    rows: 10,
    cells: [
      '....GG....',
      '...GGGG...',
      '..GGGGGG..',
      '.GGGGGGGG.',
      'GGGGGGGGGG',
      '..GGGGGG..',
      '.GGGGGGGG.',
      'GGGGGGGGGG',
      '....NN....',
      '....NN....',
    ],
  },
  {
    id: 'fish',
    name: 'Fish',
    group: '10 × 10 Classics',
    cols: 10,
    rows: 10,
    cells: [
      '..........',
      '..........',
      '..........',
      '..YYYYY...',
      '.YYYYYYYOO',
      'YYKYYYYYOO',
      '.YYYYYYYOO',
      '..YYYYY...',
      '..........',
      '..........',
    ],
  },
  {
    id: 'cat',
    name: 'Cat',
    group: '10 × 10 Classics',
    cols: 10,
    rows: 10,
    cells: [
      '.KK....KK.',
      '.KKK..KKK.',
      '.KKKKKKKK.',
      'KKKKKKKKKK',
      'KKGKKKKGKK',
      'KKKKKKKKKK',
      'KKKKPKKKKK',
      'KKKKKKKKKK',
      '.KKKKKKKK.',
      '..KK..KK..',
    ],
  },

];
