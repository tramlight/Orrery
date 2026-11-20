/**
 * Subtle tactile haptic feedback via the Vibration API (native on Android browsers/WebViews).
 * Silently no-ops on unsupported platforms.
 */
function safeVibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignore restricted environments
  }
}

/** Crisp micro-tick for cryptic icon rune taps */
export function hapticTap(): void {
  safeVibrate(10);
}

/** Distinct tactile lock/unlock pulse when bookmarking a seed to the Vault */
export function hapticBookmark(bookmarked: boolean): void {
  safeVibrate(bookmarked ? [10, 32, 16] : 8);
}

/** Subtle double-tap haptic pulse when a Rare astrolabe scrolls into view */
export function hapticRareArrival(): void {
  safeVibrate([14, 65, 18]);
}

/** Ultra-light tick when expanding or dismissing full-screen view */
export function hapticExpand(): void {
  safeVibrate(7);
}
