/*
 * palette.js — the physical snap cube palette.
 *
 * TODO(milo): RE-SAMPLE THESE HEX VALUES FROM PHOTOS OF THE ACTUAL CLASSROOM CUBES.
 *   The values below are eyeballed approximations of typical snap-cube plastic.
 *   Colour matching is only ever as good as this table: the app converts these to
 *   CIELAB and picks the lowest Delta-E, so if "red" here is not the red sitting in
 *   the bin, every red in every design will be subtly wrong. Photograph the cubes
 *   under normal classroom light, eyedropper the middle of each cube face, and paste
 *   the values in. Nothing else needs to change — this is the single source of truth.
 *
 * `code` is the single letter printed on the build mat so a design survives a
 * grayscale photocopier. Codes must stay unique and must never be "." (empty).
 */

const PALETTE = [
  { code: 'R', name: 'red',    hex: '#d92b2b' },
  { code: 'O', name: 'orange', hex: '#f07f1a' },
  { code: 'Y', name: 'yellow', hex: '#f5d327' },
  { code: 'G', name: 'green',  hex: '#3aa64a' },
  { code: 'B', name: 'blue',   hex: '#2b6fd9' },
  { code: 'V', name: 'purple', hex: '#7b45b0' }, // V for violet — P is taken by pink
  { code: 'N', name: 'brown',  hex: '#7a4a26' }, // N for browN — B is taken by blue
  { code: 'K', name: 'black',  hex: '#22252a' }, // K as in printing's blacK
  { code: 'W', name: 'white',  hex: '#f2f2ef' },
  { code: 'P', name: 'pink',   hex: '#ee87b4' },
];

/* The code for "no cube here". Empty cells are first-class: they are what makes a
 * shape read as an object instead of a rectangle. */
const EMPTY_CODE = '.';

/* Lookup by letter code, built once. */
const PALETTE_BY_CODE = Object.fromEntries(PALETTE.map((c) => [c.code, c]));
