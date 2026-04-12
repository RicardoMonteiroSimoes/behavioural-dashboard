import { BehaviouralEngine } from 'behavioural-dashboard';
import type { WidgetState } from 'behavioural-dashboard';

// Default score distributions — variants are now weight-driven
// With growthRate 0.1 and 4 variants: 0-9% = compact, 10-19% = standard, 20-29% = expanded, 30%+ = full
const ABSTRACT_DEFAULTS: { id: string; score: number }[] = [
  { id: 'Alpha', score: 30 }, // 30% → full
  { id: 'Bravo', score: 22 }, // 22% → expanded
  { id: 'Charlie', score: 18 }, // 18% → standard
  { id: 'Delta', score: 14 }, // 14% → standard
  { id: 'Echo', score: 10 }, // 10% → standard
  { id: 'Foxtrot', score: 6 }, //  6% → compact
];
const ABSTRACT_WIDGETS = ABSTRACT_DEFAULTS.map((w) => w.id);

interface MockWidget {
  id: string;
  label: string;
  value: string;
  trend: string;
  trendDir: 'up' | 'dn';
  sparkData: number[];
  details: { label: string; value: string }[];
  tag: { text: string; cls: string };
}

// Dashboard: Revenue/Users are power-user widgets, errors/conversion are secondary
const DASHBOARD_DEFAULTS: { id: string; score: number }[] = [
  { id: 'revenue', score: 30 }, // 30% → full
  { id: 'users', score: 24 }, // 24% → expanded
  { id: 'orders', score: 18 }, // 18% → standard
  { id: 'response', score: 14 }, // 14% → standard
  { id: 'errors', score: 9 }, //  9% → compact
  { id: 'conversion', score: 5 }, //  5% → compact
];

const DASHBOARD_WIDGETS: MockWidget[] = [
  {
    id: 'revenue',
    label: 'Revenue',
    value: '$48.2K',
    trend: '+12% vs last month',
    trendDir: 'up',
    sparkData: [30, 45, 38, 62, 55, 72, 68, 80, 75, 90, 85, 94],
    details: [
      { label: 'Subscriptions', value: '$32.1K' },
      { label: 'One-time', value: '$16.1K' },
      { label: 'Avg deal size', value: '$2,840' },
    ],
    tag: { text: 'Above target', cls: 'tg-green' },
  },
  {
    id: 'users',
    label: 'Active users',
    value: '1,284',
    trend: '+8% from yesterday',
    trendDir: 'up',
    sparkData: [55, 62, 58, 72, 68, 75, 80, 78, 85, 90, 88, 94],
    details: [
      { label: 'New signups', value: '142' },
      { label: 'Returning', value: '1,142' },
      { label: 'Churn rate', value: '2.1%' },
    ],
    tag: { text: 'Growing', cls: 'tg-green' },
  },
  {
    id: 'orders',
    label: 'Orders',
    value: '384',
    trend: 'Up 23 from yesterday',
    trendDir: 'up',
    sparkData: [40, 35, 50, 45, 60, 55, 70, 65, 75, 80, 72, 85],
    details: [
      { label: 'Completed', value: '341' },
      { label: 'Pending', value: '31' },
      { label: 'Cancelled', value: '12' },
    ],
    tag: { text: 'High volume', cls: 'tg-green' },
  },
  {
    id: 'response',
    label: 'Avg response',
    value: '240ms',
    trend: '-18ms vs last week',
    trendDir: 'up',
    sparkData: [80, 75, 70, 72, 65, 60, 58, 55, 52, 50, 48, 45],
    details: [
      { label: 'P50', value: '180ms' },
      { label: 'P95', value: '420ms' },
      { label: 'P99', value: '890ms' },
    ],
    tag: { text: 'On track', cls: 'tg-green' },
  },
  {
    id: 'errors',
    label: 'Error rate',
    value: '0.42%',
    trend: '+0.08% from yesterday',
    trendDir: 'dn',
    sparkData: [10, 12, 15, 14, 18, 22, 20, 25, 30, 28, 35, 42],
    details: [
      { label: '5xx errors', value: '18' },
      { label: '4xx errors', value: '124' },
      { label: 'Timeouts', value: '7' },
    ],
    tag: { text: 'Monitor', cls: 'tg-amber' },
  },
  {
    id: 'conversion',
    label: 'Conversion',
    value: '3.2%',
    trend: '-0.4% vs last week',
    trendDir: 'dn',
    sparkData: [50, 48, 52, 45, 42, 40, 38, 35, 34, 32, 30, 32],
    details: [
      { label: 'Visitors', value: '12,400' },
      { label: 'Signups', value: '397' },
      { label: 'Paid', value: '142' },
    ],
    tag: { text: 'Needs attention', cls: 'tg-red' },
  },
];

const VARIANTS = ['compact', 'standard', 'expanded', 'full'];
const STORAGE_KEY = 'behavioural-dashboard-demo';
const LAYOUTS = ['flex-row', 'flex-wrap', 'grid-cols', 'vertical', 'equal'];

let contentMode: 'abstract' | 'dashboard' = 'abstract';
let currentLayout = 'flex-row';
let currentOrder: 'registration' | 'score' = 'registration';
let gridCols = 3;

let engine = createEngine(100, 5, 0.1);

function getDefaults(): { id: string; score: number }[] {
  return contentMode === 'abstract' ? ABSTRACT_DEFAULTS : DASHBOARD_DEFAULTS;
}

function createEngine(
  budget: number,
  increment: number,
  growthRate: number,
): BehaviouralEngine {
  const defaults = getDefaults();
  const e = new BehaviouralEngine({
    budget,
    increment,
    growthRate,
    variants: VARIANTS,
  });
  for (const d of defaults) e.register(d.id, d.score);
  return e;
}

// --- DOM helpers ---

function getEl(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing DOM element: #${id}`);
  return el;
}

// DOM refs
const gridEl = getEl('grid');
const statusEl = getEl('status');
const budgetBarsEl = getEl('budget-bars');
const jsonDumpEl = getEl('json-dump');
const resetBtn = getEl('reset-btn');
const layoutTabs = getEl('layout-tabs');
const contentTabs = getEl('content-tabs');
const orderTabs = getEl('order-tabs');
const colsSlider = getEl('cols-slider');
const gridColsInput = getEl('grid-cols') as HTMLInputElement;
const gridColsVal = getEl('grid-cols-val');
const gridGapInput = getEl('grid-gap') as HTMLInputElement;
const gridGapVal = getEl('grid-gap-val');
const configToggle = getEl('config-toggle');
const configPanel = getEl('config-panel');
const cfgBudget = getEl('cfg-budget') as HTMLInputElement;
const cfgBudgetVal = getEl('cfg-budget-val');
const cfgIncrement = getEl('cfg-increment') as HTMLInputElement;
const cfgIncrementVal = getEl('cfg-increment-val');
const cfgGrowth = getEl('cfg-growth') as HTMLInputElement;
const cfgGrowthVal = getEl('cfg-growth-val');

// --- Sparkline SVG ---

function sparklineSvg(data: number[]): string {
  const w = 200;
  const h = 32;
  if (data.length < 2) {
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"></svg>`;
  }
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <polyline points="${points}" fill="none" stroke="#E85D04" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    <polyline points="0,${h} ${points} ${w},${h}" fill="rgba(232,93,4,0.07)" stroke="none" />
  </svg>`;
}

// --- Widget DOM ---

function createAbstractWidgetEl(id: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'widget variant-compact';
  el.dataset.id = id;

  const accent = document.createElement('div');
  accent.className = 'accent';

  const inner = document.createElement('div');
  inner.className = 'w-inner';

  const label = document.createElement('div');
  label.className = 'w-label';
  label.textContent = id;

  const score = document.createElement('div');
  score.className = 'w-score';
  score.textContent = '0.0';

  const variantTag = document.createElement('div');
  variantTag.className = 'w-variant-tag';
  variantTag.textContent = 'compact';

  const reveal = document.createElement('div');
  reveal.className = 'reveal r1';

  const meta = document.createElement('div');
  meta.className = 'w-meta';

  const clicksDiv = document.createElement('div');
  const clicksSpan = document.createElement('span');
  clicksSpan.className = 'click-count';
  clicksSpan.textContent = '0';
  clicksDiv.append('Clicks: ', clicksSpan);

  const weightDiv = document.createElement('div');
  const weightSpan = document.createElement('span');
  weightSpan.className = 'weight-val';
  weightSpan.textContent = '0%';
  weightDiv.append('Weight: ', weightSpan);

  meta.append(clicksDiv, weightDiv);

  const bar = document.createElement('div');
  bar.className = 'w-bar';
  const barFill = document.createElement('div');
  barFill.className = 'w-bar-fill';
  barFill.style.width = '0%';
  bar.appendChild(barFill);

  reveal.append(meta, bar);
  inner.append(label, score, variantTag, reveal);
  el.append(accent, inner);

  el.setAttribute('tabindex', '0');
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', id);
  el.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      el.click();
    }
  });
  el.addEventListener('click', () => engine.record(id));
  return el;
}

function createDashboardWidgetEl(mock: MockWidget): HTMLElement {
  const el = document.createElement('div');
  el.className = 'widget variant-compact';
  el.dataset.id = mock.id;

  const accent = document.createElement('div');
  accent.className = 'accent';

  const inner = document.createElement('div');
  inner.className = 'w-inner';

  const label = document.createElement('div');
  label.className = 'w-label';
  label.textContent = mock.label;

  const score = document.createElement('div');
  score.className = 'w-score';
  score.textContent = mock.value;

  // r1: trend row
  const r1 = document.createElement('div');
  r1.className = 'reveal r1';
  const trend = document.createElement('div');
  trend.className = 'w-trend';
  const trendArrow = document.createElement('span');
  trendArrow.className = mock.trendDir;
  trendArrow.textContent = mock.trendDir === 'up' ? '↑' : '↓';
  trend.append(trendArrow, ` ${mock.trend}`);
  r1.appendChild(trend);

  // r2: sparkline (SVG is built from numeric data — safe to use innerHTML on its container)
  const r2 = document.createElement('div');
  r2.className = 'reveal r2';
  const sparklineContainer = document.createElement('div');
  sparklineContainer.className = 'w-sparkline';
  sparklineContainer.innerHTML = sparklineSvg(mock.sparkData);
  r2.appendChild(sparklineContainer);

  // r3: detail rows + tag
  const r3 = document.createElement('div');
  r3.className = 'reveal r3';

  const divider = document.createElement('div');
  divider.className = 'w-divider';

  const detailRows = document.createElement('div');
  detailRows.className = 'w-detail-rows';
  for (const d of mock.details) {
    const row = document.createElement('div');
    row.className = 'w-detail-row';
    const dl = document.createElement('span');
    dl.className = 'w-dl';
    dl.textContent = d.label;
    const dv = document.createElement('span');
    dv.className = 'w-dv';
    dv.textContent = d.value;
    row.append(dl, dv);
    detailRows.appendChild(row);
  }

  const tag = document.createElement('div');
  tag.className = `w-tag ${mock.tag.cls}`;
  tag.textContent = mock.tag.text;

  r3.append(divider, detailRows, tag);
  inner.append(label, score, r1, r2, r3);
  el.append(accent, inner);

  el.setAttribute('tabindex', '0');
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', mock.label);
  el.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      el.click();
    }
  });
  el.addEventListener('click', () => engine.record(mock.id));
  return el;
}

function createBudgetRow(id: string, label: string): HTMLElement {
  const row = document.createElement('div');
  row.className = 'budget-row';
  row.dataset.id = id;

  const labelEl = document.createElement('span');
  labelEl.className = 'budget-label';
  labelEl.textContent = label;

  const track = document.createElement('div');
  track.className = 'budget-track';
  const fill = document.createElement('div');
  fill.className = 'budget-fill';
  fill.style.width = '0%';
  track.appendChild(fill);

  const value = document.createElement('span');
  value.className = 'budget-value';
  value.textContent = '0.0';

  row.append(labelEl, track, value);
  return row;
}

// --- Build DOM ---

function buildWidgets(): void {
  gridEl.replaceChildren();
  budgetBarsEl.replaceChildren();

  if (contentMode === 'abstract') {
    for (const name of ABSTRACT_WIDGETS) {
      gridEl.appendChild(createAbstractWidgetEl(name));
      budgetBarsEl.appendChild(createBudgetRow(name, name));
    }
  } else {
    for (const mock of DASHBOARD_WIDGETS) {
      gridEl.appendChild(createDashboardWidgetEl(mock));
      budgetBarsEl.appendChild(createBudgetRow(mock.id, mock.label));
    }
  }
}

// --- Layout ---

function applyLayout(): void {
  for (const l of LAYOUTS) gridEl.classList.remove(`layout-${l}`);
  gridEl.classList.add(`layout-${currentLayout}`);

  colsSlider.style.display =
    currentLayout === 'grid-cols' || currentLayout === 'equal'
      ? 'flex'
      : 'none';

  if (currentLayout === 'grid-cols' || currentLayout === 'equal') {
    gridEl.style.gridTemplateColumns = `repeat(${gridCols}, 1fr)`;
  } else {
    gridEl.style.gridTemplateColumns = '';
  }
}

function applyLayoutSizing(states: WidgetState[]): void {
  const count = states.length;
  for (const state of states) {
    const el = gridEl.querySelector(
      `[data-id="${CSS.escape(state.id)}"]`,
    ) as HTMLElement;
    if (!el) continue;

    el.style.flexGrow = '';
    el.style.flexBasis = '';
    el.style.gridColumn = '';
    el.style.minHeight = '';

    switch (currentLayout) {
      case 'flex-row':
        el.style.flexGrow = String(Math.max(0.3, state.weight * count));
        break;
      case 'flex-wrap':
        el.style.flexGrow = String(Math.max(0.5, state.weight * count));
        el.style.flexBasis = `${Math.max(100, state.weight * 400)}px`;
        break;
      case 'grid-cols': {
        const span = Math.max(
          1,
          Math.min(gridCols, Math.round(state.weight * gridCols * 1.5)),
        );
        el.style.gridColumn = `span ${span}`;
        break;
      }
      case 'vertical':
        el.style.minHeight = `${Math.round(60 + state.weight * 300)}px`;
        break;
      case 'equal':
        break;
    }
  }
}

// --- Render ---

function render(states: WidgetState[]): void {
  if (states.length === 0) return;
  for (const state of states) {
    const widgetEl = gridEl.querySelector(
      `[data-id="${CSS.escape(state.id)}"]`,
    ) as HTMLElement;
    if (!widgetEl) continue;

    for (const v of VARIANTS) widgetEl.classList.remove(`variant-${v}`);
    widgetEl.classList.add(`variant-${state.variant}`);

    if (contentMode === 'abstract') {
      const scoreEl = widgetEl.querySelector('.w-score') as HTMLElement;
      scoreEl.textContent = state.score.toFixed(1);
      scoreEl.style.fontSize = `${Math.round(16 + state.weight * 24)}px`;

      const tag = widgetEl.querySelector('.w-variant-tag')!;
      tag.textContent = state.variant;

      const reveal = widgetEl.querySelector('.reveal') as HTMLElement;
      reveal.classList.toggle('show', state.clicks > 0);

      widgetEl.querySelector('.click-count')!.textContent = String(
        state.clicks,
      );
      widgetEl.querySelector('.weight-val')!.textContent =
        `${(state.weight * 100).toFixed(1)}%`;
      (widgetEl.querySelector('.w-bar-fill') as HTMLElement).style.width =
        `${state.weight * 100}%`;
    } else {
      // Dashboard mode: progressive disclosure by variant
      const scoreEl = widgetEl.querySelector('.w-score') as HTMLElement;
      scoreEl.style.fontSize = `${Math.round(18 + state.weight * 16)}px`;

      const r1 = widgetEl.querySelector('.r1') as HTMLElement;
      const r2 = widgetEl.querySelector('.r2') as HTMLElement;
      const r3 = widgetEl.querySelector('.r3') as HTMLElement;

      // standard+ → trend, expanded+ → sparkline, full → details
      r1?.classList.toggle('show', state.variant !== 'compact');
      r2?.classList.toggle(
        'show',
        state.variant === 'expanded' || state.variant === 'full',
      );
      r3?.classList.toggle('show', state.variant === 'full');
    }

    const budgetRow = budgetBarsEl.querySelector(
      `[data-id="${CSS.escape(state.id)}"]`,
    ) as HTMLElement;
    if (budgetRow) {
      (budgetRow.querySelector('.budget-fill') as HTMLElement).style.width =
        `${state.weight * 100}%`;
      budgetRow.querySelector('.budget-value')!.textContent =
        state.score.toFixed(1);
    }
  }

  applyLayoutSizing(states);

  // Reorder grid children based on currentOrder
  if (currentOrder === 'score') {
    const sorted = [...states].sort((a, b) => b.score - a.score);
    for (const s of sorted) {
      const el = gridEl.querySelector(`[data-id="${CSS.escape(s.id)}"]`);
      if (el) gridEl.appendChild(el);
    }
  } else {
    // Restore registration order using the defaults arrays
    const registrationOrder =
      contentMode === 'abstract'
        ? ABSTRACT_DEFAULTS.map((d) => d.id)
        : DASHBOARD_DEFAULTS.map((d) => d.id);
    for (const id of registrationOrder) {
      const el = gridEl.querySelector(`[data-id="${CSS.escape(id)}"]`);
      if (el) gridEl.appendChild(el);
    }
  }

  const exported = engine.export();
  jsonDumpEl.textContent = JSON.stringify(exported, null, 2);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(exported));

  const top = states.reduce((a, b) => (a.score >= b.score ? a : b));
  if (top.clicks > 0) {
    const label =
      contentMode === 'abstract'
        ? top.id
        : (DASHBOARD_WIDGETS.find((w) => w.id === top.id)?.label ?? top.id);
    statusEl.textContent = `"${label}" leads with ${top.score.toFixed(1)} pts — variant: ${top.variant}`;
  }
}

// --- localStorage validation ---

interface SavedWidgetEntry {
  id: string;
  score: number;
  clicks: number;
}

interface SavedState {
  version: 1;
  widgets: SavedWidgetEntry[];
  lastInteraction: number;
}

function isValidSave(data: unknown): data is SavedState {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  if (d['version'] !== 1) return false;
  if (!Array.isArray(d['widgets'])) return false;
  for (const w of d['widgets'] as unknown[]) {
    if (typeof w !== 'object' || w === null) return false;
    const ww = w as Record<string, unknown>;
    if (typeof ww['id'] !== 'string') return false;
    if (typeof ww['score'] !== 'number') return false;
    if (typeof ww['clicks'] !== 'number') return false;
  }
  if (typeof d['lastInteraction'] !== 'number') return false;
  return true;
}

// --- Init ---

function fullRebuild(): void {
  engine.destroy();
  engine = createEngine(
    Number(cfgBudget.value),
    Number(cfgIncrement.value),
    Number(cfgGrowth.value),
  );

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed: unknown = JSON.parse(saved);
      if (isValidSave(parsed)) {
        engine.import(parsed);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  engine.on('change', render);
  buildWidgets();
  applyLayout();
  render(engine.getState());
}

fullRebuild();

// --- Event wiring ---

// Content mode toggle
contentTabs.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('.tab-btn') as HTMLElement;
  if (!btn?.dataset.content) return;
  const mode = btn.dataset.content;
  if (mode !== 'abstract' && mode !== 'dashboard') return;
  contentTabs
    .querySelectorAll('.tab-btn')
    .forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  contentMode = mode;
  localStorage.removeItem(STORAGE_KEY);
  statusEl.textContent = 'Ready — click any widget';
  fullRebuild();
});

// Layout tabs
layoutTabs.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('.tab-btn') as HTMLElement;
  if (!btn?.dataset.layout) return;
  const layout = btn.dataset.layout;
  if (!LAYOUTS.includes(layout)) return;
  layoutTabs
    .querySelectorAll('.tab-btn')
    .forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  currentLayout = layout;
  applyLayout();
  render(engine.getState());
});

// Order tabs
orderTabs.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('.tab-btn') as HTMLElement;
  if (!btn?.dataset.order) return;
  const order = btn.dataset.order;
  if (order !== 'registration' && order !== 'score') return;
  orderTabs
    .querySelectorAll('.tab-btn')
    .forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  currentOrder = order;
  render(engine.getState());
});

// Grid columns slider
gridColsInput.addEventListener('input', () => {
  gridCols = Number(gridColsInput.value);
  gridColsVal.textContent = String(gridCols);
  applyLayout();
  render(engine.getState());
});

// Gap slider
gridGapInput.addEventListener('input', () => {
  gridGapVal.textContent = gridGapInput.value;
  gridEl.style.gap = `${gridGapInput.value}px`;
});

// Config panel toggle
configToggle.addEventListener('click', () => {
  configPanel.classList.toggle('open');
  configToggle.textContent = configPanel.classList.contains('open')
    ? 'Hide config'
    : 'Engine config';
});

// Engine config sliders
function rebuildEngine(): void {
  cfgBudgetVal.textContent = cfgBudget.value;
  cfgIncrementVal.textContent = cfgIncrement.value;
  cfgGrowthVal.textContent = cfgGrowth.value;

  const oldState = engine.export();
  engine.destroy();
  engine = createEngine(
    Number(cfgBudget.value),
    Number(cfgIncrement.value),
    Number(cfgGrowth.value),
  );
  engine.import(oldState);
  engine.on('change', render);
  render(engine.getState());
}

cfgBudget.addEventListener('input', rebuildEngine);
cfgIncrement.addEventListener('input', rebuildEngine);
cfgGrowth.addEventListener('input', rebuildEngine);

// Reset
resetBtn.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  statusEl.textContent = 'Reset — restored to default layout';
  fullRebuild();
});
