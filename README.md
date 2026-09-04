# Snap Cube Mosaic Generator

A single-page web app that turns a picture into a buildable snap-cube design for a
kindergarten classroom, and prints a mat that real cubes sit directly on top of.

**Live app:** https://tacomadragonclass1.github.io/snapcubemosaic/

No server, no build step, no dependencies, no accounts. Every image is processed
inside the browser and never uploaded anywhere. The app also works with no internet
at all — download the folder and open `index.html` straight from disk.

---

## What it does

1. **Start** from a built-in template or by uploading an image.
2. **Match** each grid cell to a physical cube colour.
3. **Edit** the grid by hand — this is the step that gets used every single time.
4. **Build** from a printed mat, a cube inventory, a share link, or a JSON file.

### The four outputs

| Output | What it's for |
|---|---|
| **Printable build mat** | The grid at true physical size (2 cm per cube) so children place real cubes onto the paper. Each square shows a colour swatch *and* a letter code, so it still works photocopied in black and white. Empty cells print as dotted outlines. |
| **Cube inventory** | Counts per colour — "58 orange, 10 black, 4 green" — so you know before you start whether a table has enough cubes. |
| **Screen preview** | Styled like real snap cubes: rounded squares, centre studs, visible gaps. |
| **Save & share** | Download the design as JSON, or copy a link that carries the entire design in the URL. Both import back. |

---

## Printing a build mat that is actually the right size

This matters more than anything else in the app: if the print is scaled, the cubes
will not sit on the squares.

1. Click **Print build mat**.
2. **In the print dialog, set Scale to 100% and turn off "Fit to page" /
   "Shrink to fit".** This is the single most common way to get a wrong-sized mat.
3. Print one page and measure the calibration ruler with a real ruler.
4. If the ruler does not measure exactly 10 cm, change **Printer scale %** in the app
   and print again. If your ruler reads 9.6 cm, set the scale to about 104%.
5. Once the ruler measures 10 cm, every square is exactly 2 cm.

The page uses 5 mm margins on purpose. A 10-wide grid is 200 mm across, and US Letter
with normal 12 mm margins only leaves 191.9 mm of printable width — the browser then
silently shrinks the whole page by about 4%, which is enough to throw the cubes off.

A 10 × 10 mat at true size fills most of one page; the colour key and cube counts
continue onto a second page.

---

## Adding a template

**Adding a design is a data-only change.** You edit one file, `templates.js`, and
nothing else. You do not need to understand or touch any application code.

### The format

Each template is an object in the `TEMPLATES` array:

```js
{
  id: 'heart',            // stable, lowercase, unique across all templates
  name: 'Heart',          // what appears in the dropdown
  group: '5 × 6 Shapes',  // dropdown heading; designs sharing a group are listed together
  cols: 5,                // width in cubes
  rows: 6,                // height in cubes
  cells: [                // exactly `rows` strings, each exactly `cols` characters
    '.R.R.',
    'RRRRR',
    'RRRRR',
    'RRRRR',
    '.RRR.',
    '..R..',
  ],
},
```

Each character in `cells` is one cube. Read the strings top to bottom, left to right —
what you type is literally the shape you get.

### Letter codes

| Code | Colour | | Code | Colour |
|---|---|---|---|---|
| `R` | red | | `N` | brown |
| `O` | orange | | `K` | black |
| `Y` | yellow | | `W` | white |
| `G` | green | | `P` | pink |
| `B` | blue | | `.` | **empty — no cube** |
| `V` | purple | | | |

`V` is purple because `P` is taken by pink; `N` is brown because `B` is taken by blue;
`K` is black following the printing convention.

### Rules

- `cells` must contain exactly `rows` strings.
- Every string must be exactly `cols` characters long.
- Every character must be a code from the table above.
- `id` must be unique and should never change once published — share links may use it.
- Use **3–4 colours at most**. Classroom sets run thin on brown, purple and white, so
  lean on red, orange, yellow, green, blue and black.
- Use empty cells (`.`) generously. They are what make a shape read as an object
  instead of a rectangle.
- Keep the cube count reasonable for one table. The dropdown shows the total next to
  each name so it is obvious at a glance.

### Checking your work

Open `index.html` and look at the top of the page. The app validates every template
when it loads and prints a plain-English banner listing anything wrong — a row that is
the wrong length, a duplicate `id`, an unknown letter. If no banner appears, your
template is well-formed. Then pick it from the dropdown to see it.

A quick way to draft a shape: build it in the app by hand, click **Download JSON**, and
copy the `cells` array out of the downloaded file into `templates.js`. The JSON uses
exactly the same row-string format, so it pastes straight in — you only need to add
`id`, `name` and `group`.

### Contributing a design

1. Fork the repository.
2. Add your object to the end of the appropriate section of `TEMPLATES` in `templates.js`.
3. Open `index.html` locally and confirm no warning banner appears and the design looks right.
4. Open a pull request. Mention the grid size and the cube count in the description.

---

## The cube palette

`palette.js` holds the ten cube colours as hex values, and is the single source of
truth for colour matching.

> **The values in it are approximations and should be re-sampled from photographs of
> the actual classroom cubes.** Photograph the cubes under normal classroom light,
> eyedropper the middle of each cube face, and paste the values in. Nothing else needs
> to change. Matching is only ever as good as this table.

---

## File formats

### Saved JSON

```json
{
  "format": "snapcubemosaic/v1",
  "name": "Pumpkin",
  "cols": 10,
  "rows": 10,
  "cells": ["....GG....", "....GG....", "..OOOOOO.."]
}
```

`cells` uses the same row-string format as `templates.js`. Imports also accept `cells`
as one flat string.

### Share links

The whole design travels in the URL fragment, which browsers never send to a server:

```
https://tacomadragonclass1.github.io/snapcubemosaic/#g=10x10&c=....GG....&n=Pumpkin
```

`g` is the grid size, `c` is every cell in reading order, `n` is the name. Malformed
links are rejected with a readable message rather than loading a broken grid.

---

## How the colour matching works

Two decisions drive how a converted image looks, both in `color.js`:

**Per-cell colour is the mode, not the average.** The source art is flat-colour pixel
art. A cell straddling a boundary between two flat colours averages to a colour that
appears nowhere in the picture. Testing five such boundary cells, three of them get a
cube that is in neither half: 55% yellow against blue averages to a green-grey and
matches **green**; red against white averages to **pink**; green against red averages
to **brown**. Taking the most common colour instead simply returns whichever flat
colour dominates the cell. Colours are bucketed to 5 bits per channel before counting
so antialiased edges collapse onto the flat colour they came from.

**Matching is done in CIELAB using CIEDE2000, not RGB distance.** RGB distance is
perceptually wrong — it swaps colours that are numerically close but look nothing
alike. On this palette the two methods disagree on 26.5% of sampled colours. The
CIEDE2000 implementation is verified against the standard Sharma et al. reference
vectors and cross-checked against an independent implementation over 4500 random
colour pairs.

**There is no dithering, deliberately.** A dithered checkerboard is unbuildable by a
five-year-old.

Cells that are mostly transparent become genuine empty cells rather than a
nearest-colour guess. The **Treat near-white as empty** option extends that to art on
a white background.

---

## Editing controls

| Action | How |
|---|---|
| Paint a cube | Click a colour, then click or drag across the grid |
| Erase a cube | Right-click it, or pick the eraser swatch |
| Pick a colour | Click a swatch, or press <kbd>1</kbd>–<kbd>0</kbd> |
| Pick the eraser | Press <kbd>E</kbd> |
| Undo | <kbd>Ctrl</kbd>+<kbd>Z</kbd> (up to 60 steps) |

Changing the grid size keeps the existing design centred rather than discarding it.

---

## Project layout

| File | Contains |
|---|---|
| `index.html` | Page structure, including the print-only build mat |
| `styles.css` | Screen styles, then the print stylesheet |
| `palette.js` | The ten cube colours and their letter codes |
| `templates.js` | Built-in designs — **the only file you edit to add one** |
| `color.js` | sRGB → CIELAB, CIEDE2000, mode sampling |
| `app.js` | State, grid editor, image pipeline, inventory |
| `outputs.js` | Build mat, JSON save/load, share links |

Scripts load as plain globals rather than ES modules, and template data lives in a
`.js` file rather than `.json`, because `fetch()` is blocked under `file://` — this is
what lets the app run from a plain folder with no server.

---

## Planned for v2

- Full letter sets (A–Z, a–z, 0–9) as templates, so names can be built.
- Multi-plate slicing: splitting a large image across several 10 × 10 plates for
  different children to build in parallel.

The template format is already shaped for both — plates are just templates with a
group, and letters are data-only additions.
