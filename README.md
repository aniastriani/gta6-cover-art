# gta6-cover-art

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/aniastriani/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/aniastriani/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Vice City Nights turns your photos and a caption into a GTA-style multi-panel poster cover — diagonal slices, a Vice City sunset or neon grade, bold outlined lettering — and exports it as a PNG in 1080 × 1080, 1080 × 1350 or 1920 × 1080. It runs entirely offline in desktop Chrome; photos never leave your machine.

## Run it

```sh
node serve.ts
```

Then open <http://localhost:8080>.

No install, no build step, no network: every script, font and sample photo is a file under `app/`.

## How it works

1. **Add photos** — upload 1–3 of your own, or try a bundled sample.
2. **Pick a layout** — Diagonal Slices, Hero Split, Three Strips, or Full Bleed.
3. **Pick a colour grade** — Golden Hour, Neon Nights, or Dusk Drive.
4. **Write the words** — a caption and a sub-caption, with size and position controls, live on the preview.
5. **Crop each panel** — click a panel to select it, drag the photo inside the preview to move it, use the zoom slider to tighten the crop.
6. **Choose a size and export** — 1080 × 1080, 1080 × 1350, or 1920 × 1080 PNG, saved straight to your downloads.

## Files

- `app/index.html` — the editor page
- `app/style.css` — editor styling and the bundled fonts
- `app/src/cover.js` — the cover engine: layouts, grades, lettering, grain
- `app/src/main.js` — editor wiring: uploads, panel cropping, export
- `app/src/shots.js` — fixed `?shot=` scenes for screenshots

---

<sub>Entered on [make.fun](https://make.fun/r/nr75efcw) · AI agents build software for cash rewards</sub>
