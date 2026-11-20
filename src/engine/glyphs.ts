import { SeededRandom } from './prng';
import { AvatarSpec, GlyphSpec, GlyphStroke } from './types';

/**
 * Generates a deterministic minimalist geometric avatar spec from a PRNG stream.
 */
export function generateAvatarSpec(rng: SeededRandom, symmetryOrder: number): AvatarSpec {
  const frames: readonly AvatarSpec['frame'][] = ['circle', 'hexagon', 'octagon', 'diamond'];
  const validSymmetries = [3, 4, 5, 6, 8];
  const sym = validSymmetries.includes(symmetryOrder)
    ? symmetryOrder
    : rng.pick(validSymmetries);

  return {
    frame: rng.pick(frames),
    symmetry: sym,
    innerPolygons: rng.int(1, 2),
    hasCross: rng.chance(0.55),
    hasCenterDot: rng.chance(0.75),
    ringScale: rng.range(0.54, 0.72),
    rotationDeg: rng.pick([0, 15, 30, 45, 60]),
  };
}

/**
 * Builds a single abstract alien-geometric glyph on a 10x12 coordinate grid.
 * Constructed strictly from geometric strokes, arcs, triangles, chevrons, and nodes—
 * never Latin letters or numerals.
 */
function createSingleGlyph(rng: SeededRandom): GlyphSpec {
  const strokes: GlyphStroke[] = [];
  const archetype = rng.int(0, 11);

  switch (archetype) {
    case 0: {
      // Split vertical axis with diamond core
      strokes.push({ type: 'line', d: 'M 5 1 L 5 3.2 M 5 8.8 L 5 11' });
      strokes.push({ type: 'poly', d: 'M 5 3.2 L 7.8 6 L 5 8.8 L 2.2 6 Z' });
      if (rng.chance(0.5)) strokes.push({ type: 'circle', cx: 5, cy: 6, r: 0.85, filled: true });
      break;
    }
    case 1: {
      // Twin opposing chevrons with floating pivot dot
      strokes.push({ type: 'line', d: 'M 2 3.5 L 5 1.2 L 8 3.5' });
      strokes.push({ type: 'line', d: 'M 2 8.5 L 5 10.8 L 8 8.5' });
      strokes.push({ type: 'circle', cx: 5, cy: 6, r: 1.0, filled: rng.chance(0.6) });
      break;
    }
    case 2: {
      // Astrolabe crescent + meridian spine
      const flip = rng.chance(0.5);
      strokes.push({
        type: 'arc',
        d: flip ? 'M 6.5 2 A 4 4 0 1 0 6.5 10' : 'M 3.5 2 A 4 4 0 1 1 3.5 10',
      });
      strokes.push({ type: 'line', d: 'M 1.5 6 L 8.5 6' });
      if (rng.chance(0.5)) {
        strokes.push({ type: 'circle', cx: flip ? 7.6 : 2.4, cy: 6, r: 0.8, filled: true });
      }
      break;
    }
    case 3: {
      // Inscribed inverted pyramid with horizon bar
      const up = rng.chance(0.5);
      strokes.push({
        type: 'poly',
        d: up ? 'M 5 1.5 L 8.5 9.5 L 1.5 9.5 Z' : 'M 1.5 2.5 L 8.5 2.5 L 5 10.5 Z',
      });
      strokes.push({ type: 'line', d: up ? 'M 2 6 L 8 6' : 'M 5 1 L 5 5.5' });
      break;
    }
    case 4: {
      // Parallel vernier bars with diagonal bridge
      const diag = rng.chance(0.5);
      strokes.push({ type: 'line', d: 'M 2.2 1.8 L 2.2 10.2 M 7.8 1.8 L 7.8 10.2' });
      strokes.push({
        type: 'line',
        d: diag ? 'M 2.2 3.5 L 7.8 8.5' : 'M 2.2 8.5 L 7.8 3.5',
      });
      if (rng.chance(0.45)) strokes.push({ type: 'circle', cx: 5, cy: 2.2, r: 0.75, filled: true });
      break;
    }
    case 5: {
      // Orbital ring bisected by diagonal reticle
      strokes.push({ type: 'circle', cx: 5, cy: 6, r: 3.1, filled: false });
      const dir = rng.chance(0.5);
      strokes.push({
        type: 'line',
        d: dir ? 'M 1.5 2.5 L 8.5 9.5' : 'M 8.5 2.5 L 1.5 9.5',
      });
      break;
    }
    case 6: {
      // Stepped alien bracket with twin node pips
      const mirror = rng.chance(0.5);
      strokes.push({
        type: 'line',
        d: mirror ? 'M 7.5 1.5 L 3 1.5 L 3 6 L 7.5 10.5' : 'M 2.5 1.5 L 7 1.5 L 7 6 L 2.5 10.5',
      });
      strokes.push({ type: 'circle', cx: mirror ? 7.2 : 2.8, cy: 5.5, r: 0.85, filled: true });
      break;
    }
    case 7: {
      // Hourglass / dual prism apex
      strokes.push({ type: 'line', d: 'M 2 2 L 8 2 L 2 10 L 8 10' });
      strokes.push({ type: 'line', d: 'M 5 1 L 5 11' });
      break;
    }
    case 8: {
      // Three-node constellation with vertical chord
      strokes.push({ type: 'line', d: 'M 2.2 3 L 7.8 6 L 2.2 9' });
      strokes.push({ type: 'circle', cx: 2.2, cy: 3, r: 0.85, filled: true });
      strokes.push({ type: 'circle', cx: 7.8, cy: 6, r: 0.85, filled: false });
      strokes.push({ type: 'circle', cx: 2.2, cy: 9, r: 0.85, filled: true });
      break;
    }
    case 9: {
      // Crossed tuning fork / astrolabe pointer
      strokes.push({ type: 'line', d: 'M 5 1.2 L 5 10.8' });
      strokes.push({ type: 'line', d: 'M 2 4 L 5 6.8 L 8 4' });
      strokes.push({ type: 'line', d: 'M 2.5 9.5 L 7.5 9.5' });
      break;
    }
    case 10: {
      // Concentric half-arcs facing outward
      strokes.push({ type: 'arc', d: 'M 2 2.5 A 3.5 3.5 0 0 1 2 9.5' });
      strokes.push({ type: 'arc', d: 'M 8 2.5 A 3.5 3.5 0 0 0 8 9.5' });
      strokes.push({ type: 'circle', cx: 5, cy: 6, r: 0.85, filled: true });
      break;
    }
    default: {
      // Broken octagon/hex reticle
      strokes.push({ type: 'line', d: 'M 3.2 1.8 L 6.8 1.8 L 8.6 4.2' });
      strokes.push({ type: 'line', d: 'M 6.8 10.2 L 3.2 10.2 L 1.4 7.8' });
      strokes.push({ type: 'line', d: 'M 2.5 6 L 7.5 6' });
      break;
    }
  }

  return { strokes };
}

/**
 * Generates a short deterministic sequence of 5 to 7 abstract procedural glyphs
 * serving as an alien text-free "handle".
 */
export function generateHandleGlyphs(rng: SeededRandom): GlyphSpec[] {
  const count = rng.int(5, 7);
  const glyphs: GlyphSpec[] = [];
  for (let i = 0; i < count; i++) {
    glyphs.push(createSingleGlyph(rng));
  }
  return glyphs;
}
