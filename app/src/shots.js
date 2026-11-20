// Canned screenshot scenes, picked by the page's query string.
//
// A cover shot hides the controls and draws one poster full-bleed at
// export size:
//
//   ?shot=cover&photo=pier&caption=Pier%20Pressure&layout=diagonal&grade=neon&size=portrait
//
// An editor shot keeps the controls visible with a sample photo loaded:
//
//   ?shot=editor&photo=boulevard&caption=Boulevard%20Queen
//
// Query knobs: `photo` names a single sample under samples/ (boulevard
// or pier); `photos` names several, comma-separated, while `assign`
// chooses which photo fills each panel and `zooms`, `panx`, `pany` crop
// each panel. `caption` and `sub` set the words, `cscale` and `cshift`
// size and shift the caption, and `layout`, `grade`, `size` pick the
// look. The caller hands in an `apply` object that knows how to load
// samples and set each choice. Once the scene is painted,
// window.__shotReady is raised after two animation frames, so a
// headless screenshot waits until the paint has landed.

// Pulls a comma-separated list of numbers out of the query string,
// returning null when the parameter is not there at all.
function readNumberList(query, key) {
  const raw = query.get(key);
  if (!raw) return null;
  const out = [];
  for (const piece of raw.split(',')) out.push(Number(piece));
  return out;
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
