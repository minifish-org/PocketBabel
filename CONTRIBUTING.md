# Contributing

PocketBabel is a small, frontend-only translation app. Contributions should keep the project simple, browser-first, and aligned with the product scope in [AGENTS.md](/Users/yusp/work/PocketBabel/AGENTS.md).

## Before opening a PR

1. Check that the change stays within v1 scope:
   - English <-> Chinese only
   - No backend inference service
   - No account system or cloud sync
2. Prefer small, focused pull requests over broad refactors.
3. Open an issue first if the change affects product scope, architecture, or dependency footprint.

## Development

```bash
npm install
npm run dev
```

## Validation

Run these before opening a pull request:

```bash
npm test
npm run build
```

If your change touches offline behavior, also validate:

1. Download one direction while online.
2. Reload and translate while offline.
3. Verify an uncached direction fails with a visible error.

## Design and product constraints

- Keep the app self-explanatory. Avoid adding explanatory UI text unless it is necessary for a user decision.
- Keep translation as the primary task flow.
- Do not introduce server-side dependencies for v1.
- Avoid adding dependencies unless they are clearly justified.

## Pull request guidelines

- Describe the user-facing change clearly.
- Call out any tradeoffs or known limitations.
- Include screenshots for UI changes when possible.
- Keep copy concise and product-facing, not implementation-facing.

## Code style

- Prefer readable, modular code over premature abstraction.
- Keep side effects isolated.
- Preserve static-site compatibility for Cloudflare Pages.
