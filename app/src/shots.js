// Fixed scenes for screenshots, driven by the page's query string.
//
//   ?shot=cover&photo=pier&caption=Pier%20Pressure&layout=diagonal&grade=neon&size=portrait
//     draws one cover full-bleed, at the export size, with the controls hidden.
//   ?shot=editor&photo=boulevard&caption=Boulevard%20Queen
//     shows the editor with a sample photo already loaded.
//
// `photo` names one sample under samples/ (boulevard or pier); `photos`
// names several, comma-separated, and `assign` says which photo fills
// each panel, with `zooms`, `panx` and `pany` cropping each panel.
// `caption` and `sub` set the words; `cscale` and `cshift` size and shift
// the caption. `layout`, `grade` and `size` pick the look. The caller
// supplies an `apply` object that knows how to load samples and set each
// choice; once the scene is painted, window.__shotReady is raised on two
// animation frames so a headless screenshot waits for the paint.

// Reads a comma-separated list of numbers out of the query string,
// or null when the parameter is absent.
function readNumberList(query, key) {
  const raw = query.get(key);
  if (!raw) return null;
  return raw.split(',').map((part) => Number(part));
}

export async function runShotScene(shot, query, apply) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const caption = query.get('caption') ?? 'Vice City Nights';
  const sub = query.get('sub') ?? '';
  const layout = query.get('layout') ?? 'diagonal';
  const grade = query.get('grade') ?? 'golden';
  const size = query.get('size') ?? 'wide';
  const photo = query.get('photo') ?? 'pier';
  const captionScale = query.get('cscale') ?? null;
  const captionShift = query.get('cshift') ?? null;
  await apply.setChoices({ layout, grade, size, caption, sub, captionScale, captionShift });
  const photos = query.get('photos');
  if (photos) {
    await apply.loadSamples(photos.split(',').map((name) => `samples/${name.trim()}.jpg`));
    const assign = readNumberList(query, 'assign');
    const zooms = readNumberList(query, 'zooms');
    const panx = readNumberList(query, 'panx');
    const pany = readNumberList(query, 'pany');
    if (assign || zooms || panx || pany) apply.assignPanels({ assign, zooms, panx, pany });
  } else {
    await apply.loadSample(`samples/${photo}.jpg`);
  }
  apply.repaint();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
