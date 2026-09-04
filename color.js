/*
 * color.js — colour science for cube matching.
 *
 * Two deliberate choices here, both of which matter for how the finished mosaic
 * actually looks:
 *
 *  1. Per-cell colour is the MODE (most common colour in the cell), not the mean.
 *     The source art is flat-colour pixel art. Averaging a cell that straddles a
 *     red/black boundary yields a muddy maroon that exists nowhere in the picture
 *     and matches no cube. The mode picks whichever flat colour actually dominates.
 *
 *  2. Cube matching is done in CIELAB with CIEDE2000 distance, not RGB distance.
 *     RGB distance is perceptually wrong — it will happily swap a mid-blue for a
 *     purple because they are numerically close while looking nothing alike.
 *
 * There is no dithering anywhere, on purpose: a dithered checkerboard is
 * unbuildable by a five-year-old.
 */

/* ── sRGB → CIELAB ─────────────────────────────────────────────── */

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/* Undo the sRGB transfer function to get linear light. */
function srgbToLinear(v) {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/* Linear sRGB → CIEXYZ under the D65 white point. */
function rgbToXyz(r, g, b) {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  return [
    R * 0.4124564 + G * 0.3575761 + B * 0.1804375,
    R * 0.2126729 + G * 0.7151522 + B * 0.0721750,
    R * 0.0193339 + G * 0.1191920 + B * 0.9503041,
  ];
}

const D65 = [0.95047, 1.0, 1.08883];

function xyzToLab(x, y, z) {
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
  const fx = f(x / D65[0]), fy = f(y / D65[1]), fz = f(z / D65[2]);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function rgbToLab(r, g, b) {
  const [x, y, z] = rgbToXyz(r, g, b);
  return xyzToLab(x, y, z);
}

function hexToLab(hex) {
  return rgbToLab(...hexToRgb(hex));
}

/* ── CIEDE2000 ─────────────────────────────────────────────────── */

const DEG = Math.PI / 180;
const POW25_7 = Math.pow(25, 7);

function hueDeg(b, a) {
  if (a === 0 && b === 0) return 0;
  const d = Math.atan2(b, a) / DEG;
  return d >= 0 ? d : d + 360;
}

/**
 * Perceptual distance between two CIELAB colours.
 * Smaller is more similar; roughly, <2 is "indistinguishable to most people".
 */
function deltaE2000(lab1, lab2) {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;

  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const Cbar7 = Math.pow(Cbar, 7);
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + POW25_7)));

  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const h1p = hueDeg(b1, a1p);
  const h2p = hueDeg(b2, a2p);

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * DEG) / 2);

  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;

  let hbarp;
  if (C1p * C2p === 0) {
    hbarp = h1p + h2p;
  } else if (Math.abs(h1p - h2p) <= 180) {
    hbarp = (h1p + h2p) / 2;
  } else if (h1p + h2p < 360) {
    hbarp = (h1p + h2p + 360) / 2;
  } else {
    hbarp = (h1p + h2p - 360) / 2;
  }

  const T = 1
    - 0.17 * Math.cos((hbarp - 30) * DEG)
    + 0.24 * Math.cos((2 * hbarp) * DEG)
    + 0.32 * Math.cos((3 * hbarp + 6) * DEG)
    - 0.20 * Math.cos((4 * hbarp - 63) * DEG);

  const dTheta = 30 * Math.exp(-Math.pow((hbarp - 275) / 25, 2));
  const Cbarp7 = Math.pow(Cbarp, 7);
  const RC = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + POW25_7));

  const SL = 1 + (0.015 * Math.pow(Lbarp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbarp - 50, 2));
  const SC = 1 + 0.045 * Cbarp;
  const SH = 1 + 0.015 * Cbarp * T;
  const RT = -Math.sin((2 * dTheta) * DEG) * RC;

  const tL = dLp / SL;
  const tC = dCp / SC;
  const tH = dHp / SH;

  return Math.sqrt(tL * tL + tC * tC + tH * tH + RT * tC * tH);
}

/* ── Palette matching ──────────────────────────────────────────── */

/* Precomputed once — the palette never changes at runtime. */
const PALETTE_LAB = PALETTE.map((c) => ({ code: c.code, lab: hexToLab(c.hex) }));

/** Nearest cube colour to an RGB triple. Returns a palette letter code. */
function nearestCubeCode(r, g, b) {
  const lab = rgbToLab(r, g, b);
  let best = PALETTE_LAB[0].code;
  let bestD = Infinity;
  for (const entry of PALETTE_LAB) {
    const d = deltaE2000(lab, entry.lab);
    if (d < bestD) {
      bestD = d;
      best = entry.code;
    }
  }
  return best;
}

/** Perceived lightness 0–100, used to pick readable text on a swatch. */
function lightnessOfHex(hex) {
  return hexToLab(hex)[0];
}

/** Black or white ink, whichever stays legible on the given cube colour. */
function inkOn(hex) {
  return lightnessOfHex(hex) > 60 ? '#000000' : '#ffffff';
}

/* ── Mode colour extraction ────────────────────────────────────── */

/*
 * Colours are bucketed to 5 bits per channel before counting. Antialiased edges
 * in the source produce a long tail of near-identical one-off colours; bucketing
 * collapses those onto the flat colour they came from so the mode is stable.
 * The winning bucket then reports its own most common exact colour, so the value
 * handed to the matcher is a real pixel from the image, never a blend.
 */
const BUCKET_SHIFT = 3; // 8 → 5 bits per channel

/**
 * Most common colour in a rectangular region of an ImageData.
 * Returns { r, g, b, transparentRatio } — or null if the region is empty.
 */
function modeColorInRegion(data, imgW, x0, y0, x1, y1, opts) {
  const options = opts || {};
  const alphaCutoff = options.alphaCutoff != null ? options.alphaCutoff : 128;
  const whiteAsEmpty = !!options.whiteAsEmpty;

  const buckets = new Map();   // bucket key → { count, exact: Map }
  let total = 0;
  let skipped = 0;             // transparent, or near-white when that's enabled

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * imgW + x) * 4;
      const a = data[i + 3];
      total++;

      if (a < alphaCutoff) { skipped++; continue; }

      const r = data[i], g = data[i + 1], b = data[i + 2];

      if (whiteAsEmpty && isNearWhite(r, g, b)) { skipped++; continue; }

      const key = ((r >> BUCKET_SHIFT) << 10) | ((g >> BUCKET_SHIFT) << 5) | (b >> BUCKET_SHIFT);
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { count: 0, exact: new Map() };
        buckets.set(key, bucket);
      }
      bucket.count++;
      const exactKey = (r << 16) | (g << 8) | b;
      bucket.exact.set(exactKey, (bucket.exact.get(exactKey) || 0) + 1);
    }
  }

  const transparentRatio = total === 0 ? 1 : skipped / total;

  let winner = null;
  let winnerCount = 0;
  for (const bucket of buckets.values()) {
    if (bucket.count > winnerCount) {
      winnerCount = bucket.count;
      winner = bucket;
    }
  }
  if (!winner) return { r: 0, g: 0, b: 0, transparentRatio };

  /* Most common exact colour inside the winning bucket. */
  let exactKey = 0;
  let exactCount = 0;
  for (const [k, n] of winner.exact) {
    if (n > exactCount) { exactCount = n; exactKey = k; }
  }

  return {
    r: (exactKey >> 16) & 255,
    g: (exactKey >> 8) & 255,
    b: exactKey & 255,
    transparentRatio,
  };
}

/* Light and unsaturated enough to read as page-white rather than as a cube. */
function isNearWhite(r, g, b) {
  const [L, a, bb] = rgbToLab(r, g, b);
  return L > 90 && Math.hypot(a, bb) < 10;
}
