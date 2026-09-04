/*
 * app.js — state, editor, image pipeline, inventory.
 *
 * Plain globals, no modules, no build step: this file has to work when index.html
 * is opened as a file:// URL, which rules out fetch() and ES module imports.
 */

'use strict';

/* ── State ─────────────────────────────────────────────────────── */

const state = {
  cols: 10,
  rows: 10,
  cells: [],          // flat array of length cols*rows, each a palette code or "."
  name: '',
  activeCode: 'R',    // colour laid down by clicking
};

const UNDO_LIMIT = 60;
const undoStack = [];

const $ = (id) => document.getElementById(id);

function idx(x, y) { return y * state.cols + x; }
function blankCells(cols, rows) { return new Array(cols * rows).fill(EMPTY_CODE); }

/* ── Template validation ───────────────────────────────────────

   Run at load so a malformed template — most likely from someone adding a design
   by pull request — surfaces immediately in a banner instead of quietly producing
   a broken grid. */

function validateTemplates() {
  const problems = [];
  const validCodes = new Set(PALETTE.map((c) => c.code));
  validCodes.add(EMPTY_CODE);
  const seenIds = new Set();

  TEMPLATES.forEach((t, n) => {
    const where = `Template "${t.name || t.id || '#' + n}"`;

    if (!t.id) problems.push(`${where}: missing id.`);
    else if (seenIds.has(t.id)) problems.push(`${where}: duplicate id "${t.id}".`);
    seenIds.add(t.id);

    if (!Array.isArray(t.cells)) {
      problems.push(`${where}: cells must be an array of row strings.`);
      return;
    }
    if (t.cells.length !== t.rows) {
      problems.push(`${where}: declares rows=${t.rows} but has ${t.cells.length} row strings.`);
    }
    t.cells.forEach((row, i) => {
      if (typeof row !== 'string') {
        problems.push(`${where}: row ${i} is not a string.`);
        return;
      }
      if (row.length !== t.cols) {
        problems.push(`${where}: row ${i} is ${row.length} characters, expected cols=${t.cols}.`);
      }
      for (const ch of row) {
        if (!validCodes.has(ch)) {
          problems.push(`${where}: row ${i} contains "${ch}", which is not a palette code or ".".`);
          break;
        }
      }
    });
  });

  return problems;
}

function showWarnings(list) {
  const box = $('warnings');
  if (!list.length) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML =
    '<strong>Some templates could not be loaded correctly:</strong><ul>' +
    list.map((p) => `<li>${escapeHtml(p)}</li>`).join('') +
    '</ul>';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ── Cube counting ─────────────────────────────────────────────── */

function countCubes(cells) {
  const counts = new Map();
  for (const code of cells) {
    if (code === EMPTY_CODE) continue;
    counts.set(code, (counts.get(code) || 0) + 1);
  }
  return counts;
}

function totalCubes(cells) {
  let n = 0;
  for (const code of cells) if (code !== EMPTY_CODE) n++;
  return n;
}

/* ── Template dropdown ─────────────────────────────────────────── */

function buildTemplateDropdown() {
  const sel = $('template-select');
  const groups = new Map();

  for (const t of TEMPLATES) {
    const key = t.group || 'Templates';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }

  for (const [groupName, items] of groups) {
    const og = document.createElement('optgroup');
    og.label = groupName;
    for (const t of items) {
      const opt = document.createElement('option');
      opt.value = t.id;
      /* Cube count in the label so it's obvious whether a table has enough. */
      opt.textContent = `${t.name} — ${totalCubes(t.cells.join(''))} cubes`;
      og.appendChild(opt);
    }
    sel.appendChild(og);
  }
}

/* ── Grid rendering ────────────────────────────────────────────── */

function cellPx() {
  /* Keep a 10-wide grid comfortable without making a 5-wide one enormous. */
  return Math.max(26, Math.min(46, Math.floor(460 / state.cols)));
}

function renderGrid() {
  const grid = $('grid');
  grid.style.gridTemplateColumns = `repeat(${state.cols}, ${cellPx()}px)`;
  grid.style.setProperty('--cell-px', cellPx() + 'px');
  grid.innerHTML = '';

  for (let y = 0; y < state.rows; y++) {
    for (let x = 0; x < state.cols; x++) {
      const i = idx(x, y);
      const code = state.cells[i];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cell ' + (code === EMPTY_CODE ? 'empty' : 'filled');
      btn.dataset.i = String(i);
      if (code !== EMPTY_CODE) {
        const cube = PALETTE_BY_CODE[code];
        btn.style.background = cube.hex;
        btn.title = `${cube.name} (${code}) — row ${y + 1}, column ${x + 1}`;
        btn.setAttribute('aria-label', `Row ${y + 1} column ${x + 1}: ${cube.name}`);
      } else {
        btn.title = `empty — row ${y + 1}, column ${x + 1}`;
        btn.setAttribute('aria-label', `Row ${y + 1} column ${x + 1}: empty`);
      }
      grid.appendChild(btn);
    }
  }
  updateInventory();
}

/* Repaint one cell without rebuilding the whole grid — keeps dragging smooth. */
function refreshCell(i) {
  const btn = $('grid').querySelector(`[data-i="${i}"]`);
  if (!btn) return;
  const code = state.cells[i];
  btn.className = 'cell ' + (code === EMPTY_CODE ? 'empty' : 'filled');
  if (code === EMPTY_CODE) {
    btn.style.background = '';
    btn.title = 'empty';
  } else {
    const cube = PALETTE_BY_CODE[code];
    btn.style.background = cube.hex;
    btn.title = `${cube.name} (${code})`;
  }
}

/* ── Editing ───────────────────────────────────────────────────── */

function pushUndo() {
  undoStack.push({ cols: state.cols, rows: state.rows, cells: state.cells.slice() });
  if (undoStack.length > UNDO_LIMIT) undoStack.shift();
}

function undo() {
  const prev = undoStack.pop();
  if (!prev) return;
  state.cols = prev.cols;
  state.rows = prev.rows;
  state.cells = prev.cells;
  syncSizeSelect();
  renderGrid();
}

function paintCell(i, code) {
  if (i < 0 || i >= state.cells.length) return;
  if (state.cells[i] === code) return;
  state.cells[i] = code;
  refreshCell(i);
  updateInventory();
}

function setActiveCode(code) {
  state.activeCode = code;
  for (const el of $('swatches').children) {
    el.setAttribute('aria-checked', String(el.dataset.code === code));
  }
}

function buildSwatches() {
  const wrap = $('swatches');
  wrap.innerHTML = '';

  const entries = PALETTE.map((c, n) => ({
    code: c.code,
    label: c.name,
    hex: c.hex,
    key: String((n + 1) % 10),           // 1–9 then 0
  }));
  entries.push({ code: EMPTY_CODE, label: 'eraser (empty)', hex: null, key: 'E' });

  for (const e of entries) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch' + (e.hex ? '' : ' swatch-empty');
    b.dataset.code = e.code;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(e.code === state.activeCode));
    b.title = `${e.label} — press ${e.key}`;
    if (e.hex) {
      b.style.background = e.hex;
      b.style.color = inkOn(e.hex);
    }
    b.innerHTML =
      `<span>${e.code === EMPTY_CODE ? '⌫' : e.code}</span>` +
      `<span class="swatch-key">${e.key}</span>`;
    b.addEventListener('click', () => setActiveCode(e.code));
    wrap.appendChild(b);
  }
}

function wireGridPainting() {
  const grid = $('grid');
  let painting = false;

  const cellIndexFrom = (target) => {
    if (!target || !target.dataset || target.dataset.i === undefined) return -1;
    return Number(target.dataset.i);
  };

  grid.addEventListener('pointerdown', (ev) => {
    const i = cellIndexFrom(ev.target);
    if (i < 0) return;
    ev.preventDefault();
    pushUndo();
    painting = true;
    /* Right button erases. */
    paintCell(i, ev.button === 2 ? EMPTY_CODE : state.activeCode);
  });

  grid.addEventListener('pointerover', (ev) => {
    if (!painting) return;
    const i = cellIndexFrom(ev.target);
    if (i < 0) return;
    paintCell(i, (ev.buttons & 2) ? EMPTY_CODE : state.activeCode);
  });

  /* Right-click must not open the browser menu over the grid. */
  grid.addEventListener('contextmenu', (ev) => {
    if (cellIndexFrom(ev.target) >= 0) ev.preventDefault();
  });

  window.addEventListener('pointerup', () => { painting = false; });
  window.addEventListener('pointercancel', () => { painting = false; });
}

function wireKeyboard() {
  window.addEventListener('keydown', (ev) => {
    const tag = (ev.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;

    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') {
      ev.preventDefault();
      undo();
      return;
    }
    if (ev.key === 'e' || ev.key === 'E' || ev.key === 'Backspace') {
      ev.preventDefault();
      setActiveCode(EMPTY_CODE);
      return;
    }
    if (/^[0-9]$/.test(ev.key)) {
      const n = ev.key === '0' ? 9 : Number(ev.key) - 1;
      if (PALETTE[n]) setActiveCode(PALETTE[n].code);
    }
  });
}

/* ── Resizing ──────────────────────────────────────────────────── */

/* Keep the existing design centred when the grid size changes, so switching
   5×6 → 10×10 does not throw away work. */
function resizeGrid(cols, rows) {
  const next = blankCells(cols, rows);
  const dx = Math.floor((cols - state.cols) / 2);
  const dy = Math.floor((rows - state.rows) / 2);

  for (let y = 0; y < state.rows; y++) {
    for (let x = 0; x < state.cols; x++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      next[ny * cols + nx] = state.cells[idx(x, y)];
    }
  }

  state.cols = cols;
  state.rows = rows;
  state.cells = next;
}

function syncSizeSelect() {
  $('grid-size').value = `${state.cols}x${state.rows}`;
}

/* ── Loading a template ────────────────────────────────────────── */

function loadTemplate(id) {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) return;
  pushUndo();
  state.cols = t.cols;
  state.rows = t.rows;
  state.cells = t.cells.join('').split('');
  state.name = t.name;
  $('design-name').value = t.name;
  syncSizeSelect();
  renderGrid();
}

/* ── Image → grid ──────────────────────────────────────────────── */

const MAX_SAMPLE_EDGE = 700;   // cap source resolution; plenty for mode sampling

function imageToCells(img) {
  const { cols, rows } = state;

  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  const shrink = Math.min(1, MAX_SAMPLE_EDGE / Math.max(w, h));
  w = Math.max(cols, Math.round(w * shrink));
  h = Math.max(rows, Math.round(h * shrink));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  /* Smoothing off: interpolation would invent blended colours at every colour
     boundary, which is exactly what taking the mode is meant to avoid. */
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const data = ctx.getImageData(0, 0, w, h).data;
  const whiteAsEmpty = $('white-empty').checked;
  const cells = new Array(cols * rows);

  for (let ry = 0; ry < rows; ry++) {
    const y0 = Math.floor((ry * h) / rows);
    const y1 = Math.max(y0 + 1, Math.floor(((ry + 1) * h) / rows));
    for (let rx = 0; rx < cols; rx++) {
      const x0 = Math.floor((rx * w) / cols);
      const x1 = Math.max(x0 + 1, Math.floor(((rx + 1) * w) / cols));

      const m = modeColorInRegion(data, w, x0, y0, x1, y1, { whiteAsEmpty });
      /* A cell that is mostly transparent (or mostly page-white, when that option
         is on) becomes a genuine hole rather than a nearest-colour guess. */
      cells[ry * cols + rx] =
        m.transparentRatio > 0.5 ? EMPTY_CODE : nearestCubeCode(m.r, m.g, m.b);
    }
  }
  return cells;
}

function handleImageFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      pushUndo();
      state.cells = imageToCells(img);
      if (!$('design-name').value) {
        state.name = file.name.replace(/\.[^.]+$/, '');
        $('design-name').value = state.name;
      }
      renderGrid();
    };
    img.onerror = () => showWarnings(['That file could not be read as an image.']);
    img.src = reader.result;
  };
  reader.onerror = () => showWarnings(['That file could not be read.']);
  reader.readAsDataURL(file);
}

/* ── Inventory ─────────────────────────────────────────────────── */

function updateInventory() {
  const counts = countCubes(state.cells);
  const list = $('inventory');
  list.innerHTML = '';

  const ordered = PALETTE
    .filter((c) => counts.get(c.code))
    .sort((a, b) => counts.get(b.code) - counts.get(a.code));

  if (!ordered.length) {
    list.innerHTML = '<li class="hint">No cubes yet — pick a template or paint some cells.</li>';
    $('inventory-total').textContent = '';
    return;
  }

  for (const cube of ordered) {
    const li = document.createElement('li');
    li.innerHTML =
      `<span class="inv-chip" style="background:${cube.hex}"></span>` +
      `<span>${cube.name}</span>` +
      `<span class="inv-count">${counts.get(cube.code)}</span>`;
    list.appendChild(li);
  }

  const total = totalCubes(state.cells);
  const holes = state.cells.length - total;
  $('inventory-total').textContent =
    `${total} cubes total · ${holes} empty cell${holes === 1 ? '' : 's'}`;
}

/* ── Wiring ────────────────────────────────────────────────────── */

function wireControls() {
  $('template-select').addEventListener('change', (ev) => {
    if (ev.target.value) loadTemplate(ev.target.value);
  });

  $('image-input').addEventListener('change', (ev) => {
    handleImageFile(ev.target.files && ev.target.files[0]);
  });

  $('grid-size').addEventListener('change', (ev) => {
    const [c, r] = ev.target.value.split('x').map(Number);
    pushUndo();
    resizeGrid(c, r);
    renderGrid();
  });

  $('design-name').addEventListener('input', (ev) => { state.name = ev.target.value; });

  $('undo-btn').addEventListener('click', undo);

  $('clear-btn').addEventListener('click', () => {
    pushUndo();
    state.cells = blankCells(state.cols, state.rows);
    renderGrid();
  });

  $('fill-btn').addEventListener('click', () => {
    pushUndo();
    for (let i = 0; i < state.cells.length; i++) {
      if (state.cells[i] === EMPTY_CODE) state.cells[i] = state.activeCode;
    }
    renderGrid();
  });
}

/* ── Boot ──────────────────────────────────────────────────────── */

function init() {
  showWarnings(validateTemplates());
  buildTemplateDropdown();
  buildSwatches();
  state.cells = blankCells(state.cols, state.rows);

  wireControls();
  wireGridPainting();
  wireKeyboard();

  /* Something on screen to start with. outputs.js runs after this and replaces it
     if the URL carries a shared design. */
  loadTemplate('pumpkin');
  $('template-select').value = 'pumpkin';

  renderGrid();
}

document.addEventListener('DOMContentLoaded', init);
