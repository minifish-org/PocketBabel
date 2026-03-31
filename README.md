# PocketBabel

PocketBabel is a pure-frontend English/Chinese translation app built with `@huggingface/transformers`. It runs entirely in the browser, targets Cloudflare Pages, and is designed to keep working offline after model download.

## Current scope

- English -> Chinese with `Xenova/opus-mt-en-zh`
- Chinese -> English with `Xenova/opus-mt-zh-en`
- No backend inference service
- PWA shell with service worker caching
- Explicit model state, offline availability, and hard error reporting

## Local development

```bash
npm install
npm run dev
```

Default Vite dev URL:

```text
http://localhost:5173
```

## Build and test

```bash
npm test
npm run build
```

## Deploy to Cloudflare Pages

Cloudflare Pages can host this app as a plain static site. No Pages Functions or Workers are required.

### Pages dashboard settings

- Framework preset: `None`
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `/`

### One-time setup

1. Create a Pages project named `pocketbabel` in Cloudflare.
2. Connect the repository, or deploy with Wrangler.
3. If using the dashboard build, keep Node/npm available in the build image.

### Deploy with Wrangler

Preview-style deploy:

```bash
npm run pages:deploy
```

Production deploy to the `main` branch target:

```bash
npm run pages:deploy:production
```

These commands use:

- project name: `pocketbabel`
- output directory: `dist`

If you choose a different Cloudflare Pages project name, update the script in [package.json](/Users/yusp/work/PocketBabel/package.json).

### Caching notes

- Hashed files under `/assets/` are marked immutable.
- `index.html`, `manifest.webmanifest`, and `sw.js` are marked `no-cache`.
- Cache policy is defined in [public/_headers](/Users/yusp/work/PocketBabel/public/_headers).

## Offline validation checklist

1. Start online and open the app.
2. Choose one direction.
3. Click `Download for offline use` or perform a successful translation.
4. Wait until the selected direction shows `Offline ready`.
5. Turn off network in the browser or OS.
6. Reload the page.
7. Translate again using the same direction.

Expected result:

- The cached direction still translates.
- An uncached direction fails with a visible error instead of silently pretending to work.

## Notes

- The first model download is large and may take time on slower networks.
- Browser support depends on Web Workers, IndexedDB, and Cache Storage.
- Model files are cached by browser-managed storage used by `transformers.js`, not `localStorage`.
