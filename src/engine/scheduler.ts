type TickCallback = (nowSec: number, dtSec: number) => void;

interface Subscription {
  id: string;
  isFullscreen: boolean;
  callback: TickCallback;
}

/**
 * Centralized single-RAF animation scheduler.
 * Only ticks currently visible canvases, automatically pauses background feed cards
 * while a full-screen astrolabe is open, and pauses entirely when the page is hidden.
 */
class AnimationScheduler {
  private subscribers = new Map<string, Subscription>();
  private rafId: number | null = null;
  private lastTimeMs: number | null = null;
  private feedPaused = false;
  private pageHidden = false;
  private reducedMotion = false;

  constructor() {
    if (typeof document !== 'undefined') {
      this.pageHidden = document.hidden;
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reducedMotion = mq.matches;
      mq.addEventListener?.('change', (e) => {
        this.reducedMotion = e.matches;
      });
    }
  }

  private handleVisibilityChange = () => {
    this.pageHidden = document.hidden;
    if (this.pageHidden) {
      this.stopLoop();
    } else if (this.subscribers.size > 0) {
      this.startLoop();
    }
  };

  setFeedPaused(paused: boolean): void {
    this.feedPaused = paused;
  }

  subscribe(id: string, callback: TickCallback, isFullscreen = false): () => void {
    this.subscribers.set(id, { id, callback, isFullscreen });
    if (!this.pageHidden) {
      this.startLoop();
    }
    return () => {
      this.subscribers.delete(id);
      if (this.subscribers.size === 0) {
        this.stopLoop();
      }
    };
  }

  private startLoop(): void {
    if (this.rafId !== null) return;
    this.lastTimeMs = null;
    this.rafId = window.requestAnimationFrame(this.tick);
  }

  private stopLoop(): void {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.lastTimeMs = null;
  }

  private tick = (nowMs: number): void => {
    if (this.pageHidden || this.subscribers.size === 0) {
      this.rafId = null;
      this.lastTimeMs = null;
      return;
    }

    const rawDt = this.lastTimeMs === null ? 1 / 60 : (nowMs - this.lastTimeMs) / 1000;
    this.lastTimeMs = nowMs;

    // Clamp delta to avoid huge leaps after pausing/tab switching
    const clampedDt = Math.min(Math.max(rawDt, 0), 0.05);
    const effectiveDt = this.reducedMotion ? clampedDt * 0.22 : clampedDt;
    const nowSec = nowMs / 1000;

    this.subscribers.forEach((sub) => {
      if (this.feedPaused && !sub.isFullscreen) {
        return;
      }
      sub.callback(nowSec, effectiveDt);
    });

    this.rafId = window.requestAnimationFrame(this.tick);
  };
}

export const animationScheduler = new AnimationScheduler();
