// Writes the extension icons (public/icon/16.png, 32.png, 48.png, 128.png) from tools/icon/bat.svg.
// No image tools: a tiny rasterizer for the SVG subset the logo uses (path with M L H V C Z and arcs, ellipse, circle,
// solid fills, a vertical linear gradient per shape, round-ish strokes), 4 x 4 samples per pixel, and a PNG encoder on
// node:zlib.
//
//   node tools/make-icons.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const root = join(import.meta.dirname, '..');
const svg = readFileSync(join(import.meta.dirname, 'icon', 'bat.svg'), 'utf8');
const SIZES = [16, 32, 48, 128];
const SAMPLES = 4;

// ---------- parsing ----------
const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
const [vx, vy, vw, vh] = attrs(svg.match(/<svg[^>]*>/)[0]).viewBox.split(/\s+/).map(Number);
const gradients = {};
for (const m of svg.matchAll(/<linearGradient([^>]*)>([\s\S]*?)<\/linearGradient>/g)) {
  const stops = [...m[2].matchAll(/<stop[^>]*>/g)].map((s) => attrs(s[0])).map((s) => ({ at: Number(s.offset), color: hex(s['stop-color']) }));
  gradients[attrs(m[1]).id] = stops;
}
function hex(c) {
  const v = c.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
}
const num = /[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi;

/** Flattens a path `d` into closed polygons (arrays of [x, y]). */
function flattenPath(d) {
  const polys = [];
  let poly = null;
  let x = 0, y = 0, sx = 0, sy = 0;
  const tokens = [...d.matchAll(/([MmLlHhVvCcAaZz])([^MmLlHhVvCcAaZz]*)/g)];
  const push = (px, py) => poly.push([px, py]);
  for (const [, cmd, rest] of tokens) {
    const n = (rest.match(num) ?? []).map(Number);
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    if (C === 'Z') {
      if (poly) polys.push(poly);
      poly = null;
      x = sx; y = sy;
      continue;
    }
    const arity = { M: 2, L: 2, H: 1, V: 1, C: 6, A: 7 }[C];
    for (let i = 0; i < n.length; i += arity) {
      const a = n.slice(i, i + arity);
      const bx = rel ? x : 0, by = rel ? y : 0;
      if (C === 'M' && i === 0) {
        if (poly) polys.push(poly);
        x = a[0] + bx; y = a[1] + by; sx = x; sy = y;
        poly = [[x, y]];
      } else if (C === 'M' || C === 'L') {
        x = a[0] + bx; y = a[1] + by; push(x, y);
      } else if (C === 'H') {
        x = a[0] + (rel ? x : 0); push(x, y);
      } else if (C === 'V') {
        y = a[0] + (rel ? y : 0); push(x, y);
      } else if (C === 'C') {
        const [x1, y1, x2, y2, ex, ey] = [a[0] + bx, a[1] + by, a[2] + bx, a[3] + by, a[4] + bx, a[5] + by];
        for (let s = 1; s <= 16; s++) {
          const t = s / 16, u = 1 - t;
          push(u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * ex, u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * ey);
        }
        x = ex; y = ey;
      } else if (C === 'A') {
        const [rx0, ry0, rot, large, sweep] = a;
        const ex = a[5] + bx, ey = a[6] + by;
        for (const p of arcPoints(x, y, rx0, ry0, rot, large, sweep, ex, ey)) push(p[0], p[1]);
        x = ex; y = ey;
      }
    }
  }
  if (poly) polys.push(poly);
  return polys;
}
/** SVG arc (endpoint form) to points, following the SVG spec's centre conversion. */
function arcPoints(x1, y1, rx, ry, rotDeg, large, sweep, x2, y2) {
  const phi = (rotDeg * Math.PI) / 180, cos = Math.cos(phi), sin = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const xp = cos * dx + sin * dy, yp = -sin * dx + cos * dy;
  rx = Math.abs(rx); ry = Math.abs(ry);
  const lambda = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
  if (lambda > 1) { rx *= Math.sqrt(lambda); ry *= Math.sqrt(lambda); }
  const sign = large === sweep ? -1 : 1;
  const k = sign * Math.sqrt(Math.max(0, (rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp) / (rx * rx * yp * yp + ry * ry * xp * xp)));
  const cxp = (k * rx * yp) / ry, cyp = (-k * ry * xp) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2, cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx2, vy2) => Math.atan2(ux * vy2 - uy * vx2, ux * vx2 + uy * vy2);
  const t1 = ang(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
  let dt = ang((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  const out = [];
  for (let s = 1; s <= 32; s++) {
    const t = t1 + (dt * s) / 32;
    out.push([cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos]);
  }
  return out;
}
const ellipsePoly = (cx, cy, rx, ry) => [Array.from({ length: 64 }, (_, i) => [cx + rx * Math.cos((i / 64) * 2 * Math.PI), cy + ry * Math.sin((i / 64) * 2 * Math.PI)])];

const shapes = [];
for (const m of svg.matchAll(/<(path|ellipse|circle)\b[^>]*>/g)) {
  const a = attrs(m[0]);
  const polys =
    m[1] === 'path' ? flattenPath(a.d)
    : m[1] === 'ellipse' ? ellipsePoly(+a.cx, +a.cy, +a.rx, +a.ry)
    : ellipsePoly(+a.cx, +a.cy, +a.r, +a.r);
  const ys = polys.flat().map((p) => p[1]);
  const grad = a.fill?.match(/url\(#(\w+)\)/)?.[1];
  shapes.push({
    polys,
    fill: grad ? { stops: gradients[grad], y0: Math.min(...ys), y1: Math.max(...ys) } : a.fill && a.fill !== 'none' ? hex(a.fill) : null,
    stroke: a.stroke ? hex(a.stroke) : null,
    strokeWidth: Number(a['stroke-width'] ?? 1),
  });
}

// ---------- rasterizing ----------
function inside(polys, px, py) {
  let wind = 0;
  for (const poly of polys) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if (yj <= py) { if (yi > py && (xi - xj) * (py - yj) - (px - xj) * (yi - yj) > 0) wind++; }
      else if (yi <= py && (xi - xj) * (py - yj) - (px - xj) * (yi - yj) < 0) wind--;
    }
  }
  return wind !== 0;
}
function nearEdge(polys, px, py, half) {
  for (const poly of polys) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [ax, ay] = poly[j], [bx, by] = poly[i];
      const ex = bx - ax, ey = by - ay;
      const t = Math.max(0, Math.min(1, ((px - ax) * ex + (py - ay) * ey) / (ex * ex + ey * ey || 1)));
      if (Math.hypot(px - (ax + ex * t), py - (ay + ey * t)) <= half) return true;
    }
  }
  return false;
}
function gradientAt(fill, py) {
  const t = Math.max(0, Math.min(1, (py - fill.y0) / (fill.y1 - fill.y0 || 1)));
  const [a, b] = [fill.stops[0], fill.stops[fill.stops.length - 1]];
  const k = (t - a.at) / (b.at - a.at || 1);
  return a.color.map((c, i) => c + (b.color[i] - c) * Math.max(0, Math.min(1, k)));
}
/** The colour of one sample (premultiplied RGBA, 0 to 1), painting the shapes in order. */
function sample(px, py) {
  let r = 0, g = 0, b = 0, al = 0;
  const over = ([cr, cg, cb]) => {
    r = cr / 255; g = cg / 255; b = cb / 255; al = 1;
  };
  for (const s of shapes) {
    if (s.fill && inside(s.polys, px, py)) over(Array.isArray(s.fill) ? s.fill : gradientAt(s.fill, py));
    if (s.stroke && nearEdge(s.polys, px, py, s.strokeWidth / 2)) over(s.stroke);
  }
  return [r, g, b, al];
}
function render(size) {
  const px = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const ux = vx + ((x + (sx + 0.5) / SAMPLES) / size) * vw;
          const uy = vy + ((y + (sy + 0.5) / SAMPLES) / size) * vh;
          const [cr, cg, cb, ca] = sample(ux, uy);
          r += cr * ca; g += cg * ca; b += cb * ca; a += ca;
        }
      }
      const i = (y * size + x) * 4;
      const n = SAMPLES * SAMPLES;
      px[i + 3] = Math.round((a / n) * 255);
      if (a > 0) {
        px[i] = Math.round((r / a) * 255);
        px[i + 1] = Math.round((g / a) * 255);
        px[i + 2] = Math.round((b / a) * 255);
      }
    }
  }
  return px;
}

// ---------- PNG ----------
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
function png(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0; // no filter
    Buffer.from(rgba.buffer, y * size * 4, size * 4).copy(rows, y * (size * 4 + 1) + 1);
  }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const outDir = join(root, 'public', 'icon');
mkdirSync(outDir, { recursive: true });
for (const size of SIZES) {
  writeFileSync(join(outDir, `${size}.png`), png(size, render(size)));
  console.log(`public/icon/${size}.png`);
}
