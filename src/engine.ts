import type { AdaptiveState } from './state';

export interface BehaviouralEngineConfig {
  /** Total score budget across all widgets. Default: 100 */
  budget: number;
  /** Score transferred per interaction. Default: 5 */
  increment: number;
  /** Weight threshold step per variant level. A widget needs weight >= (level * growthRate) to reach that variant. With the default of 0.2, variants unlock at weights 0, 0.2, 0.4, 0.6. Default: 0.2 */
  growthRate: number;
  /** Ordered variant names, least to most prominent. */
  variants: string[];
}

export interface WidgetState {
  id: string;
  score: number;
  weight: number;
  clicks: number;
  variant: string;
}

type ChangeListener = (states: WidgetState[]) => void;

interface WidgetEntry {
  id: string;
  score: number;
  clicks: number;
  initialScore: number;
  hasExplicitInitial: boolean;
}

const DEFAULTS: BehaviouralEngineConfig = {
  budget: 100,
  increment: 5,
  growthRate: 0.2,
  variants: ['default'],
};

export class BehaviouralEngine {
  private readonly config: BehaviouralEngineConfig;
  private readonly widgets = new Map<string, WidgetEntry>();
  private readonly listeners = new Set<ChangeListener>();
  private lastInteraction = 0;

  constructor(config?: Partial<BehaviouralEngineConfig>) {
    this.config = { ...DEFAULTS, ...config };
    this.config.variants = [...this.config.variants];
    if (this.config.variants.length === 0) {
      throw new Error('variants must contain at least one entry');
    }
    if (!Number.isFinite(this.config.budget) || this.config.budget <= 0) {
      throw new Error('budget must be a finite positive number');
    }
    if (
      !Number.isFinite(this.config.growthRate) ||
      this.config.growthRate <= 0
    ) {
      throw new Error('growthRate must be a finite positive number');
    }
    if (!Number.isFinite(this.config.increment) || this.config.increment <= 0) {
      throw new Error('increment must be a finite positive number');
    }
  }

  register(id: string, initialScore?: number): void;
  register(widgets: { id: string; initialScore?: number }[]): void;
  register(
    idOrWidgets: string | { id: string; initialScore?: number }[],
    initialScore?: number,
  ): void {
    if (Array.isArray(idOrWidgets)) {
      const seen = new Set<string>();
      for (const w of idOrWidgets) {
        if (this.widgets.has(w.id) || seen.has(w.id)) {
          throw new Error(`Widget "${w.id}" is already registered`);
        }
        if (
          w.initialScore !== undefined &&
          (!Number.isFinite(w.initialScore) || w.initialScore < 0)
        ) {
          throw new Error(
            `initialScore must be a finite non-negative number, got: ${w.initialScore}`,
          );
        }
        seen.add(w.id);
      }
      for (const w of idOrWidgets) {
        this.addWidget(w.id, w.initialScore);
      }
    } else {
      this.addWidget(idOrWidgets, initialScore);
    }
    this.clampToBudget();
    this.emitChange();
  }

  private addWidget(id: string, initialScore?: number): void {
    if (this.widgets.has(id)) {
      throw new Error(`Widget "${id}" is already registered`);
    }
    if (initialScore !== undefined) {
      if (!Number.isFinite(initialScore) || initialScore < 0) {
        throw new Error(
          `initialScore must be a finite non-negative number, got: ${initialScore}`,
        );
      }
    }
    const score = initialScore ?? 0;
    this.widgets.set(id, {
      id,
      score,
      clicks: 0,
      initialScore: score,
      hasExplicitInitial: initialScore !== undefined,
    });
  }

  record(id: string): void {
    const widget = this.widgets.get(id);
    if (!widget) {
      throw new Error(`Widget "${id}" is not registered`);
    }

    this.normalizeScores();
    widget.clicks++;
    this.lastInteraction = Date.now();

    let sumOthers = 0;
    for (const w of this.widgets.values()) {
      if (w.id !== id) sumOthers += w.score;
    }

    if (sumOthers > 0) {
      const drain = Math.min(this.config.increment, sumOthers);
      let actualDrain = 0;
      for (const other of this.widgets.values()) {
        if (other.id === id) continue;
        const loss = drain * (other.score / sumOthers);
        const clamped = Math.max(0, other.score - loss);
        actualDrain += other.score - clamped;
        other.score = clamped;
      }
      widget.score += actualDrain;
    }

    this.normalizeScores();
    this.emitChange();
  }

  getState(): WidgetState[] {
    this.normalizeScores();
    return [...this.widgets.values()].map((w) => this.toWidgetState(w));
  }

  getWidget(id: string): WidgetState {
    this.normalizeScores();
    const widget = this.widgets.get(id);
    if (!widget) {
      throw new Error(`Widget "${id}" is not registered`);
    }
    return this.toWidgetState(widget);
  }

  export(): AdaptiveState {
    this.normalizeScores();
    return {
      version: 1,
      widgets: [...this.widgets.values()].map((w) => ({
        id: w.id,
        score: w.score,
        clicks: w.clicks,
      })),
      lastInteraction: this.lastInteraction,
    };
  }

  /**
   * Restores engine state from a previously exported snapshot.
   *
   * Partial state is fully supported: widgets registered in this engine that
   * are absent from the imported snapshot retain their current scores. After
   * all matching widgets are updated, scores are renormalized to the configured
   * budget, so the absent widgets participate in that redistribution.
   */
  import(state: AdaptiveState): void {
    if (state.version !== 1) {
      throw new Error(`Unsupported state version: ${state.version}`);
    }
    if (!Array.isArray(state.widgets)) {
      throw new Error('Invalid state: widgets must be an array');
    }
    for (const ws of state.widgets) {
      if (ws == null || typeof ws !== 'object') continue;
      const widget = this.widgets.get(ws.id);
      if (widget) {
        // Only update widgets that exist in this engine; unknown ids are ignored.
        if (!Number.isFinite(ws.score) || ws.score < 0) continue;
        if (
          !Number.isFinite(ws.clicks) ||
          !Number.isInteger(ws.clicks) ||
          ws.clicks < 0
        )
          continue;
        widget.score = ws.score;
        widget.clicks = ws.clicks;
      }
    }
    this.lastInteraction = Number.isFinite(state.lastInteraction)
      ? state.lastInteraction
      : 0;
    this.normalizeScores();
    this.emitChange();
  }

  reset(): void {
    for (const widget of this.widgets.values()) {
      widget.score = widget.initialScore;
      widget.clicks = 0;
    }
    this.lastInteraction = 0;
    this.normalizeScores();
    this.emitChange();
  }

  on(event: 'change', cb: ChangeListener): void {
    if ((event as string) !== 'change') {
      throw new Error(`Unknown event: "${event}"`);
    }
    this.listeners.add(cb);
  }

  off(event: 'change', cb: ChangeListener): void {
    if ((event as string) !== 'change') {
      throw new Error(`Unknown event: "${event}"`);
    }
    this.listeners.delete(cb);
  }

  destroy(): void {
    this.listeners.clear();
    this.widgets.clear();
    this.lastInteraction = 0;
  }

  private toWidgetState(entry: WidgetEntry): WidgetState {
    const { budget, growthRate, variants } = this.config;
    const weight = budget > 0 ? entry.score / budget : 0;
    const variantIndex = Math.min(
      Math.floor(weight / growthRate),
      variants.length - 1,
    );
    return {
      id: entry.id,
      score: entry.score,
      weight,
      clicks: entry.clicks,
      variant: variants[variantIndex],
    };
  }

  /** Scales scores down proportionally if their sum exceeds the budget. Never scales up.
   *  Before any interactions, widgets are reset to initialScore to preserve registration
   *  ratios across sequential register() calls. Once interactions have occurred, all
   *  earned scores are respected. */
  private clampToBudget(): void {
    const entries = [...this.widgets.values()];
    if (entries.length === 0) return;
    const hasInteractions = entries.some((e) => e.clicks > 0);
    if (!hasInteractions) {
      for (const entry of entries) {
        entry.score = entry.initialScore;
      }
    }
    const sum = entries.reduce((s, w) => s + w.score, 0);
    if (sum > this.config.budget) {
      const factor = this.config.budget / sum;
      for (const entry of entries) {
        entry.score *= factor;
      }
    }
  }

  private normalizeScores(): void {
    const entries = [...this.widgets.values()];
    if (entries.length === 0) return;
    const sum = entries.reduce((s, w) => s + w.score, 0);
    if (sum === 0) {
      const equal = this.config.budget / entries.length;
      for (const entry of entries) {
        entry.score = equal;
        // Stamp the equal-share as initialScore so that reset() restores equal
        // distribution for widgets that were registered without explicit scores.
        // Widgets registered with an explicit initialScore (even 0) are excluded
        // because their initialScore was deliberately set at registration time.
        if (!entry.hasExplicitInitial) {
          entry.initialScore = equal;
        }
      }
      return;
    }
    const factor = this.config.budget / sum;
    for (const entry of entries) {
      entry.score *= factor;
    }
  }

  private emitChange(): void {
    const states = [...this.widgets.values()].map((w) => this.toWidgetState(w));
    for (const listener of [...this.listeners]) {
      try {
        listener(states);
      } catch {
        /* listener errors must not break the emission chain */
      }
    }
  }
}
