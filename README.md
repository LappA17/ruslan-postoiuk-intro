# ruslan-postoiuk-intro

The personal site of Ruslan Postoiuk — a calm, space-themed business card. Frontend only, no backend.

**Live:** https://lappa17.github.io/ruslan-postoiuk-intro/

## What's inside

- **Astro 7 + TypeScript**, static output. No UI framework ships to the browser.
- `src/lib/sky.ts` — the night sky on canvas: a procedural Milky Way, twinkling stars, shooting stars, a planet horizon with city lights, and gentle parallax.
- `src/lib/audio.ts` — every sound is synthesized with the Web Audio API, no audio files: clicks, keystrokes, dossier "warps" and a quiet ambient bed. Browsers only allow sound after the first click; the toggle is remembered, and the ambient fades out when the tab is hidden.
- `src/data/cv.ts` — all content: missions, skills, contacts. Edit this file to update the site.
- `public/Ruslan_Postoiuk_CV.pdf` — the file behind **Download CV**. Replace it to publish a new CV.

Motion respects `prefers-reduced-motion`, and every section is readable without JavaScript.

## Develop

```bash
npm install
npm run dev     # http://localhost:4321/ruslan-postoiuk-intro/
npm run build   # type-check + static build into dist/
```

## Deploy

Every push to `main` type-checks, builds and publishes the site to GitHub Pages through `.github/workflows/deploy.yml`.

### Custom domain

1. Buy a domain and point it at GitHub Pages: four `A` records on the apex to `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`, and a `CNAME` record for `www` to `lappa17.github.io`.
2. Add `public/CNAME` containing the bare domain, e.g. `ruslanpostoiuk.dev`.
3. In `astro.config.mjs`, set `site` to `https://<domain>` and `base` to `'/'`.
4. In the repository, open Settings → Pages, enter the domain and enable **Enforce HTTPS**.
