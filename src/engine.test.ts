import { describe, it, expect, vi } from 'vitest';
import { BehaviouralEngine } from './engine';

function sumScores(engine: BehaviouralEngine): number {
  return engine.getState().reduce((s, w) => s + w.score, 0);
}

describe('BehaviouralEngine', () => {
  describe('constructor', () => {
    it('uses defaults when no config provided', () => {
      const engine = new BehaviouralEngine();
      expect(engine).toBeDefined();
    });

    it('throws on empty variants array', () => {
      expect(() => new BehaviouralEngine({ variants: [] })).toThrow(
        'variants must contain at least one entry',
      );
    });

    it('throws on non-positive budget', () => {
      expect(() => new BehaviouralEngine({ budget: 0 })).toThrow(
        'budget must be positive',
      );
      expect(() => new BehaviouralEngine({ budget: -10 })).toThrow(
        'budget must be positive',
      );
    });

    it('throws on non-positive increment', () => {
      expect(() => new BehaviouralEngine({ increment: 0 })).toThrow(
        'increment must be positive',
      );
      expect(() => new BehaviouralEngine({ increment: -1 })).toThrow(
        'increment must be positive',
      );
    });

    it('throws on non-positive growthRate', () => {
      expect(() => new BehaviouralEngine({ growthRate: 0 })).toThrow(
        'growthRate must be positive',
      );
      expect(() => new BehaviouralEngine({ growthRate: -0.1 })).toThrow(
        'growthRate must be positive',
      );
    });
  });

  describe('register', () => {
    it('distributes budget equally when no initial scores given', () => {
      const engine = new BehaviouralEngine({ budget: 100 });
      engine.register('a');
      engine.register('b');
      engine.register('c');
      const states = engine.getState();
      for (const s of states) {
        expect(s.score).toBeCloseTo(100 / 3);
      }
    });

    it('normalizes pre-seeded scores to budget', () => {
      const engine = new BehaviouralEngine({ budget: 100 });
      engine.register('a', 60);
      engine.register('b', 30);
      engine.register('c', 10);
      expect(sumScores(engine)).toBeCloseTo(100);
      expect(engine.getWidget('a').score).toBeCloseTo(60);
      expect(engine.getWidget('c').score).toBeCloseTo(10);
    });

    it('throws on duplicate registration', () => {
      const engine = new BehaviouralEngine();
      engine.register('a');
      expect(() => engine.register('a')).toThrow('already registered');
    });

    it('batch registers all widgets with a single emit', () => {
      const engine = new BehaviouralEngine({ budget: 100 });
      const cb = vi.fn();
      engine.on('change', cb);

      engine.register([
        { id: 'a', initialScore: 60 },
        { id: 'b', initialScore: 30 },
        { id: 'c', initialScore: 10 },
      ]);

      // Single emit, not three
      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb.mock.calls[0][0]).toHaveLength(3);

      // Scores preserved — no intermediate clamping distortion
      expect(engine.getWidget('a').score).toBeCloseTo(60);
      expect(engine.getWidget('b').score).toBeCloseTo(30);
      expect(engine.getWidget('c').score).toBeCloseTo(10);
      expect(sumScores(engine)).toBeCloseTo(100);
    });

    it('batch register clamps when sum exceeds budget', () => {
      const engine = new BehaviouralEngine({ budget: 100 });
      engine.register([
        { id: 'a', initialScore: 60 },
        { id: 'b', initialScore: 80 },
        { id: 'c', initialScore: 10 },
      ]);

      // 60:80:10 ratio normalized to 100
      expect(engine.getWidget('a').score).toBeCloseTo(40);
      expect(engine.getWidget('b').score).toBeCloseTo(53.33);
      expect(engine.getWidget('c').score).toBeCloseTo(6.67);
    });

    it('batch register throws on duplicate within batch', () => {
      const engine = new BehaviouralEngine();
      expect(() => engine.register([{ id: 'a' }, { id: 'a' }])).toThrow(
        'already registered',
      );
    });
  });

  describe('record', () => {
    it('increases clicked widget score and decreases others', () => {
      const engine = new BehaviouralEngine({ budget: 100, increment: 10 });
      engine.register('a');
      engine.register('b');
      engine.register('c');

      const before = engine.getWidget('a').score;
      engine.record('a');
      const after = engine.getWidget('a').score;
      expect(after).toBeGreaterThan(before);

      expect(engine.getWidget('b').score).toBeLessThan(100 / 3);
      expect(engine.getWidget('c').score).toBeLessThan(100 / 3);
    });

    it('maintains budget invariant after interactions', () => {
      const engine = new BehaviouralEngine({ budget: 100, increment: 5 });
      engine.register('a');
      engine.register('b');
      engine.register('c');
      engine.register('d');

      for (let i = 0; i < 50; i++) {
        const ids = ['a', 'b', 'c', 'd'];
        engine.record(ids[i % ids.length]);
        expect(sumScores(engine)).toBeCloseTo(100);
      }
    });

    it('maintains budget invariant with skewed clicking', () => {
      const engine = new BehaviouralEngine({ budget: 100, increment: 5 });
      engine.register('a');
      engine.register('b');
      engine.register('c');

      for (let i = 0; i < 30; i++) {
        engine.record('a');
      }
      expect(sumScores(engine)).toBeCloseTo(100);
      expect(engine.getWidget('a').score).toBeGreaterThan(80);
    });

    it('drains proportionally — higher scores lose more', () => {
      const engine = new BehaviouralEngine({ budget: 100, increment: 10 });
      engine.register('a', 50);
      engine.register('b', 30);
      engine.register('c', 20);

      const bBefore = engine.getWidget('b').score;
      const cBefore = engine.getWidget('c').score;
      engine.record('a');
      const bLoss = bBefore - engine.getWidget('b').score;
      const cLoss = cBefore - engine.getWidget('c').score;

      expect(bLoss).toBeGreaterThan(cLoss);
    });

    it('throws on unregistered widget', () => {
      const engine = new BehaviouralEngine();
      expect(() => engine.record('unknown')).toThrow('not registered');
    });

    it('increments click count', () => {
      const engine = new BehaviouralEngine();
      engine.register('a');
      expect(engine.getWidget('a').clicks).toBe(0);
      engine.record('a');
      engine.record('a');
      expect(engine.getWidget('a').clicks).toBe(2);
    });

    it('floors scores at 0 — never goes negative', () => {
      const engine = new BehaviouralEngine({ budget: 100, increment: 50 });
      engine.register('a', 90);
      engine.register('b', 5);
      engine.register('c', 5);

      engine.record('a');
      for (const s of engine.getState()) {
        expect(s.score).toBeGreaterThanOrEqual(0);
      }
    });

    it('is a no-op for score when sumOthers === 0 but still increments clicks', () => {
      const engine = new BehaviouralEngine({ budget: 100, increment: 5 });
      engine.register('solo');
      const scoreBefore = engine.getWidget('solo').score;
      engine.record('solo');
      // No other widgets to drain, so score stays at budget after renormalization
      expect(engine.getWidget('solo').score).toBeCloseTo(scoreBefore);
      expect(engine.getWidget('solo').clicks).toBe(1);
    });
  });

  describe('variant resolution', () => {
    it('starts at first variant with equal weights', () => {
      const engine = new BehaviouralEngine({
        variants: ['small', 'medium', 'large'],
        growthRate: 0.25,
      });
      engine.register('a');
      engine.register('b');
      engine.register('c');
      engine.register('d');
      // 4 widgets = 25% each, growthRate 0.25 → floor(0.25/0.25) = 1 → medium
      expect(engine.getWidget('a').variant).toBe('medium');
    });

    it('advances variant as weight increases', () => {
      // growthRate 0.2 with 3 variants: 0-0.19 = small, 0.2-0.39 = medium, 0.4+ = large
      const engine = new BehaviouralEngine({
        budget: 100,
        increment: 10,
        variants: ['small', 'medium', 'large'],
        growthRate: 0.2,
      });
      engine.register('a', 20);
      engine.register('b', 80);

      // a has weight 0.2 → medium
      expect(engine.getWidget('a').variant).toBe('medium');
      // b has weight 0.8 → large (clamped)
      expect(engine.getWidget('b').variant).toBe('large');
    });

    it('drops variant when weight decreases', () => {
      const engine = new BehaviouralEngine({
        budget: 100,
        increment: 15,
        variants: ['small', 'medium', 'large'],
        growthRate: 0.3,
      });
      engine.register('a', 70);
      engine.register('b', 30);

      expect(engine.getWidget('a').variant).toBe('large');

      // Click b many times to drain a
      for (let i = 0; i < 15; i++) engine.record('b');

      // a should have dropped
      expect(engine.getWidget('a').weight).toBeLessThan(0.3);
      expect(engine.getWidget('a').variant).toBe('small');
    });

    it('clamps at last variant', () => {
      const engine = new BehaviouralEngine({
        variants: ['a', 'b'],
        growthRate: 0.3,
      });
      engine.register('x');
      // single widget = weight 1.0, floor(1.0/0.3) = 3, clamped to 1 → 'b'
      expect(engine.getWidget('x').variant).toBe('b');
    });

    it('works with a single variant', () => {
      const engine = new BehaviouralEngine({ variants: ['only'] });
      engine.register('a');
      for (let i = 0; i < 10; i++) engine.record('a');
      expect(engine.getWidget('a').variant).toBe('only');
    });
  });

  describe('weight', () => {
    it('weights sum to 1', () => {
      const engine = new BehaviouralEngine({ budget: 100 });
      engine.register('a');
      engine.register('b');
      engine.register('c');

      engine.record('a');
      engine.record('a');

      const totalWeight = engine.getState().reduce((s, w) => s + w.weight, 0);
      expect(totalWeight).toBeCloseTo(1);
    });
  });

  describe('export / import', () => {
    it('roundtrips state', () => {
      const engine = new BehaviouralEngine({
        budget: 100,
        increment: 5,
        variants: ['s', 'm', 'l'],
        growthRate: 3,
      });
      engine.register('a');
      engine.register('b');
      engine.record('a');
      engine.record('a');
      engine.record('b');

      const exported = engine.export();
      expect(exported.version).toBe(1);
      expect(exported.widgets).toHaveLength(2);

      const engine2 = new BehaviouralEngine({
        budget: 100,
        increment: 5,
        variants: ['s', 'm', 'l'],
        growthRate: 3,
      });
      engine2.register('a');
      engine2.register('b');
      engine2.import(exported);

      expect(engine2.getWidget('a').clicks).toBe(2);
      expect(engine2.getWidget('b').clicks).toBe(1);
      expect(engine2.getWidget('a').score).toBeCloseTo(
        engine.getWidget('a').score,
      );
    });

    it('ignores unknown widgets in imported state', () => {
      const engine = new BehaviouralEngine();
      engine.register('a');
      const state = {
        version: 1 as const,
        widgets: [
          { id: 'a', score: 50, clicks: 3 },
          { id: 'unknown', score: 50, clicks: 1 },
        ],
        lastInteraction: 123,
      };
      engine.import(state);
      expect(engine.getWidget('a').clicks).toBe(3);
    });

    it('throws on unsupported version', () => {
      const engine = new BehaviouralEngine();
      engine.register('a');
      expect(() =>
        engine.import({
          version: 99 as never,
          widgets: [],
          lastInteraction: 0,
        }),
      ).toThrow('Unsupported state version');
    });

    it('retains scores for widgets absent from imported state and normalizes budget', () => {
      const engine = new BehaviouralEngine({ budget: 100, increment: 5 });
      engine.register('a');
      engine.register('b');
      engine.register('c');
      // Before import: all three share the budget equally (100/3 each)
      const cScoreBefore = engine.getWidget('c').score; // ~33.33

      engine.import({
        version: 1,
        widgets: [
          { id: 'a', score: 40, clicks: 2 },
          { id: 'b', score: 40, clicks: 1 },
        ],
        lastInteraction: 999,
      });

      // After import: a=40, b=40, c retains its pre-import score ~33.33
      // normalizeScores() then scales all three to sum to 100:
      //   total = 40 + 40 + 33.33 = ~113.33
      //   c's normalized score = (33.33 / 113.33) * 100 ≈ 29.41
      const expectedCScore = (cScoreBefore / (40 + 40 + cScoreBefore)) * 100;
      expect(engine.getWidget('c').score).toBeCloseTo(expectedCScore);

      // Budget invariant must hold after renormalization
      expect(sumScores(engine)).toBeCloseTo(100);
    });
  });

  describe('reset', () => {
    it('restores initial scores and zeroes clicks', () => {
      const engine = new BehaviouralEngine({ budget: 100, increment: 10 });
      engine.register('a', 70);
      engine.register('b', 30);

      engine.record('b');
      engine.record('b');
      engine.record('b');
      expect(engine.getWidget('b').clicks).toBe(3);

      engine.reset();
      expect(engine.getWidget('a').score).toBeCloseTo(70);
      expect(engine.getWidget('b').score).toBeCloseTo(30);
      expect(engine.getWidget('b').clicks).toBe(0);
    });
  });

  describe('events', () => {
    it('emits change on record', () => {
      const engine = new BehaviouralEngine();
      engine.register('a');
      engine.register('b');

      const cb = vi.fn();
      engine.on('change', cb);
      engine.record('a');
      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb.mock.calls[0][0]).toHaveLength(2);
    });

    it('emits change on register', () => {
      const engine = new BehaviouralEngine();
      const cb = vi.fn();
      engine.on('change', cb);
      engine.register('a', 40);
      engine.register('b', 60);
      expect(cb).toHaveBeenCalledTimes(2);
      // Last emission should contain both widgets
      expect(cb.mock.calls[1][0]).toHaveLength(2);
    });

    it('register emits without distorting pre-seeded scores', () => {
      const engine = new BehaviouralEngine({ budget: 100 });
      engine.register('a', 60);
      engine.register('b', 30);
      engine.register('c', 10);
      // Scores sum to exactly 100 — no distortion from intermediate normalization
      expect(engine.getWidget('a').score).toBeCloseTo(60);
      expect(engine.getWidget('b').score).toBeCloseTo(30);
      expect(engine.getWidget('c').score).toBeCloseTo(10);
    });

    it('register clamps scores when sum exceeds budget', () => {
      const engine = new BehaviouralEngine({ budget: 100 });
      engine.register('a', 80);
      engine.register('b', 80);
      // Total was 160, clamped proportionally to 100
      expect(sumScores(engine)).toBeCloseTo(100);
      expect(engine.getWidget('a').score).toBeCloseTo(50);
      expect(engine.getWidget('b').score).toBeCloseTo(50);
    });

    it('register preserves score ratios when sum exceeds budget', () => {
      const engine = new BehaviouralEngine({ budget: 100 });
      engine.register('a', 60);
      engine.register('b', 80);
      engine.register('c', 10);
      // Original ratio 60:80:10 normalized to budget 100
      expect(engine.getWidget('a').score).toBeCloseTo(40);
      expect(engine.getWidget('b').score).toBeCloseTo(53.33);
      expect(engine.getWidget('c').score).toBeCloseTo(6.67);
    });

    it('emits change on import', () => {
      const engine = new BehaviouralEngine();
      engine.register('a');
      const cb = vi.fn();
      engine.on('change', cb);
      engine.import({
        version: 1,
        widgets: [{ id: 'a', score: 100, clicks: 5 }],
        lastInteraction: 1,
      });
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('emits change on reset', () => {
      const engine = new BehaviouralEngine();
      engine.register('a');
      const cb = vi.fn();
      engine.on('change', cb);
      engine.reset();
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('stops emitting after off', () => {
      const engine = new BehaviouralEngine();
      engine.register('a');
      const cb = vi.fn();
      engine.on('change', cb);
      engine.record('a');
      engine.off('change', cb);
      engine.record('a');
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('stops emitting after destroy', () => {
      const engine = new BehaviouralEngine();
      engine.register('a');
      const cb = vi.fn();
      engine.on('change', cb);
      engine.destroy();
      engine.record('a');
      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('getWidget', () => {
    it('throws on unknown widget id', () => {
      const engine = new BehaviouralEngine();
      expect(() => engine.getWidget('unknown')).toThrow('not registered');
    });
  });

  describe('import() validation', () => {
    it('skips widgets with negative scores', () => {
      const engine = new BehaviouralEngine({ budget: 100 });
      engine.register('a');
      engine.register('b');
      const scoreBefore = engine.getWidget('a').score;

      engine.import({
        version: 1,
        widgets: [{ id: 'a', score: -10, clicks: 0 }],
        lastInteraction: 0,
      });

      // Widget 'a' must not have been updated to a negative score
      expect(engine.getWidget('a').score).toBeGreaterThanOrEqual(0);
      // Since the entry was skipped, the score should still equal the pre-import value
      expect(engine.getWidget('a').score).toBeCloseTo(scoreBefore);
    });

    it('skips widgets with NaN scores', () => {
      const engine = new BehaviouralEngine({ budget: 100 });
      engine.register('a');
      const scoreBefore = engine.getWidget('a').score;

      engine.import({
        version: 1,
        widgets: [{ id: 'a', score: NaN, clicks: 0 }],
        lastInteraction: 0,
      });

      expect(engine.getWidget('a').score).toBeCloseTo(scoreBefore);
    });

    it('skips widgets with non-integer clicks', () => {
      const engine = new BehaviouralEngine({ budget: 100 });
      engine.register('a');

      engine.import({
        version: 1,
        widgets: [{ id: 'a', score: 50, clicks: 1.5 }],
        lastInteraction: 0,
      });

      // Entry was skipped due to invalid clicks; clicks counter must remain 0
      expect(engine.getWidget('a').clicks).toBe(0);
    });

    it('skips widgets with negative clicks', () => {
      const engine = new BehaviouralEngine({ budget: 100 });
      engine.register('a');

      engine.import({
        version: 1,
        widgets: [{ id: 'a', score: 50, clicks: -3 }],
        lastInteraction: 0,
      });

      expect(engine.getWidget('a').clicks).toBe(0);
    });
  });

  describe('on() / off() unknown events', () => {
    it('throws when subscribing to an unknown event', () => {
      const engine = new BehaviouralEngine();
      // Cast to bypass TS check — simulates a JS caller passing an invalid event
      expect(() => engine.on('unknown' as 'change', vi.fn())).toThrow(
        'Unknown event',
      );
    });

    it('throws when unsubscribing from an unknown event', () => {
      const engine = new BehaviouralEngine();
      expect(() => engine.off('unknown' as 'change', vi.fn())).toThrow(
        'Unknown event',
      );
    });
  });

  describe('register() with explicit initialScore 0', () => {
    it('reset restores score to 0, not equal share', () => {
      // 'a' is registered with explicit 0, 'b' with 50
      // After normalization: sum = 50, so a=0, b=100
      // After reset: a must go back to 0 (not equal share)
      const engine = new BehaviouralEngine({ budget: 100 });
      engine.register('a', 0);
      engine.register('b', 50);

      engine.record('b');
      engine.record('b');

      engine.reset();

      // a was explicitly registered with 0 — it should restore to 0
      expect(engine.getWidget('a').score).toBeCloseTo(0);
      // budget invariant: b holds the whole budget after normalization
      expect(sumScores(engine)).toBeCloseTo(100);
    });
  });

  describe('register() after interactions', () => {
    it('budget invariant holds after late registration', () => {
      const engine = new BehaviouralEngine({ budget: 100, increment: 5 });
      engine.register('a');
      engine.register('b');

      engine.record('a');
      engine.record('a');
      engine.record('b');

      // Register a third widget after interactions have already happened
      engine.register('c');

      // getState() triggers ensureNormalized() which sets dirty = false
      const sum = sumScores(engine);
      expect(sum).toBeCloseTo(100);
    });

    it('preserves score differentiation after late registration', () => {
      const engine = new BehaviouralEngine({ budget: 100, increment: 10 });
      engine.register('a');
      engine.register('b');

      // Click a several times to build a clear advantage
      engine.record('a');
      engine.record('a');
      engine.record('a');

      const aBeforeReg = engine.getWidget('a').score;
      const bBeforeReg = engine.getWidget('b').score;
      expect(aBeforeReg).toBeGreaterThan(bBeforeReg);

      // Late registration should not destroy earned differentiation
      engine.register('c');

      expect(engine.getWidget('a').score).toBeGreaterThan(
        engine.getWidget('b').score,
      );
      expect(sumScores(engine)).toBeCloseTo(100);
    });
  });

  describe('register() input validation', () => {
    it('throws when initialScore is NaN', () => {
      const engine = new BehaviouralEngine();
      expect(() => engine.register('a', NaN)).toThrow(
        'finite non-negative number',
      );
    });

    it('throws when initialScore is Infinity', () => {
      const engine = new BehaviouralEngine();
      expect(() => engine.register('a', Infinity)).toThrow(
        'finite non-negative number',
      );
    });

    it('throws when initialScore is negative', () => {
      const engine = new BehaviouralEngine();
      expect(() => engine.register('a', -1)).toThrow(
        'finite non-negative number',
      );
    });
  });

  describe('export / import with mismatched widgets in both directions', () => {
    it('handles snapshot that has extra widgets AND is missing local widgets', () => {
      // Engine has: a, b, c
      // Snapshot has: a, b, d (d is unknown; c is absent)
      const engine = new BehaviouralEngine({ budget: 100, increment: 5 });
      engine.register('a');
      engine.register('b');
      engine.register('c');

      const cScoreBefore = engine.getWidget('c').score; // ~33.33

      engine.import({
        version: 1,
        widgets: [
          { id: 'a', score: 40, clicks: 2 },
          { id: 'b', score: 20, clicks: 1 },
          { id: 'd', score: 40, clicks: 5 }, // unknown — must be ignored
        ],
        lastInteraction: 500,
      });

      // 'd' is not registered, so it must be silently ignored
      expect(() => engine.getWidget('d')).toThrow('not registered');

      // 'c' was absent from the snapshot, so it retains its pre-import score
      const expectedCScore = (cScoreBefore / (40 + 20 + cScoreBefore)) * 100;
      expect(engine.getWidget('c').score).toBeCloseTo(expectedCScore);

      // Budget invariant must hold
      expect(sumScores(engine)).toBeCloseTo(100);

      // Known widgets were updated correctly
      expect(engine.getWidget('a').clicks).toBe(2);
      expect(engine.getWidget('b').clicks).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('handles single widget', () => {
      const engine = new BehaviouralEngine({ budget: 100 });
      engine.register('solo');
      engine.record('solo');
      expect(engine.getWidget('solo').score).toBeCloseTo(100);
      expect(engine.getWidget('solo').weight).toBeCloseTo(1);
    });

    it('does not crash when a listener removes itself during emission', () => {
      const engine = new BehaviouralEngine({ budget: 100 });
      engine.register('a');
      engine.register('b');

      let callCount = 0;
      const selfRemovingListener = () => {
        callCount++;
        engine.off('change', selfRemovingListener);
      };
      engine.on('change', selfRemovingListener);

      // Should not throw
      engine.record('a');
      expect(callCount).toBe(1);

      // Listener was removed; a second record must not call it again
      engine.record('b');
      expect(callCount).toBe(1);
    });

    it('maintains budget invariant with 100 widgets and 200 random interactions', () => {
      const engine = new BehaviouralEngine({ budget: 100, increment: 5 });
      const ids: string[] = [];
      for (let i = 0; i < 100; i++) {
        const id = `w${i}`;
        ids.push(id);
        engine.register(id);
      }

      // Deterministic pseudo-random sequence using a simple LCG
      let seed = 42;
      const next = () => {
        seed = (seed * 1664525 + 1013904223) & 0xffffffff;
        return Math.abs(seed);
      };

      for (let i = 0; i < 200; i++) {
        engine.record(ids[next() % ids.length]);
      }

      expect(sumScores(engine)).toBeCloseTo(100, 5);
    });
  });
});
