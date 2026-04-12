/**
 * Serializable snapshot of the full engine state.
 * Designed to be JSON.stringify'd and stored anywhere:
 * localStorage, IndexedDB, REST API, etc.
 */
export interface AdaptiveState {
  version: 1;
  widgets: { id: string; score: number; clicks: number }[];
  lastInteraction: number;
}
