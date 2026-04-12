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

// DOM refs
const gridEl = document.getElementById('grid')!;
const statusEl = document.getElementById('status')!;
const budgetBarsEl = document.getElementById('budget-bars')!;
const jsonDumpEl = document.getElementById('json-dump')!;
const resetBtn = document.getElementById('reset-btn')!;
const layoutTabs = document.getElementById('layout-tabs')!;
const contentTabs = document.getElementById('content-tabs')!;
const colsSlider = document.getElementById('cols-slider')!;
const gridColsInput = document.getElementById('grid-cols') as HTMLInputElement;
const gridColsVal = document.getElementById('grid-cols-val')!;
const gridGapInput = document.getElementById('grid-gap') as HTMLInputElement;
const gridGapVal = document.getElementById('grid-gap-val')!;
const configToggle = document.getElementById('config-toggle')!;
const configPanel = document.getElementById('config-panel')!;
const cfgBudget = document.getElementById('cfg-budget') as HTMLInputElement;
const cfgBudgetVal = document.getElementById('cfg-budget-val')!;
const cfgIncrement = document.getElementById(
  'cfg-increment',
) as HTMLInputElement;
const cfgIncrementVal = document.getElementById('cfg-increment-val')!;
const cfgGrowth = document.getElementById('cfg-growth') as HTMLInputElement;
const cfgGrowthVal = document.getElementById('cfg-growth-val')!;

// --- Sparkline SVG ---

function sparklineSvg(data: number[]): string {
  const w = 200;
  const h = 32;
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
  el.innerHTML = `
    <div class="accent"></div>
    <div class="w-inner">
      <div class="w-label">${id}</div>
      <div class="w-score">0.0</div>
      <div class="w-variant-tag">compact</div>
      <div class="reveal r1">
        <div class="w-meta">
          <div>Clicks: <span class="click-count">0</span></div>
          <div>Weight: <span class="weight-val">0%</span></div>
        </div>
        <div class="w-bar"><div class="w-bar-fill" style="width: 0%"></div></div>
      </div>
    </div>
  `;
  el.addEventListener('click', () => engine.record(id));
  return el;
}

function createDashboardWidgetEl(mock: MockWidget): HTMLElement {
  const el = document.createElement('div');
  el.className = 'widget variant-compact';
  el.dataset.id = mock.id;
  el.innerHTML = `
    <div class="accent"></div>
    <div class="w-inner">
      <div class="w-label">${mock.label}</div>
      <div class="w-score">${mock.value}</div>
      <div class="reveal r1">
        <div class="w-trend"><span class="${mock.trendDir}">${mock.trendDir === 'up' ? '↑' : '↓'}</span> ${mock.trend}</div>
      </div>
      <div class="reveal r2">
        <div class="w-sparkline">${sparklineSvg(mock.sparkData)}</div>
      </div>
      <div class="reveal r3">
        <div class="w-divider"></div>
        <div class="w-detail-rows">
          ${mock.details.map((d) => `<div class="w-detail-row"><span class="w-dl">${d.label}</span><span class="w-dv">${d.value}</span></div>`).join('')}
        </div>
        <div class="w-tag ${mock.tag.cls}">${mock.tag.text}</div>
      </div>
    </div>
  `;
  el.addEventListener('click', () => engine.record(mock.id));
  return el;
}

function createBudgetRow(id: string, label: string): HTMLElement {
  const row = document.createElement('div');
  row.className = 'budget-row';
  row.dataset.id = id;
  row.innerHTML = `
    <span class="budget-label">${label}</span>
    <div class="budget-track"><div class="budget-fill" style="width: 0%"></div></div>
    <span class="budget-value">0.0</span>
  `;
  return row;
}

// --- Build DOM ---

function buildWidgets(): void {
  gridEl.innerHTML = '';
  budgetBarsEl.innerHTML = '';

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
    const el = gridEl.querySelector(`[data-id="${state.id}"]`) as HTMLElement;
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
  for (const state of states) {
    const widgetEl = gridEl.querySelector(
      `[data-id="${state.id}"]`,
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
      `[data-id="${state.id}"]`,
    ) as HTMLElement;
    if (budgetRow) {
      (budgetRow.querySelector('.budget-fill') as HTMLElement).style.width =
        `${state.weight * 100}%`;
      budgetRow.querySelector('.budget-value')!.textContent =
        state.score.toFixed(1);
    }
  }

  applyLayoutSizing(states);

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
      engine.import(JSON.parse(saved));
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
  contentTabs
    .querySelectorAll('.tab-btn')
    .forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  contentMode = btn.dataset.content as 'abstract' | 'dashboard';
  localStorage.removeItem(STORAGE_KEY);
  statusEl.textContent = 'Ready — click any widget';
  fullRebuild();
});

// Layout tabs
layoutTabs.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('.tab-btn') as HTMLElement;
  if (!btn?.dataset.layout) return;
  layoutTabs
    .querySelectorAll('.tab-btn')
    .forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  currentLayout = btn.dataset.layout;
  applyLayout();
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
