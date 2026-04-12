# behavioural-dashboard

A framework-agnostic TypeScript engine that tracks user interaction patterns and outputs serializable state for adaptive UIs. No DOM manipulation, no CSS, no framework lock-in — just behavioural primitives you wire into your own components.

Inspired by [Tanvi Palkar's "Designing for the 100th Use"](https://tanvin-alt.github.io/behavioural-dashboard/) demo ([source](https://github.com/tanvin-alt/behavioural-dashboard)). This library extracts the core mechanics into a reusable package.

## How it works

A fixed **score budget** (default: 100) is distributed across all registered widgets. When a user interacts with a widget, it gains points — drained proportionally from the others. Widgets that get more attention grow; neglected ones shrink. The total always sums to the budget.

The engine outputs per widget:
- **score** and **weight** (0–1) — how much of the budget this widget holds
- **variant** — a string from your ordered list, advancing every N clicks
- **order** — sort position by score descending

You map these to whatever layout system and CSS you use. The library has no opinion.

## Installation

```bash
npm install behavioural-dashboard
```

## Usage

```typescript
import { BehaviouralEngine } from 'behavioural-dashboard';

const engine = new BehaviouralEngine({
  budget: 100,
  increment: 5,
  growthRate: 5,
  variants: ['compact', 'standard', 'expanded'],
});

// Register widgets — optionally with initial scores for a default layout
engine.register('orders', 40);
engine.register('fleet', 35);
engine.register('alerts', 25);

// Record interactions
engine.record('orders');

// Read state
const states = engine.getState();
// [
//   { id: 'orders', score: 43.2, weight: 0.432, clicks: 1, variant: 'compact', order: 0 },
//   { id: 'fleet',  score: 32.1, weight: 0.321, clicks: 0, variant: 'compact', order: 1 },
//   { id: 'alerts', score: 24.7, weight: 0.247, clicks: 0, variant: 'compact', order: 2 },
// ]

// Subscribe to changes
engine.on('change', (states) => {
  for (const s of states) {
    el.className = `widget widget--${s.variant}`;
    el.style.flexGrow = String(s.weight * widgetCount);
    el.style.order = String(s.order);
  }
});
```

## Scoring model

- **Budget**: fixed total across all widgets (default: `100`). Scores always sum to this.
- **Increment**: points transferred per click (default: `5`). Drained proportionally from all other widgets — high-scoring widgets lose more than low-scoring ones.
- **No time-based decay**: redistribution on interaction *is* the balancing mechanism. Unused widgets shrink only when other widgets are clicked.

Pre-seeding scores lets you define a default layout:

```typescript
engine.register('primary', 50);   // starts prominent
engine.register('secondary', 30);
engine.register('tertiary', 20);  // starts small
```

If no initial scores are given, all widgets start equal.

## Variant resolution

You provide an ordered array of variant names. The engine advances through them based on click count:

```
variantIndex = Math.min(floor(clicks / growthRate), variants.length - 1)
```

Define as many or as few as you need:

```typescript
// Two variants — simple toggle
{ variants: ['small', 'large'], growthRate: 3 }

// Five variants — gradual progression
{ variants: ['xs', 'sm', 'md', 'lg', 'xl'], growthRate: 4 }
```

The variant is just a string. What it means in your CSS is entirely up to you.

## Persistence

The engine exports a plain JSON object you can store anywhere:

```typescript
// Save
const state = engine.export();
localStorage.setItem('dashboard', JSON.stringify(state));

// Restore
const saved = JSON.parse(localStorage.getItem('dashboard')!);
engine.import(saved);
```

The `AdaptiveState` shape:

```typescript
interface AdaptiveState {
  version: 1;
  userId?: string;
  widgets: Array<{ id: string; score: number; clicks: number }>;
  lastInteraction: number;
}
```

Send it to a REST API, store it in IndexedDB, sync it across devices — that's your call.

## Styling (your responsibility)

This library produces **data, not DOM**. Here's what to wire up:

| Engine output | What to do in your UI |
|---|---|
| `weight` (0–1) | Size the widget: `flex-grow`, `grid-column: span N`, width percentage |
| `variant` | Apply a CSS class: `.widget--compact`, `.widget--expanded`, etc. |
| `order` (0 = top) | Sort position: CSS `order`, DOM reorder, grid placement |
| `clicks > 0` | Show additional detail layers (progressive disclosure) |

Recommended CSS transitions:

```css
.widget {
  transition: flex-grow 0.4s ease, min-height 0.4s ease, border-color 0.4s ease;
}
```

## Configuration

| Option | Default | Description |
|---|---|---|
| `budget` | `100` | Total score pool across all widgets |
| `increment` | `5` | Score transferred per interaction |
| `growthRate` | `5` | Clicks needed to advance one variant level |
| `variants` | `['default']` | Ordered variant names, least to most prominent |

## API

| Method | Description |
|---|---|
| `register(id, initialScore?)` | Add a widget. Optional score for default layout. |
| `record(id)` | Record an interaction. Redistributes budget. |
| `getState()` | All widget states, sorted by score descending. |
| `getWidget(id)` | Single widget state. |
| `export()` | Serializable JSON snapshot. |
| `import(state)` | Restore from snapshot. |
| `reset()` | Return to initial scores, zero clicks. |
| `on('change', cb)` | Subscribe to state changes. |
| `off('change', cb)` | Unsubscribe. |
| `destroy()` | Remove all listeners. |

## Attribution

The concept of a behavioural, interaction-adaptive dashboard was designed and demonstrated by [Tanvi Palkar](https://www.linkedin.com/in/tanvi-palkar-ab9b159a/). Her original interactive demo is available at [tanvin-alt.github.io/behavioural-dashboard](https://tanvin-alt.github.io/behavioural-dashboard/) ([source](https://github.com/tanvin-alt/behavioural-dashboard)).

This library extracts and generalises the mechanics from that demo into a framework-agnostic TypeScript package.

Vibe-engineered with Claude (Anthropic).

## License

MIT
