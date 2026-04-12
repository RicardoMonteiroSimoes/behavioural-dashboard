# Behavioural Dashboard

Framework-agnostic TypeScript engine for self-adapting UI layouts based on user behaviour. Zero runtime dependencies, ships no CSS.

## Architecture

- `src/engine.ts` — Core `BehaviouralEngine` class: zero-sum budget scoring, proportional drain, weight-based variant resolution
- `src/state.ts` — `AdaptiveState` serializable type for persistence
- `src/index.ts` — Barrel exports
- `demo/` — Vanilla TS demo page served by Vite

## Key concepts

- **Zero-sum budget**: Fixed total score (default 100) distributed across widgets. Clicking one drains others proportionally.
- **Weight-based variants**: `variantIndex = Math.floor(weight / growthRate)` — variants go up AND down as weights shift.
- **No layout opinions**: Library outputs `score`, `weight`, `variant`, `clicks` per widget. CSS is the consumer's job.

## Commands

```sh
npm run build         # compile library to dist/
npm test              # run vitest suite
npm run check         # full pipeline: types + lint + format + knip + jscpd + tests
npm run demo          # vite dev server with HMR
npm run lint          # eslint src/ demo/
npm run lint:fix      # eslint with auto-fix
npm run format        # prettier write
npm run format:check  # prettier check
npm run knip          # unused code detection
npm run duplication   # copy-paste detection
```

## Releasing

1. Bump the version in `package.json` manually
2. Commit and push
3. Create a GitHub release (e.g. `gh release create 0.x.y`) — this triggers the npm publish and GitHub Pages deploy workflows

## Rules

- ESM-only, no CommonJS
- No runtime dependencies
- All tests in `*.test.ts` files alongside source
- Run `npm run check` before committing
