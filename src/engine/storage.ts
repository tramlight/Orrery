const VAULT_KEY = 'orrery_vault_seeds_v1';
const RESONATED_KEY = 'orrery_resonated_seeds_v1';
const INVERTED_KEY = 'orrery_inverted_seeds_v1';

function readNumberArray(key: string): number[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
  } catch {
    return [];
  }
}

function writeNumberArray(key: string, values: number[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(values));
  } catch {
    // Ignore storage quota or private-mode restrictions
  }
}

export function loadVaultSeeds(): number[] {
  return readNumberArray(VAULT_KEY);
}

export function saveVaultSeeds(seeds: number[]): void {
  writeNumberArray(VAULT_KEY, seeds);
}

export function loadResonatedSeeds(): Set<number> {
  return new Set(readNumberArray(RESONATED_KEY));
}

export function saveResonatedSeeds(seeds: Set<number>): void {
  // Keep latest 500 resonated states lightweight
  const arr = Array.from(seeds).slice(-500);
  writeNumberArray(RESONATED_KEY, arr);
}

export function loadInvertedSeeds(): Set<number> {
  return new Set(readNumberArray(INVERTED_KEY));
}

export function saveInvertedSeeds(seeds: Set<number>): void {
  const arr = Array.from(seeds).slice(-500);
  writeNumberArray(INVERTED_KEY, arr);
}
