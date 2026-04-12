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
}

const DEFAULTS: BehaviouralEngineConfig = {
  budget: 100,
  increment: 5,
  growthRate: 0.2,
  variants: ['default'],
};

export class BehaviouralEngine {
  private readonly config: BehaviouralEngineConfig;
  private widgets = new Map<string, WidgetEntry>();
  private listeners = new Set<ChangeListener>();
  private lastInteraction = 0;
  private dirty = true;

  constructor(config?: Partial<BehaviouralEngineConfig>) {
    this.config = { ...DEFAULTS, ...config };
    if (this.config.variants.length === 0) {
      throw new Error('variants must contain at least one entry');
    }
    if (this.config.budget <= 0) {
      throw new Error('budget must be positive');
    }
    if (this.config.growthRate <= 0) {
      throw new Error('growthRate must be positive');
    }
    if (this.config.increment <= 0) {
      throw new Error('increment must be positive');
    }
  }

  register(id: string, initialScore?: number): void {
    if (this.widgets.has(id)) {
      throw new Error(`Widget "${id}" is already registered`);
    }
    const score = initialScore ?? 0;
    this.widgets.set(id, { id, score, clicks: 0, initialScore: score });
    this.dirty = true;
  }

  record(id: string): void {
    const widget = this.widgets.get(id);
    if (!widget) {
      throw new Error(`Widget "${id}" is not registered`);
    }

    this.ensureNormalized();
    widget.clicks++;
    this.lastInteraction = Date.now();

    const others = [...this.widgets.values()].filter((w) => w.id !== id);
    const sumOthers = others.reduce((s, w) => s + w.score, 0);

    if (sumOthers > 0) {
      const drain = Math.min(this.config.increment, sumOthers);
      let actualDrain = 0;
      for (const other of others) {
        const loss = drain * (other.score / sumOthers);
        const clamped = Math.max(0, other.score - loss);
        actualDrain += other.score - clamped;
        other.score = clamped;
      }
      widget.score += actualDrain;
    }

    this.normalizeScores();
    this.emit();
  }

  getState(): WidgetState[] {
    this.ensureNormalized();
    return [...this.widgets.values()].map((w) => this.toWidgetState(w));
  }

  getWidget(id: string): WidgetState {
    this.ensureNormalized();
    const widget = this.widgets.get(id);
    if (!widget) {
      throw new Error(`Widget "${id}" is not registered`);
    }
    return this.toWidgetState(widget);
  }

  export(): AdaptiveState {
    this.ensureNormalized();
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
    for (const ws of state.widgets) {
      const widget = this.widgets.get(ws.id);
      if (widget) {
        // Only update widgets that exist in this engine; unknown ids are ignored.
        widget.score = ws.score;
        widget.clicks = ws.clicks;
      }
    }
    this.lastInteraction = state.lastInteraction;
    this.normalizeScores();
    this.emit();
  }

  reset(): void {
    for (const widget of this.widgets.values()) {
      widget.score = widget.initialScore;
      widget.clicks = 0;
    }
    this.lastInteraction = 0;
    this.dirty = true;
    this.ensureNormalized();
    this.emit();
  }

  on(event: 'change', cb: ChangeListener): void {
    if (event !== 'change') return;
    this.listeners.add(cb);
  }

  off(event: 'change', cb: ChangeListener): void {
    if (event !== 'change') return;
    this.listeners.delete(cb);
  }

  destroy(): void {
    this.listeners.clear();
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

  private ensureNormalized(): void {
    if (!this.dirty) return;
    this.normalizeScores();
    this.dirty = false;
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
        if (entry.initialScore === 0) {
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

  private emit(): void {
    const states = this.getState();
    for (const listener of this.listeners) {
      listener(states);
    }
  }
}
