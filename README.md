# behavioural-dashboard

[![npm](https://img.shields.io/npm/v/behavioural-dashboard)](https://www.npmjs.com/package/behavioural-dashboard)

A framework-agnostic TypeScript engine that tracks user interaction patterns and outputs serializable state for adaptive UIs. No DOM manipulation, no CSS, no framework lock-in — just behavioural primitives you wire into your own components.

[Live demo](https://ricardomonteirosimoes.github.io/behavioural-dashboard/) · [npm package](https://www.npmjs.com/package/behavioural-dashboard)

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
engine.register([
  { id: 'orders', initialScore: 40 },
  { id: 'fleet', initialScore: 35 },
  { id: 'alerts', initialScore: 25 },
]);

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

If no initial scores are given, all widgets start at `0` and receive an equal share on first normalization. `reset()` always returns to those initial values.

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
### `register(widgets: { id: string; initialScore?: number }[]): void`

Registers one or more widgets and fires a single `'change'` event. Throws if any `id` is already registered. If the total exceeds the budget, all scores are scaled down proportionally to fit — scores express relative importance, not absolute values. Scores that sum to less than or equal to the budget are left as-is; full normalization to exactly the budget happens on the next `getState()` or `record()` call.

The batch overload is preferred when registering multiple widgets at once — it emits a single fully-formed state instead of intermediate snapshots.

- **All widgets have score 0** (no explicit initial scores anywhere): they receive an equal share of the budget.
- **Some widgets have explicit scores**: the scoreless widget stays at `0` and does not receive an automatic equal slice.

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

Subscribes to state changes. `cb` is called after every `register`, `record`, `import`, and `reset`.

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

## Framework integration

### React

```tsx
import { useEffect, useState } from 'react';
import { BehaviouralEngine } from 'behavioural-dashboard';
import type { WidgetState } from 'behavioural-dashboard';

function Dashboard() {
  // 1. Create engine + register widgets in a useState initializer.
  //    Runs once, Strict Mode safe.
  const [engine] = useState(() => {
    const e = new BehaviouralEngine({
      budget: 100,         // total score pool
      increment: 5,        // points transferred per click
      growthRate: 0.2,     // weight step per variant tier
      variants: ['compact', 'standard', 'expanded'],
    });
    e.register([
      { id: 'orders', initialScore: 40 },
      { id: 'fleet',  initialScore: 35 },
      { id: 'alerts', initialScore: 25 },
    ]);
    return e;
  });

  // 2. Seed state from engine, then keep it in sync via the change event.
  const [states, setStates] = useState(() => engine.getState());

  useEffect(() => {
    engine.on('change', setStates);
    return () => engine.off('change', setStates);
  }, [engine]);

  // 3. Render — variant drives CSS, weight drives size, record() on click.
  return (
    <main style={{ display: 'flex', gap: 8 }}>
      {states.map((s) => (
        <Widget key={s.id} state={s} onClick={() => engine.record(s.id)} />
      ))}
    </main>
  );
}

// Each widget maps engine state to visual output.
// Use state.variant for CSS classes, state.weight for proportional sizing.
function Widget({ state, onClick }: { state: WidgetState; onClick: () => void }) {
  return (
    <article
      className={`widget widget--${state.variant}`}
      style={{ flexGrow: state.weight }}
      onClick={onClick}
    >
      <h3>{state.id}</h3>
      <span>{state.score.toFixed(1)}</span>
    </article>
  );
}
```

### Angular

```typescript
import { Component, OnDestroy, signal } from '@angular/core';
import { BehaviouralEngine } from 'behavioural-dashboard';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  // variant drives CSS classes, weight drives proportional sizing.
  // record() on click — the signal re-renders the template automatically.
  template: `
    <main style="display: flex; gap: 8px">
      @for (s of states(); track s.id) {
        <article
          [class]="'widget widget--' + s.variant"
          [style.flex-grow]="s.weight"
          (click)="engine.record(s.id)">
          <h3>{{ s.id }}</h3>
          <span>{{ s.score.toFixed(1) }}</span>
        </article>
      }
    </main>
  `,
})
export class DashboardComponent implements OnDestroy {
  // 1. Create the engine.
  engine = new BehaviouralEngine({
    budget: 100,         // total score pool
    increment: 5,        // points transferred per click
    growthRate: 0.2,     // weight step per variant tier
    variants: ['compact', 'standard', 'expanded'],
  });

  // 2. A signal that holds the current widget states — drives the template.
  states = signal(this.engine.getState());

  constructor() {
    // 3. Wire the engine's change event to the signal, then register widgets.
    this.engine.on('change', (s) => this.states.set(s));

    this.engine.register([
      { id: 'orders', initialScore: 40 },
      { id: 'fleet',  initialScore: 35 },
      { id: 'alerts', initialScore: 25 },
    ]);
  }

  ngOnDestroy() { this.engine.destroy(); }
}
```

## Persistence

`export()` returns an `AdaptiveState` object you can serialize and store anywhere. The type is exported and can be imported directly:

```typescript
import type { AdaptiveState } from 'behavioural-dashboard';
```

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
