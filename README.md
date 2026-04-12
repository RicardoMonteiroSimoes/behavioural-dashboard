# behavioural-dashboard

A framework-agnostic TypeScript engine that tracks user interaction patterns and outputs serializable state for adaptive UIs. No DOM manipulation, no CSS, no framework lock-in — just behavioural primitives you wire into your own components.

> **ESM only.** This package ships ES modules exclusively. It requires a bundler or a runtime that supports `"type": "module"`.

## Installation

```bash
npm install behavioural-dashboard
```

## Quick start

```typescript
import { BehaviouralEngine } from 'behavioural-dashboard';

const engine = new BehaviouralEngine({
  budget: 100,
  increment: 5,
  growthRate: 0.2,
  variants: ['compact', 'standard', 'expanded'],
});

// Register widgets — optionally with initial scores for a pre-seeded layout
engine.register('orders', 40);
engine.register('fleet', 35);
engine.register('alerts', 25);

// Record an interaction
engine.record('orders');

// Read state (returned in registration order)
const states = engine.getState();
// [
//   { id: 'orders', score: 43.2, weight: 0.432, clicks: 1, variant: 'standard' },
//   { id: 'fleet',  score: 32.1, weight: 0.321, clicks: 0, variant: 'compact'  },
//   { id: 'alerts', score: 24.7, weight: 0.247, clicks: 0, variant: 'compact'  },
// ]

// Subscribe to changes
engine.on('change', (states) => {
  for (const s of states) {
    const el = document.getElementById(s.id)!;
    el.className = `widget widget--${s.variant}`;
    el.style.flexGrow = String(s.weight * states.length);
  }
});
```

## How it works

### Zero-sum budget scoring

A fixed **budget** (default: `100`) is shared across all registered widgets. Scores always sum to exactly the budget. When a widget is interacted with, it gains points drained proportionally from every other widget — widgets that hold more score lose more than those that hold less.

### Proportional drain redistribution

On each `record(id)` call:

1. The engine collects all widgets other than the target.
2. It drains up to `increment` points from them, taking from each in proportion to its current score.
3. Those points are added to the target widget's score.
4. Scores are renormalized so the total stays at `budget`.

Unused widgets shrink only when other widgets are clicked. There is no time-based decay.

### Weight-based variant resolution

Each widget's **weight** is its fraction of the total budget:

```
weight = score / budget        // range: 0–1
```

The active variant is chosen by mapping weight through the `growthRate` step:

```
variantIndex = min(floor(weight / growthRate), variants.length - 1)
```

With the default `growthRate` of `0.2` and variants `['compact', 'standard', 'expanded']`:

| weight range | variantIndex | variant    |
|---|---|---|
| 0.00 – 0.19  | 0            | `compact`  |
| 0.20 – 0.39  | 1            | `standard` |
| 0.40 – 1.00  | 2            | `expanded` |

A smaller `growthRate` makes variants unlock at lower weights (faster progression). A larger value requires a widget to hold more of the budget before advancing.

### Pre-seeded default layouts

Registering widgets with explicit initial scores sets a default layout:

```typescript
engine.register('primary',   50);  // starts prominent
engine.register('secondary', 30);
engine.register('tertiary',  20);  // starts small
```

If no initial scores are given, all widgets start equal. `reset()` always returns to those initial values.

## Configuration

| Option       | Default       | Description                                              |
|---|---|---|
| `budget`     | `100`         | Total score pool shared across all widgets               |
| `increment`  | `5`           | Points transferred per interaction                       |
| `growthRate` | `0.2`         | Weight step per variant level (lower = faster unlock)    |
| `variants`   | `['default']` | Ordered variant names, least to most prominent           |

All options are optional. The constructor throws if `budget`, `increment`, or `growthRate` are non-positive, or if `variants` is empty.

## API reference

### `new BehaviouralEngine(config?)`

Creates a new engine. All config fields are optional and fall back to defaults.

### `register(id: string, initialScore?: number): void`

Registers a widget. Throws if `id` is already registered. If `initialScore` is omitted the widget starts at `0` and is assigned an equal share when scores are first normalized.

### `record(id: string): void`

Records one interaction on `id`. Redistributes the budget and fires `'change'` listeners. Throws if `id` is not registered.

### `getState(): WidgetState[]`

Returns the current state of all widgets in **registration order**. The array is not sorted by score.

### `getWidget(id: string): WidgetState`

Returns the current state of a single widget. Throws if `id` is not registered.

### `export(): AdaptiveState`

Returns a plain, JSON-serializable snapshot of the engine state. See [Persistence](#persistence).

### `import(state: AdaptiveState): void`

Restores from a snapshot. Widgets in the engine that are absent from the snapshot retain their current scores; the scores are then renormalized. Widgets in the snapshot that are not registered in the engine are ignored. Throws on unsupported `version` values.

### `reset(): void`

Resets all widgets to their initial scores and zeroes click counts. Fires `'change'` listeners.

### `on(event: 'change', cb: (states: WidgetState[]) => void): void`

Subscribes to state changes. `cb` is called after every `record`, `import`, and `reset`.

### `off(event: 'change', cb: (states: WidgetState[]) => void): void`

Unsubscribes a previously registered listener.

### `destroy(): void`

Removes all listeners. Call this when tearing down a component to prevent memory leaks.

## WidgetState shape

```typescript
interface WidgetState {
  id: string;      // widget identifier
  score: number;   // raw score (sums to budget across all widgets)
  weight: number;  // score / budget, range 0–1
  clicks: number;  // total interactions recorded since last reset
  variant: string; // active variant name from your variants array
}
```

There is no `order` field. If you need a sorted list, sort `getState()` yourself:

```typescript
const ranked = engine.getState().sort((a, b) => b.score - a.score);
```

## Styling

This library produces **data, not DOM**. Wiring state to your UI is your responsibility.

| Engine output | Suggested UI mapping                                                      |
|---|---|
| `weight` (0–1)  | Size the widget: `flex-grow`, `grid-column: span N`, width percentage   |
| `variant`       | Apply a CSS class: `.widget--compact`, `.widget--standard`, etc.        |
| `clicks > 0`    | Progressive disclosure: reveal detail layers after first interaction    |

Example — flex layout that grows widgets proportionally:

```typescript
engine.on('change', (states) => {
  for (const s of states) {
    const el = document.getElementById(s.id)!;
    el.className = `widget widget--${s.variant}`;
    el.style.flexGrow = String(s.weight * states.length);
  }
});
```

Recommended CSS transitions so size and style changes animate smoothly:

```css
.widget {
  transition: flex-grow 0.4s ease, min-height 0.4s ease;
}
```

## Persistence

`export()` returns an `AdaptiveState` object you can serialize and store anywhere:

```typescript
interface AdaptiveState {
  version: 1;
  widgets: Array<{ id: string; score: number; clicks: number }>;
  lastInteraction: number; // Unix timestamp (ms) of the most recent record() call
}
```

Example with `localStorage`:

```typescript
// Save after every change
engine.on('change', () => {
  localStorage.setItem('dashboard', JSON.stringify(engine.export()));
});

// Restore on page load
const raw = localStorage.getItem('dashboard');
if (raw) {
  engine.import(JSON.parse(raw));
}
```

The same pattern works with `IndexedDB`, a REST endpoint, or any other store — `AdaptiveState` is plain JSON with no class instances or circular references.

## Demo

[ricardomonteirosimoes.github.io/behavioural-dashboard](https://ricardomonteirosimoes.github.io/behavioural-dashboard/)

## Attribution

The concept of a behavioural, interaction-adaptive dashboard was designed and demonstrated by [Tanvi Palkar](https://www.linkedin.com/in/tanvi-palkar-ab9b159a/). Her original interactive demo is available at [tanvin-alt.github.io/behavioural-dashboard](https://tanvin-alt.github.io/behavioural-dashboard/) ([source](https://github.com/tanvin-alt/behavioural-dashboard)).

This library extracts and generalises the mechanics from that demo into a framework-agnostic TypeScript package.

Vibe-engineered with Claude (Anthropic).

## License

MIT
