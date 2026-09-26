# CLAUDE.md

Personal site of Ruslan Postoiuk — a calm, space-themed business card. Frontend only.
Live at https://lappa17.github.io/ruslan-postoiuk-intro/, deployed from `main` by GitHub Actions.

## Commands

- `npm run dev` → http://localhost:4321/ruslan-postoiuk-intro/
- `npm run build` → `astro check` + static build into `dist/`. CI runs the same script, so a type error blocks the deploy.

## Map

- `src/data/cv.ts` — all content: profile, missions (jobs), skills. Text changes go here.
- `src/components/` — page sections: `About`, `Missions` (curved trajectory at ≥1180px, vertical list below that), `Dossiers` (one `<dialog>` per mission), `Skills` (constellations generated at build time), `Contact` (mailto form), plus `Header`/`TabBar`.
- `src/lib/sky.ts` — canvas sky. The Milky Way and the planet horizon are painted once; twinkles, meteors and click ripples are drawn every frame; parallax is a CSS transform.
- `src/lib/audio.ts` — Web Audio: synthesized effects and the ambient bed. The mute choice is stored in localStorage under `ruslan-postoiuk:sound`.
- `src/lib/app.ts` — wiring: hash routing (`#missions`, and `#missions/<id>` opens that dossier), click/keystroke sounds, skill ↔ star highlight, the contact form.
- `src/styles/global.css` — design tokens on `:root` and every style. Breakpoints: 1179 / 1023 / 767px. Respects `prefers-reduced-motion`.
- `public/` — `Ruslan_Postoiuk_CV.pdf` (behind "Download CV"), favicon, `apple-touch-icon.png`, `og.png` (1200×630 social preview).

## Gotchas

- Keep TypeScript on 6.x: `@astrojs/check` does not support TypeScript 7.
- The site is served under `base: '/ruslan-postoiuk-intro'`. Link files in `public/` through `withBase()` (`src/lib/url.ts`), and reference images from CSS via `src/assets/`, so Vite rewrites the path. A hard-coded `/file` 404s on GitHub Pages.
- Sound starts only after the first click or key press. Browsers forbid autoplay; this is intended, don't try to start audio on load.
- Without JavaScript every section renders stacked; the `js` class on `<html>` switches to tabs. Keep sections readable without JS.
- `og.png` and `apple-touch-icon.png` are generated images built from `src/assets/portrait.jpg`. Regenerate them if the name, title or photo changes.
- The original design lives in a Claude artifact: https://claude.ai/artifact/NC25gyj1vZpWozZiKha2Pb. It is a reference only; the code is the source of truth.

## Workflow

- Commit straight to `main` (personal repo) with conventional prefixes: `feat:`, `fix:`, `docs:`, `chore:`.
- Before pushing, run `npm run build` and check the page in a browser at desktop and phone widths.
