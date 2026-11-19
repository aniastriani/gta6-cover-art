// Vice City Nights — the cover engine.
//
// paintCover draws a whole poster onto any canvas: the photo panels of
// the chosen layout (slanted slices included, the GTA multi-panel look),
// a sunset or neon colour grade washed across them, and a title band
// carrying a big bold caption over an italic sub-caption. Plain 2D
// canvas throughout, so the same routine paints both the live preview
// and the full-size PNG export.
//
// Panels are polygons inside the photo zone, written as fractions of
// that zone, which lets a layout mix rectangles with slanted slices.
// Every panel remembers the photo that fills it and how that photo is
// cropped: a zoom factor and a pan offset, driven by dragging on the
// preview or by the panel controls. A panel with no photo gets a painted
// sunset placeholder instead, so the poster still reads before any
// photo is loaded.

export const POSTER_SIZES = {
  square: { label: 'Square 1080 x 1080', width: 1080, height: 1080 },
  portrait: { label: 'Portrait 1080 x 1350', width: 1080, height: 1350 },
  wide: { label: 'Wide 1920 x 1080', width: 1920, height: 1080 },
};

export const POSTER_GRADES = {
  golden: {
    name: 'Golden Hour',
    skyTop: '#ffc25e',
    skyMid: '#ff6a5e',
    skyDeep: '#7e2f7d',
    bandTop: '#2a1130',
    bandBottom: '#12081d',
    accent: '#ffc46b',
    wash: 'rgba(255, 122, 60, 0.22)',
    ink: '#ff8fb5',
  },
  neon: {
    name: 'Neon Nights',
    skyTop: '#ff2e88',
    skyMid: '#8a2ff7',
    skyDeep: '#141a4d',
    bandTop: '#160a24',
    bandBottom: '#07040f',
    accent: '#2ee6ff',
    wash: 'rgba(255, 46, 136, 0.24)',
    ink: '#7fe7ff',
  },
  dusk: {
    name: 'Dusk Drive',
    skyTop: '#7a8cff',
    skyMid: '#3a4fd8',
    skyDeep: '#1b2450',
    bandTop: '#101736',
    bandBottom: '#080b1e',
    accent: '#9fd8ff',
    wash: 'rgba(90, 110, 255, 0.24)',
    ink: '#c9b8ff',
  },
};

// One layout is a name, the height of its title band (a fraction of the
// whole cover) and the panels that tile the photo zone. The diagonal
// layout leans each slice sideways as it runs down the poster.
export const POSTER_LAYOUTS = {
  hero: {
    name: 'Hero Split',
    band: 0.27,
    panels: [
      { points: [[0, 0], [0.66, 0], [0.66, 1], [0, 1]] },
      { points: [[0.66, 0], [1, 0], [1, 0.5], [0.66, 0.5]] },
      { points: [[0.66, 0.5], [1, 0.5], [1, 1], [0.66, 1]] },
    ],
  },
  diagonal: {
    name: 'Diagonal Slices',
    band: 0.27,
    panels: [
      { points: [[0, 0], [0.42, 0], [0.28, 1], [0, 1]] },
      { points: [[0.42, 0], [0.74, 0], [0.6, 1], [0.28, 1]] },
      { points: [[0.74, 0], [1, 0], [1, 1], [0.6, 1]] },
    ],
  },
  strips: {
    name: 'Three Strips',
    band: 0.27,
    panels: [
      { points: [[0, 0], [0.3333, 0], [0.3333, 1], [0, 1]] },
      { points: [[0.3333, 0], [0.6667, 0], [0.6667, 1], [0.3333, 1]] },
      { points: [[0.6667, 0], [1, 0], [1, 1], [0.6667, 1]] },
    ],
  },
  full: {
    name: 'Full Bleed',
    band: 0.3,
    panels: [{ points: [[0, 0], [1, 0], [1, 1], [0, 1]] }],
  },
};

// A small seeded generator, so the film grain is identical on every
// repaint of the same cover instead of shimmering between frames.
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The axis-aligned bounding box of a panel polygon, in canvas pixels.
function panelBox(points) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of points) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// Turns a panel's fraction points into canvas pixels inside the zone.
function toPixels(points, zone) {
  return points.map(([fx, fy]) => [zone.x + fx * zone.w, zone.y + fy * zone.h]);
}

// Traces a polygon path on the context, without filling or stroking it.
function tracePolygon(ctx, polygon) {
  ctx.beginPath();
  ctx.moveTo(polygon[0][0], polygon[0][1]);
  for (let k = 1; k < polygon.length; k += 1) ctx.lineTo(polygon[k][0], polygon[k][1]);
  ctx.closePath();
}

// Ray-casting test: is the canvas point inside this panel polygon?
export function pointInPanel(px, py, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// Covers one panel's bounding box with a photo, at the panel's zoom and
// pan. `pan` is { x, y } in fractions of the spare room, -0.5 to 0.5.
function paintPhotoInto(ctx, photo, box, zoom, pan) {
  const base = Math.max(box.w / photo.naturalWidth, box.h / photo.naturalHeight);
  const scale = base * zoom;
  const drawnW = photo.naturalWidth * scale;
  const drawnH = photo.naturalHeight * scale;
  const spareX = drawnW - box.w;
  const spareY = drawnH - box.h;
  const dx = box.x - spareX * (0.5 + (pan?.x ?? 0));
  const dy = box.y - spareY * (0.5 + (pan?.y ?? 0));
  ctx.drawImage(photo, dx, dy, drawnW, drawnH);
}

// Where a photo is missing, paints a sunset scene in its place: a warm
// sky, a low sun and a dark skyline, so an empty panel still looks like
// poster art.
function paintPlaceholder(ctx, box, grade) {
  const sky = ctx.createLinearGradient(box.x, box.y, box.x, box.y + box.h);
  sky.addColorStop(0, grade.skyTop);
  sky.addColorStop(0.55, grade.skyMid);
  sky.addColorStop(1, grade.skyDeep);
  ctx.fillStyle = sky;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  const sunR = Math.min(box.w, box.h) * 0.22;
  const sunX = box.x + box.w * 0.5;
  const sunY = box.y + box.h * 0.62;
  const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 2.2);
  glow.addColorStop(0, 'rgba(255, 240, 200, 0.9)');
  glow.addColorStop(1, 'rgba(255, 240, 200, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.fillStyle = '#fff3cf';
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(20, 8, 30, 0.85)';
  ctx.beginPath();
  ctx.moveTo(box.x, box.y + box.h);
  ctx.lineTo(box.x + box.w * 0.28, box.y + box.h * 0.78);
  ctx.lineTo(box.x + box.w * 0.55, box.y + box.h);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(box.x + box.w * 0.45, box.y + box.h);
  ctx.lineTo(box.x + box.w * 0.78, box.y + box.h * 0.84);
  ctx.lineTo(box.x + box.w, box.y + box.h);
  ctx.closePath();
  ctx.fill();
}

// Fits the caption onto one line: starts big and shrinks until it fits.
function fitCaptionFont(ctx, text, maxWidth, startSize) {
  let size = startSize;
  ctx.font = `700 ${size}px ViceDisplay, sans-serif`;
  while (size > 24 && ctx.measureText(text).width > maxWidth) {
    size = Math.floor(size * 0.94);
    ctx.font = `700 ${size}px ViceDisplay, sans-serif`;
  }
  return size;
}

// Paints the title band: accent rules, the italic sub-caption, and the
// big caption in a pale-to-accent gradient with a dark outline. The
// caption can be sized and shifted up or down inside the band.
function paintTitleBand(ctx, box, caption, subCaption, grade, captionScale, captionShift) {
  const band = ctx.createLinearGradient(box.x, box.y, box.x, box.y + box.h);
  band.addColorStop(0, grade.bandTop);
  band.addColorStop(1, grade.bandBottom);
  ctx.fillStyle = band;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  const ruleY = box.y + box.h * 0.12;
  const ruleH = Math.max(3, box.h * 0.022);
  ctx.fillStyle = grade.accent;
  ctx.fillRect(box.x + box.w * 0.08, ruleY, box.w * 0.1, ruleH);
  ctx.fillRect(box.x + box.w * 0.82, ruleY, box.w * 0.1, ruleH);

  const shift = (captionShift ?? 0) * box.h * 0.08;
  const words = (subCaption || '').trim();
  if (words) {
    const subSize = Math.max(16, box.h * 0.15);
    ctx.font = `italic ${subSize}px ViceSerif, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = grade.ink;
    ctx.fillText(words, box.x + box.w / 2, box.y + box.h * 0.33 + shift, box.w * 0.84);
  }

  const text = (caption || '').trim().toUpperCase() || 'VICE CITY NIGHTS';
  const size = fitCaptionFont(ctx, text, box.w * 0.88, box.h * 0.52 * (captionScale ?? 1));
  const wordsY = box.y + box.h * (words ? 0.68 : 0.56) + shift;
  const textGrad = ctx.createLinearGradient(0, wordsY - size * 0.55, 0, wordsY + size * 0.45);
  textGrad.addColorStop(0, '#ffffff');
  textGrad.addColorStop(0.55, '#ffe9c4');
  textGrad.addColorStop(1, grade.accent);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(12, 4, 24, 0.9)';
  ctx.lineWidth = Math.max(2, size * 0.07);
  ctx.strokeText(text, box.x + box.w / 2, wordsY);
  ctx.fillStyle = textGrad;
  ctx.fillText(text, box.x + box.w / 2, wordsY);
}

// Sprinkles a little film grain and a dark vignette over the whole cover.
function paintFinish(ctx, w, h) {
  const rand = seededRandom(20261119);
  const dots = Math.floor((w * h) / 2600);
  for (let i = 0; i < dots; i += 1) {
    const light = rand() > 0.5;
    ctx.fillStyle = light ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(rand() * w, rand() * h, 1.6, 1.6);
  }
  const vig = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.42,
    w / 2, h / 2, Math.max(w, h) * 0.72,
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.30)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

// Paints the whole cover for a state:
//   { photos, panels, layout, grade, caption, subCaption, captionScale, captionShift }
// `photos` holds images (or nulls); `panels` holds one { photo, zoom, pan }
// per panel of the layout, where `photo` is an index into `photos`.
// Returns the panel polygons in canvas pixels, so the editor can
// hit-test clicks and drags against them.
export function paintCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const layout = POSTER_LAYOUTS[state.layout] ?? POSTER_LAYOUTS.hero;
  const grade = POSTER_GRADES[state.grade] ?? POSTER_GRADES.golden;

  ctx.fillStyle = '#fdf8f2';
  ctx.fillRect(0, 0, w, h);

  const margin = Math.round(Math.min(w, h) * 0.014);
  const gutter = Math.round(Math.min(w, h) * 0.012);
  const photoZone = {
    x: margin,
    y: margin,
    w: w - margin * 2,
    h: Math.round(h * (1 - layout.band)) - margin - gutter,
  };
  const bandBox = {
    x: margin,
    y: photoZone.y + photoZone.h + gutter,
    w: w - margin * 2,
    h: h - margin - (photoZone.y + photoZone.h + gutter),
  };

  const polygons = layout.panels.map((panel, i) => {
    const polygon = toPixels(panel.points, photoZone);
    const box = panelBox(polygon);
    const slot = state.panels?.[i] ?? { photo: 0, zoom: 1, pan: { x: 0, y: 0 } };
    const photo = state.photos?.[slot.photo] ?? null;
    ctx.save();
    tracePolygon(ctx, polygon);
    ctx.clip();
    if (photo) {
      paintPhotoInto(ctx, photo, box, slot.zoom ?? 1, slot.pan ?? { x: 0, y: 0 });
    } else {
      paintPlaceholder(ctx, box, grade);
    }
    const wash = ctx.createLinearGradient(box.x, box.y, box.x, box.y + box.h);
    wash.addColorStop(0, 'rgba(255, 255, 255, 0)');
    wash.addColorStop(1, grade.wash);
    ctx.fillStyle = wash;
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.restore();
    tracePolygon(ctx, polygon);
    ctx.strokeStyle = 'rgba(20, 8, 30, 0.45)';
    ctx.lineWidth = Math.max(1, gutter * 0.5);
    ctx.stroke();
    return polygon;
  });

  paintTitleBand(ctx, bandBox, state.caption, state.subCaption, grade, state.captionScale, state.captionShift);
  paintFinish(ctx, w, h);

  ctx.strokeStyle = 'rgba(253, 248, 242, 0.85)';
  ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.004);
  ctx.strokeRect(margin / 2, margin / 2, w - margin, h - margin);
  return polygons;
}
