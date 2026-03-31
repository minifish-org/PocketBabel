# AGENTS.md

## Project Intent

Build a pure-frontend English/Chinese translation web app using `transformers.js`, deployable on Cloudflare Pages, with offline support as a PWA.

Project name (working): `PocketBabel`

## Scope (Hard Constraints)

- Support only bidirectional Chinese/English translation:
  - English -> Chinese
  - Chinese -> English
- No backend inference service.
- No user accounts or cloud sync in v1.
- Must run on desktop and mobile browsers.
- Must support offline usage after model download.
- Failures must surface as explicit user-visible errors; do not silently fall back, fake readiness, or hide partial failure states.

## Model Policy

Use direction-specific models (single-direction MT models):

- `Xenova/opus-mt-en-zh`
- `Xenova/opus-mt-zh-en`

Reason: smaller and more practical for browser/mobile than large multilingual models.

Do not switch to `m2m100`/`nllb` in v1 unless explicitly requested.

## Runtime and Caching

- Use `@huggingface/transformers` in-browser pipeline for translation.
- Persist model assets in browser storage (IndexedDB / underlying cache used by the runtime).
- Do not rely on `localStorage` for model files.
- App shell must be PWA-cached via Service Worker.
- Treat model cache state and app shell cache state as separate concerns in code and UI.
- Do not report `ready` unless the selected direction's model assets are actually available for inference in the current browser profile.

Offline contract:

1. First run requires network to download model files.
2. After successful download for a direction, translation for that direction must work offline on the same device/browser profile.
3. Offline support must be validated by reloading the app while offline and performing a translation successfully.
4. If required model assets are missing, corrupted, or inaccessible, the app must enter a non-ready state and show an explicit error.

Cache clearing contract:

1. The app may expose a manual clear action only for caches it can reliably delete.
2. The clear action must be defined as clearing this app's known model/cache data and resetting state; do not claim that all browser storage everywhere is removed unless that is verifiably true.
3. If cache clearing fails, report the failure explicitly.

## Deployment

- Host as static site on Cloudflare Pages.
- No server-side compute requirement.
- Keep build output and static asset paths compatible with Pages.
- Prefer a zero-SSR, static-export frontend architecture for v1.
- Service Worker, manifest, and asset URLs must work correctly when served as static files from Pages.
- Do not introduce a runtime dependency on Cloudflare Workers, Pages Functions, or any server-only feature in v1.

## UX Requirements (v1)

- Language direction selector with quick swap.
- Direction selection is explicit user choice in v1; do not auto-detect and auto-switch language direction.
- Text input and translated output.
- Visible model state:
  - not downloaded
  - downloading (progress if possible)
  - ready/offline available for current direction
  - error
- Show which direction is available offline; do not imply both directions are ready unless both models are present.
- Manual "clear downloaded models" action, limited to app-managed caches that can be reliably cleared.
- Any load, download, inference, or cache-clear failure must produce a clear, user-visible error message.

## Performance Budgets

- Prefer quantized defaults for browser/WASM.
- Keep first meaningful interaction fast before model is ready.
- Avoid blocking UI during model load/inference.
- Handle low-memory devices gracefully with clear error messages.
- Keep download, load, and inference work off the main interaction path where possible.
- If a device cannot load a model because of memory or browser capability limits, fail clearly instead of retrying indefinitely.

## Quality Bar

- Code should be modular and readable.
- Keep side effects isolated (model loading, cache operations).
- Add lightweight tests for direction routing and state transitions when test harness exists.
- Cover explicit direction behavior for English, Chinese, mixed-script input, empty input, and swap behavior when test harness exists.
- Avoid adding dependencies unless needed.

## Out of Scope (v1)

- OCR, speech, camera translation.
- Multi-language support beyond English/Chinese.
- Glossary/history sync across devices.
- Auth, billing, analytics-heavy instrumentation.

## Agent Execution Notes

When making changes, keep this sequence:

1. Preserve v1 scope (zh/en only).
2. Keep app fully frontend and Pages-compatible.
3. Verify offline behavior assumptions before expanding features.
4. Prefer incremental, testable changes over large refactors.
