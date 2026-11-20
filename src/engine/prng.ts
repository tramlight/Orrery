/**
 * Deterministic 32-bit PRNG (Mulberry32) for 100% reproducible procedural seeds.
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
    if (this.state === 0) {
      this.state = 0x6d2b79f5;
    }
  }

  /** Returns a float in [0, 1) */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns a float in [min, max) */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Returns an integer in [min, max] inclusive */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** Picks one item deterministically from a non-empty array */
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  /** Returns true with probability p */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Returns +1 or -1 */
  sign(): 1 | -1 {
    return this.next() < 0.5 ? 1 : -1;
  }
}

/**
 * Generates a freshly randomized 32-bit unsigned seed using Web Crypto
 * so every session yields a unique infinite feed.
 */
export function generateFreshSeed(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] || 1;
  }
  return ((Math.random() * 0xffffffff) >>> 0) || 1;
}

/**
 * Mixes a session base seed with an item index via Murmur3 finalizer
 * to derive a well-distributed deterministic item seed.
 */
export function deriveItemSeed(sessionSeed: number, index: number): number {
  let h = (sessionSeed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) || 1;
}
