/*
 * outputs.js — the things that leave the screen: the printable build mat, the
 * cube inventory on paper, JSON save/load and share-by-URL.
 *
 * Loads after app.js and registers its own DOMContentLoaded handler, so a design
 * carried in the URL replaces the starter template once the editor is up.
 */

'use strict';

/* ── Serialisation ─────────────────────────────────────────────── */

const FILE_FORMAT = 'snapcubemosaic/v1';

/** Flat cell array → array of row strings (the same shape templates.js uses). */
function cellsToRows(cells, cols, rows) {
  const out = [];
  for (let y = 0; y < rows; y++) {
    out.push(cells.slice(y * cols, (y + 1) * cols).join(''));
  }
  return out;
}

function currentDesign() {
  return {
    format: FILE_FORMAT,
    name: state.name || 'Untitled design',
    cols: state.cols,
    rows: state.rows,
    cells: cellsToRows(state.cells, state.cols, state.rows),
  };
}

/**
 * Validate and adopt a design object. Returns an error string, or null on success.
 * Shared by JSON import and URL loading so both reject the same bad input.
 */
function applyDesign(d) {
  if (!d || typeof d !== 'object') return 'Not a design file.';

  const cols = Number(d.cols), rows = Number(d.rows);
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1 || cols > 60 || rows > 60) {
    return 'Design has a missing or unreasonable grid size.';
  }

  const flat = Array.isArray(d.cells) ? d.cells.join('') : String(d.cells || '');
  if (flat.length !== cols * rows) {
    return `Design says ${cols}×${rows} (${cols * rows} cells) but contains ${flat.length}.`;
  }

  const valid = new Set(PALETTE.map((c) => c.code));
  valid.add(EMPTY_CODE);
  for (const ch of flat) {
    if (!valid.has(ch)) return `Design contains "${ch}", which is not a cube colour code.`;
  }

  pushUndo();
  state.cols = cols;
  state.rows = rows;
  state.cells = flat.split('');
  state.name = d.name || '';
  $('design-name').value = state.name;

  /* Only reflect the size in the picker if it is one of the offered sizes. */
  const sizeValue = `${cols}x${rows}`;
  const sizeSelect = $('grid-size');
  if ([...sizeSelect.options].some((o) => o.value === sizeValue)) sizeSelect.value = sizeValue;

  renderGrid();
  return null;
}

/* ── JSON download / upload ────────────────────────────────────── */

function slugify(s) {
  return (s || 'design').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'design';
}

function exportJson() {
  const json = JSON.stringify(currentDesign(), null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugify(state.name)}.snapcube.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  /* Revoke on the next tick so the download has definitely started. */
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setShareStatus('Saved JSON to your downloads.');
}

function importJsonFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let parsed;
    try {
      parsed = JSON.parse(reader.result);
    } catch (e) {
      setShareStatus('That file is not valid JSON.');
      return;
    }
    const err = applyDesign(parsed);
    setShareStatus(err || `Loaded “${state.name || 'design'}”.`);
  };
  reader.onerror = () => setShareStatus('That file could not be read.');
  reader.readAsText(file);
}

/* ── Share by URL ──────────────────────────────────────────────── */

/*
 * The whole design rides in the URL fragment, which never goes to a server. Cell
 * codes are letters and dots, so the payload needs no encoding and stays readable:
 *   …/index.html#g=10x10&c=....GG....&n=Pumpkin
 */
function designToHash(d) {
  const flat = Array.isArray(d.cells) ? d.cells.join('') : d.cells;
  return `#g=${d.cols}x${d.rows}&c=${flat}&n=${encodeURIComponent(d.name || '')}`;
}

function parseHash(hash) {
  const raw = String(hash || '').replace(/^#/, '');
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const g = params.get('g');
  const c = params.get('c');
  if (!g || !c) return null;
  const m = /^(\d+)x(\d+)$/.exec(g);
  if (!m) return null;
  return { cols: Number(m[1]), rows: Number(m[2]), cells: c, name: params.get('n') || '' };
}

function shareUrl() {
  return location.origin === 'null' || location.protocol === 'file:'
    ? location.href.split('#')[0] + designToHash(currentDesign())
    : location.origin + location.pathname + designToHash(currentDesign());
}

function setShareStatus(msg) {
  $('share-status').textContent = msg || '';
}

async function copyShareLink() {
  const url = shareUrl();
  /* Keep the address bar in step so the browser's own share/bookmark works too. */
  try { history.replaceState(null, '', designToHash(currentDesign())); } catch (e) { /* file:// */ }

  try {
    await navigator.clipboard.writeText(url);
    setShareStatus('Share link copied to the clipboard.');
    return;
  } catch (e) {
    /* Clipboard API is unavailable over file:// in some browsers — fall back. */
  }

  const tmp = document.createElement('textarea');
  tmp.value = url;
  tmp.setAttribute('readonly', '');
  tmp.style.position = 'fixed';
  tmp.style.opacity = '0';
  document.body.appendChild(tmp);
  tmp.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  tmp.remove();

  setShareStatus(ok
    ? 'Share link copied to the clipboard.'
    : 'Copy this from the address bar — the link now holds your design.');
}

/* ── Printable build mat ───────────────────────────────────────── */

const CUBE_MM = 20;        // one snap cube is 2 cm across
const RULER_CM = 10;       // calibration ruler length

function printScale() {
  const pct = parseFloat($('print-scale').value);
  if (!isFinite(pct) || pct <= 0) return 1;
  return Math.min(1.5, Math.max(0.5, pct / 100));
}

function buildPrintMat() {
  const scale = printScale();
  document.documentElement.style.setProperty('--print-scale', String(scale));
  document.documentElement.style.setProperty('--cube-mm', String(CUBE_MM));

  const counts = countCubes(state.cells);
  const used = PALETTE.filter((c) => counts.get(c.code));
  const total = totalCubes(state.cells);

  /* Header */
  $('print-title').textContent = state.name || 'Untitled design';
  $('print-meta').textContent =
    `${state.cols} × ${state.rows} grid · ${total} cubes · ` +
    `each square is ${CUBE_MM} mm · printed at ${(scale * 100).toFixed(1)}% · ` +
    new Date().toLocaleDateString();

  /* The mat itself */
  const grid = $('print-grid');
  grid.style.gridTemplateColumns =
    `repeat(${state.cols}, calc(var(--cube-mm) * var(--print-scale) * 1mm))`;
  grid.innerHTML = '';

  for (let i = 0; i < state.cells.length; i++) {
    const code = state.cells[i];
    const cell = document.createElement('div');
    if (code === EMPTY_CODE) {
      cell.className = 'print-cell empty';
      cell.textContent = '';
    } else {
      const cube = PALETTE_BY_CODE[code];
      cell.className = 'print-cell';
      cell.style.background = cube.hex;
      /* Colour swatch AND letter: the letter is what survives a grayscale copier. */
      cell.style.color = inkOn(cube.hex);
      cell.textContent = code;
    }
    grid.appendChild(cell);
  }

  /* Calibration ruler */
  const ruler = $('print-ruler');
  ruler.innerHTML = '';
  for (let cm = 0; cm <= RULER_CM; cm++) {
    const tick = document.createElement('div');
    tick.className = 'print-tick major';
    tick.style.left = `calc(${cm * 10} * var(--print-scale) * 1mm)`;
    tick.innerHTML = `<span>${cm}</span>`;
    ruler.appendChild(tick);

    if (cm < RULER_CM) {
      const half = document.createElement('div');
      half.className = 'print-tick';
      half.style.left = `calc(${cm * 10 + 5} * var(--print-scale) * 1mm)`;
      ruler.appendChild(half);
    }
  }

  /* Colour key — letter code to colour name, for the grayscale case */
  const legend = $('print-legend');
  legend.innerHTML = '';
  for (const cube of used) {
    const li = document.createElement('li');
    li.innerHTML =
      `<span class="print-chip" style="background:${cube.hex};color:${inkOn(cube.hex)}">${cube.code}</span>` +
      `<span>${cube.code} = ${cube.name}</span>`;
    legend.appendChild(li);
  }
  if (state.cells.includes(EMPTY_CODE)) {
    const li = document.createElement('li');
    li.innerHTML =
      '<span class="print-chip" style="border-style:dotted">&nbsp;</span>' +
      '<span>dotted = leave empty</span>';
    legend.appendChild(li);
  }

  /* Cubes needed */
  const inv = $('print-inventory');
  inv.innerHTML = '';
  for (const cube of used.slice().sort((a, b) => counts.get(b.code) - counts.get(a.code))) {
    const li = document.createElement('li');
    li.innerHTML =
      `<span class="print-chip" style="background:${cube.hex};color:${inkOn(cube.hex)}">${cube.code}</span>` +
      `<span><strong>${counts.get(cube.code)}</strong> ${cube.name}</span>`;
    inv.appendChild(li);
  }
  const totalLi = document.createElement('li');
  totalLi.innerHTML = `<span class="print-chip" style="border:none">&nbsp;</span><span><strong>${total}</strong> cubes in total</span>`;
  inv.appendChild(totalLi);
}

function printMat() {
  if (totalCubes(state.cells) === 0) {
    setShareStatus('Nothing to print yet — the grid is empty.');
    return;
  }
  buildPrintMat();
  window.print();
}

/* ── Wiring ────────────────────────────────────────────────────── */

function wireOutputs() {
  $('export-json-btn').addEventListener('click', exportJson);

  $('import-json-btn').addEventListener('click', () => $('import-json-input').click());
  $('import-json-input').addEventListener('change', (ev) => {
    importJsonFile(ev.target.files && ev.target.files[0]);
    ev.target.value = '';    // allow re-importing the same file
  });

  $('share-btn').addEventListener('click', copyShareLink);
  $('print-btn').addEventListener('click', printMat);

  /* Pasting a share link into the address bar of an open tab. */
  window.addEventListener('hashchange', () => {
    const d = parseHash(location.hash);
    if (d) applyDesign(d);
  });

  /* Ctrl+P and File → Print must produce the same mat as the button, so build it
     on any print request rather than only on our own. */
  window.addEventListener('beforeprint', buildPrintMat);
}

function loadFromHash() {
  const d = parseHash(location.hash);
  if (!d) return false;
  const err = applyDesign(d);
  if (err) {
    setShareStatus(`Could not open that link: ${err}`);
    return false;
  }
  return true;
}

document.addEventListener('DOMContentLoaded', () => {
  wireOutputs();
  /* Runs after app.js's own handler, so this replaces the starter template. */
  if (loadFromHash()) {
    $('template-select').value = '';
    setShareStatus('Opened a shared design from the link.');
  }
});
