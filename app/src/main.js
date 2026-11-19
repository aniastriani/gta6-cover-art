// Vice City Nights — the editor.
//
// Wires the controls in index.html to the cover engine in cover.js: photos
// in, layout / grade / size / words chosen, one panel at a time cropped by
// dragging on the preview or with the zoom slider, and the finished cover
// out as a PNG at full post size. A `?shot=` query instead stages a fixed
// scene for a screenshot (see shots.js).

import { POSTER_GRADES, POSTER_LAYOUTS, POSTER_SIZES, paintCover, pointInPanel } from './cover.js';
import { runShotScene } from './shots.js';

const canvas = document.getElementById('cover');
const captionInput = document.getElementById('caption');
const subCaptionInput = document.getElementById('subCaption');
const captionSizeInput = document.getElementById('captionSize');
const captionPosInput = document.getElementById('captionPos');
const zoomInput = document.getElementById('zoom');
const statusLine = document.getElementById('status');

const state = {
  photos: [],
  photoNames: [],
  panels: [],
  layout: 'diagonal',
  grade: 'golden',
  size: 'wide',
  caption: 'Vice City Nights',
  subCaption: 'golden hour, open road',
  captionScale: 1,
  captionShift: 0,
  selected: 0,
};

let panelPolygons = [];

// One slot per panel of the current layout. Slots survive a layout change
// where they can; new ones start on the first photo, unzoomed and centred.
function freshPanels(layoutKey) {
  const count = POSTER_LAYOUTS[layoutKey].panels.length;
  const next = [];
  for (let i = 0; i < count; i += 1) {
    const old = state.panels[i];
    next.push(old ?? { photo: 0, zoom: 1, pan: { x: 0, y: 0 } });
  }
  return next;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

async function loadSample(url) {
  const img = await loadImage(url);
  state.photos = [img];
  state.photoNames = [url.split('/').pop()];
  state.panels = freshPanels(state.layout).map((slot) => ({ ...slot, photo: 0, zoom: 1, pan: { x: 0, y: 0 } }));
  state.selected = 0;
  buildPhotoSlots();
  buildPanelPhotoPick();
  syncZoom();
}

// Loads several samples at once, for a shot scene that fills panels with
// different photos. Panels start on the first photo, unzoomed.
async function loadSamples(urls) {
  const images = [];
  for (const url of urls) images.push(await loadImage(url));
  state.photos = images;
  state.photoNames = urls.map((url) => url.split('/').pop());
  state.panels = freshPanels(state.layout).map((slot) => ({ ...slot, photo: 0, zoom: 1, pan: { x: 0, y: 0 } }));
  state.selected = 0;
  buildPhotoSlots();
  buildPanelPhotoPick();
  syncZoom();
}

// Sets each panel's photo and crop from per-panel lists, for a shot scene.
function assignPanels({ assign, zooms, panx, pany }) {
  state.panels.forEach((slot, i) => {
    if (assign?.[i] !== undefined && !Number.isNaN(assign[i])) slot.photo = assign[i];
    if (zooms?.[i] !== undefined && !Number.isNaN(zooms[i])) slot.zoom = zooms[i];
    if (panx?.[i] !== undefined && !Number.isNaN(panx[i])) slot.pan.x = panx[i];
    if (pany?.[i] !== undefined && !Number.isNaN(pany[i])) slot.pan.y = pany[i];
  });
  syncZoom();
}

// Sizes the preview canvas to the chosen post size (capped at 960 on its
// long side, so the preview stays quick) and repaints.
function repaint() {
  const size = POSTER_SIZES[state.size];
  const scale = 960 / Math.max(size.width, size.height);
  canvas.width = Math.round(size.width * scale);
  canvas.height = Math.round(size.height * scale);
  panelPolygons = paintCover(canvas, {
    photos: state.photos,
    panels: state.panels,
    layout: state.layout,
    grade: state.grade,
    caption: state.caption,
    subCaption: state.subCaption,
    captionScale: state.captionScale,
    captionShift: state.captionShift,
  });
}

function markActive(container, key, value) {
  for (const button of container.querySelectorAll('button')) {
    button.classList.toggle('active', button.dataset[key] === value);
  }
}

function buildPicker(containerId, entries, key, onPick) {
  const container = document.getElementById(containerId);
  container.replaceChildren();
  for (const [value, info] of Object.entries(entries)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset[key] = value;
    button.textContent = info.name ?? info.label;
    button.addEventListener('click', () => {
      onPick(value);
      markActive(container, key, value);
      repaint();
    });
    container.appendChild(button);
  }
  markActive(container, key, state[key]);
}

// The photo chips: a small painted thumbnail, a name, and a remove button.
function buildPhotoSlots() {
  const box = document.getElementById('photoSlots');
  box.replaceChildren();
  state.photos.forEach((photo, i) => {
    const chip = document.createElement('span');
    chip.className = 'photo-chip';
    const thumb = document.createElement('canvas');
    thumb.width = 72;
    thumb.height = 72;
    const tctx = thumb.getContext('2d');
    const scale = Math.max(72 / photo.naturalWidth, 72 / photo.naturalHeight);
    const dw = photo.naturalWidth * scale;
    const dh = photo.naturalHeight * scale;
    tctx.drawImage(photo, (72 - dw) / 2, (72 - dh) / 2, dw, dh);
    chip.appendChild(thumb);
    const name = document.createElement('span');
    name.textContent = state.photoNames[i] ?? `Photo ${i + 1}`;
    chip.appendChild(name);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'ghost small';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      state.photos.splice(i, 1);
      state.photoNames.splice(i, 1);
      for (const slot of state.panels) {
        if (slot.photo === i) slot.photo = 0;
        else if (slot.photo > i) slot.photo -= 1;
      }
      buildPhotoSlots();
      buildPanelPhotoPick();
      repaint();
    });
    chip.appendChild(remove);
    box.appendChild(chip);
  });
  if (state.photos.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'hint';
    empty.textContent = 'No photos yet — add your own or try a sample below.';
    box.appendChild(empty);
  }
}

function buildPanelPick() {
  const box = document.getElementById('panelPick');
  box.replaceChildren();
  state.panels.forEach((_, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.panel = String(i);
    button.textContent = `Panel ${i + 1}`;
    button.addEventListener('click', () => {
      state.selected = i;
      markActive(box, 'panel', String(i));
      buildPanelPhotoPick();
      syncZoom();
    });
    box.appendChild(button);
  });
  markActive(box, 'panel', String(state.selected));
}

function buildPanelPhotoPick() {
  const box = document.getElementById('panelPhotoPick');
  box.replaceChildren();
  const slot = state.panels[state.selected];
  if (!slot) return;
  const choices = state.photos.map((_, i) => ({ label: `Photo ${i + 1}`, value: i }));
  choices.push({ label: 'Empty', value: -1 });
  for (const choice of choices) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.choice = String(choice.value);
    button.textContent = choice.label;
    button.addEventListener('click', () => {
      slot.photo = choice.value;
      slot.zoom = 1;
      slot.pan = { x: 0, y: 0 };
      syncZoom();
      markActive(box, 'choice', String(choice.value));
      repaint();
    });
    box.appendChild(button);
  }
  markActive(box, 'choice', String(slot.photo));
}

function syncZoom() {
  const slot = state.panels[state.selected];
  zoomInput.value = String(slot?.zoom ?? 1);
}

function clampPan(value) {
  return Math.max(-0.5, Math.min(0.5, value));
}

// How much spare photo there is around a panel, in canvas pixels, at the
// panel's zoom — the room a drag has to move in.
function panelSpare(polygon, slot) {
  const photo = state.photos[slot.photo];
  if (!photo) return { x: 0, y: 0 };
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of polygon) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  const base = Math.max((x1 - x0) / photo.naturalWidth, (y1 - y0) / photo.naturalHeight);
  const scale = base * (slot.zoom ?? 1);
  return {
    x: photo.naturalWidth * scale - (x1 - x0),
    y: photo.naturalHeight * scale - (y1 - y0),
  };
}

function hitPanel(clientX, clientY) {
  const box = canvas.getBoundingClientRect();
  const x = ((clientX - box.left) / box.width) * canvas.width;
  const y = ((clientY - box.top) / box.height) * canvas.height;
  for (let i = panelPolygons.length - 1; i >= 0; i -= 1) {
    if (pointInPanel(x, y, panelPolygons[i])) return i;
  }
  return -1;
}

let drag = null;
canvas.addEventListener('pointerdown', (event) => {
  const index = hitPanel(event.clientX, event.clientY);
  if (index < 0) return;
  state.selected = index;
  buildPanelPick();
  buildPanelPhotoPick();
  syncZoom();
  const slot = state.panels[index];
  const polygon = panelPolygons[index];
  const box = canvas.getBoundingClientRect();
  drag = {
    index,
    startX: event.clientX,
    startY: event.clientY,
    pan: { ...slot.pan },
    spare: panelSpare(polygon, slot),
    scaleX: canvas.width / box.width,
    scaleY: canvas.height / box.height,
  };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const slot = state.panels[drag.index];
  const dx = (event.clientX - drag.startX) * drag.scaleX;
  const dy = (event.clientY - drag.startY) * drag.scaleY;
  slot.pan = {
    x: clampPan(drag.pan.x - (drag.spare.x > 0 ? dx / drag.spare.x : 0)),
    y: clampPan(drag.pan.y - (drag.spare.y > 0 ? dy / drag.spare.y : 0)),
  };
  repaint();
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('pointercancel', () => { drag = null; });

document.getElementById('photoFiles').addEventListener('change', async (event) => {
  const files = [...event.target.files].slice(0, 3 - state.photos.length);
  for (const file of files) {
    try {
      const img = await loadImage(URL.createObjectURL(file));
      state.photos.push(img);
      state.photoNames.push(file.name);
    } catch {
      statusLine.textContent = `Could not read ${file.name}.`;
    }
  }
  if (event.target.files.length > files.length) {
    statusLine.textContent = 'Three photos at most — remove one to add another.';
  }
  event.target.value = '';
  buildPhotoSlots();
  buildPanelPhotoPick();
  repaint();
});

document.getElementById('sampleBoulevard').addEventListener('click', async () => {
  await loadSample('samples/boulevard.jpg');
  repaint();
  statusLine.textContent = 'Sample photo loaded: Boulevard.';
});
document.getElementById('samplePier').addEventListener('click', async () => {
  await loadSample('samples/pier.jpg');
  repaint();
  statusLine.textContent = 'Sample photo loaded: Pier.';
});

captionInput.addEventListener('input', () => { state.caption = captionInput.value; repaint(); });
subCaptionInput.addEventListener('input', () => { state.subCaption = subCaptionInput.value; repaint(); });
captionSizeInput.addEventListener('input', () => {
  state.captionScale = Number(captionSizeInput.value);
  repaint();
});
captionPosInput.addEventListener('input', () => {
  state.captionShift = Number(captionPosInput.value);
  repaint();
});
zoomInput.addEventListener('input', () => {
  const slot = state.panels[state.selected];
  if (slot) slot.zoom = Number(zoomInput.value);
  repaint();
});
document.getElementById('centrePanel').addEventListener('click', () => {
  const slot = state.panels[state.selected];
  if (!slot) return;
  slot.zoom = 1;
  slot.pan = { x: 0, y: 0 };
  syncZoom();
  repaint();
});

document.getElementById('export').addEventListener('click', () => {
  const size = POSTER_SIZES[state.size];
  const out = document.createElement('canvas');
  out.width = size.width;
  out.height = size.height;
  paintCover(out, {
    photos: state.photos,
    panels: state.panels,
    layout: state.layout,
    grade: state.grade,
    caption: state.caption,
    subCaption: state.subCaption,
    captionScale: state.captionScale,
    captionShift: state.captionShift,
  });
  out.toBlob((blob) => {
    if (!blob) {
      statusLine.textContent = 'Export did not work in this browser.';
      return;
    }
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `vice-city-nights-${size.width}x${size.height}.png`;
    link.click();
    URL.revokeObjectURL(link.href);
    statusLine.textContent = `Saved vice-city-nights-${size.width}x${size.height}.png`;
  }, 'image/png');
});

// The scene a screenshot asks for: set every choice, load the sample, paint.
const shotApply = {
  async setChoices({ layout, grade, size, caption, sub, captionScale, captionShift }) {
    if (POSTER_LAYOUTS[layout]) {
      state.layout = layout;
      state.panels = freshPanels(layout);
    }
    if (POSTER_GRADES[grade]) state.grade = grade;
    if (POSTER_SIZES[size]) state.size = size;
    state.caption = caption;
    state.subCaption = sub;
    if (captionScale) state.captionScale = Number(captionScale);
    if (captionShift) state.captionShift = Number(captionShift);
    captionInput.value = caption;
    subCaptionInput.value = sub;
    if (captionScale) captionSizeInput.value = String(captionScale);
    if (captionShift) captionPosInput.value = String(captionShift);
    buildPickers();
    buildPanelPick();
    buildPanelPhotoPick();
    syncZoom();
  },
  loadSample,
  loadSamples,
  assignPanels,
  repaint,
};

function buildPickers() {
  buildPicker('layoutPick', POSTER_LAYOUTS, 'layout', (value) => {
    state.layout = value;
    state.panels = freshPanels(value);
    state.selected = 0;
    buildPanelPick();
    buildPanelPhotoPick();
    syncZoom();
  });
  buildPicker('gradePick', POSTER_GRADES, 'grade', (value) => { state.grade = value; });
  buildPicker('sizePick', POSTER_SIZES, 'size', (value) => { state.size = value; });
}

async function start() {
  state.panels = freshPanels(state.layout);
  buildPickers();
  buildPanelPick();
  buildPanelPhotoPick();
  buildPhotoSlots();
  try {
    await Promise.all([
      document.fonts.load('700 100px ViceDisplay'),
      document.fonts.load('italic 40px ViceSerif'),
    ]);
    await document.fonts.ready;
  } catch {
    // The bundled fonts failed to load; the canvas falls back to a
    // system sans-serif for this session and still draws the cover.
  }
  const query = new URLSearchParams(location.search);
  const shot = query.get('shot');
  if (shot) {
    await runShotScene(shot, query, shotApply);
  } else {
    repaint();
  }
}

start();
