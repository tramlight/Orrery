import { generateAvatarSpec, generateHandleGlyphs } from './glyphs';
import { SeededRandom } from './prng';
import {
  AstrolabeLayer,
  AstrolabePalette,
  AstrolabeSpec,
  LayerColorRole,
  Rarity,
} from './types';

// Curated digital astrolabe palettes (crisp high-contrast neon vectors on deep obsidian)
const COMMON_PALETTES: readonly AstrolabePalette[] = [
  {
    id: 'glacial-cyan',
    primaryRgb: [56, 189, 248],
    secondaryRgb: [148, 163, 184],
    accentRgb: [186, 230, 253],
    primaryHex: '#38BDF8',
    secondaryHex: '#94A3B8',
    accentHex: '#BAE6FD',
  },
  {
    id: 'orbital-silver',
    primaryRgb: [203, 213, 225],
    secondaryRgb: [100, 116, 139],
    accentRgb: [147, 197, 253],
    primaryHex: '#CBD5E1',
    secondaryHex: '#64748B',
    accentHex: '#93C5FD',
  },
  {
    id: 'meridian-aqua',
    primaryRgb: [34, 211, 238],
    secondaryRgb: [94, 234, 212],
    accentRgb: [165, 243, 252],
    primaryHex: '#22D3EE',
    secondaryHex: '#5EEAD4',
    accentHex: '#A5F3FC',
  },
  {
    id: 'arctic-slate',
    primaryRgb: [125, 211, 252],
    secondaryRgb: [129, 140, 248],
    accentRgb: [224, 242, 254],
    primaryHex: '#7DD3FC',
    secondaryHex: '#818CF8',
    accentHex: '#E0F2FE',
  },
];

const UNCOMMON_PALETTES: readonly AstrolabePalette[] = [
  {
    id: 'azure-emerald',
    primaryRgb: [6, 182, 212],
    secondaryRgb: [52, 211, 153],
    accentRgb: [103, 232, 249],
    primaryHex: '#06B6D4',
    secondaryHex: '#34D399',
    accentHex: '#67E8F9',
  },
  {
    id: 'indigo-cyan',
    primaryRgb: [129, 140, 248],
    secondaryRgb: [56, 189, 248],
    accentRgb: [199, 210, 254],
    primaryHex: '#818CF8',
    secondaryHex: '#38BDF8',
    accentHex: '#C7D2FE',
  },
  {
    id: 'jade-astrolabe',
    primaryRgb: [16, 185, 129],
    secondaryRgb: [34, 211, 238],
    accentRgb: [167, 243, 208],
    primaryHex: '#10B981',
    secondaryHex: '#22D3EE',
    accentHex: '#A7F3D0',
  },
  {
    id: 'cobalt-violet',
    primaryRgb: [96, 165, 250],
    secondaryRgb: [167, 139, 250],
    accentRgb: [191, 219, 254],
    primaryHex: '#60A5FA',
    secondaryHex: '#A78BFA',
    accentHex: '#BFDBFE',
  },
];

// Rare palettes feature a distinct warm/spectral accent color shift
const RARE_PALETTES: readonly AstrolabePalette[] = [
  {
    id: 'sovereign-gold',
    primaryRgb: [245, 158, 11],
    secondaryRgb: [56, 189, 248],
    accentRgb: [253, 224, 71],
    primaryHex: '#F59E0B',
    secondaryHex: '#38BDF8',
    accentHex: '#FDE047',
  },
  {
    id: 'crimson-orrery',
    primaryRgb: [251, 113, 133],
    secondaryRgb: [251, 191, 36],
    accentRgb: [254, 205, 211],
    primaryHex: '#FB7185',
    secondaryHex: '#FBBF24',
    accentHex: '#FECDD3',
  },
  {
    id: 'solar-amber',
    primaryRgb: [251, 191, 36],
    secondaryRgb: [251, 146, 60],
    accentRgb: [254, 243, 199],
    primaryHex: '#FBBF24',
    secondaryHex: '#FB923C',
    accentHex: '#FEF3C7',
  },
  {
    id: 'spectral-rose-gold',
    primaryRgb: [244, 114, 182],
    secondaryRgb: [103, 232, 249],
    accentRgb: [253, 224, 71],
    primaryHex: '#F472B6',
    secondaryHex: '#67E8F9',
    accentHex: '#FDE047',
  },
];

// Valid Schlafli star polygon step values coprime to N
function pickStarStep(rng: SeededRandom, sides: number, allowRegular = true): number {
  const candidates: number[] = allowRegular ? [1] : [];
  for (let k = 2; k < sides / 2; k++) {
    if (gcd(sides, k) === 1 || (sides >= 6 && k === 2)) {
      candidates.push(k);
    }
  }
  if (candidates.length === 0) return 1;
  return rng.pick(candidates);
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

/**
 * Deterministic cache so scrolling back & forth or opening fullscreen never recomputes specs.
 */
const specCache = new Map<number, AstrolabeSpec>();

export function getAstrolabeSpec(seed: number): AstrolabeSpec {
  const cached = specCache.get(seed);
  if (cached) return cached;

  const spec = compileAstrolabe(seed);
  if (specCache.size > 300) {
    // Evict oldest entry to keep memory strictly bounded
    const firstKey = specCache.keys().next().value;
    if (firstKey !== undefined) {
      specCache.delete(firstKey);
    }
  }
  specCache.set(seed, spec);
  return spec;
}

function compileAstrolabe(seed: number): AstrolabeSpec {
  const rng = new SeededRandom(seed);

  // Determine rarity deterministically from seed (~58% Common, ~29% Uncommon, ~13% Rare)
  const roll = rng.next();
  const rarity: Rarity = roll < 0.13 ? 'rare' : roll < 0.42 ? 'uncommon' : 'common';

  // Core symmetry order governs harmonic coherence across all layers
  const symmetryOrder =
    rarity === 'rare'
      ? rng.pick([6, 8, 9, 10, 12])
      : rarity === 'uncommon'
      ? rng.pick([4, 5, 6, 8, 12])
      : rng.pick([3, 4, 5, 6, 8]);

  const palette =
    rarity === 'rare'
      ? rng.pick(RARE_PALETTES)
      : rarity === 'uncommon'
      ? rng.pick(UNCOMMON_PALETTES)
      : rng.pick(COMMON_PALETTES);

  const layers: AstrolabeLayer[] = [];

  if (rarity === 'common') {
    buildCommonLayers(rng, symmetryOrder, layers);
  } else if (rarity === 'uncommon') {
    buildUncommonLayers(rng, symmetryOrder, layers);
  } else {
    buildRareLayers(rng, symmetryOrder, layers);
  }

  // Generate alien social chrome deterministically from a branched PRNG stream
  const chromeRng = new SeededRandom((seed ^ 0x5bf03635) >>> 0);
  const avatar = generateAvatarSpec(chromeRng, symmetryOrder);
  const handleGlyphs = generateHandleGlyphs(chromeRng);

  return {
    seed,
    rarity,
    symmetryOrder,
    palette,
    layers,
    avatar,
    handleGlyphs,
    globalPulseSpeed: rng.range(0.55, 1.1),
  };
}

function pickRole(rng: SeededRandom, preferAccent = false): LayerColorRole {
  if (preferAccent && rng.chance(0.55)) return 'accent';
  return rng.chance(0.65) ? 'primary' : 'secondary';
}

function buildCommonLayers(
  rng: SeededRandom,
  sym: number,
  layers: AstrolabeLayer[],
): void {
  // 1. Clean outer framing ring or dial
  const outerRadius = rng.range(0.76, 0.85);
  layers.push({
    kind: 'concentricRing',
    radius: outerRadius,
    arcCount: rng.chance(0.55) ? 1 : sym,
    arcFillRatio: rng.range(0.62, 0.88),
    doubleStroke: rng.chance(0.35),
    doubleGap: 0.024,
    dashed: rng.chance(0.3),
    dashUnits: rng.pick([6, 10, 14]),
    endCaps: rng.pick(['none', 'dots', 'ticks']),
    colorRole: 'primary',
    opacity: 0.82,
    lineWidth: 1.35,
    rotationSpeed: rng.range(0.08, 0.22),
    direction: rng.sign(),
    initialPhase: rng.range(0, Math.PI * 2),
  });

  // 2. Subtle radial tick dial OR secondary clean concentric ring
  if (rng.chance(0.62)) {
    const mult = rng.pick([4, 6, 8]);
    layers.push({
      kind: 'tickDial',
      radius: outerRadius - rng.range(0.07, 0.13),
      tickCount: Math.min(72, sym * mult),
      majorEvery: mult,
      minorLength: 0.024,
      majorLength: 0.055,
      style: rng.pick(['lines', 'dots', 'notches']),
      inward: rng.chance(0.6),
      colorRole: 'secondary',
      opacity: 0.72,
      lineWidth: 1.05,
      rotationSpeed: rng.range(0.04, 0.14),
      direction: rng.sign(),
      initialPhase: rng.range(0, Math.PI * 2),
    });
  } else {
    layers.push({
      kind: 'concentricRing',
      radius: rng.range(0.52, 0.64),
      arcCount: rng.pick([2, 3, 4, sym]),
      arcFillRatio: rng.range(0.5, 0.78),
      doubleStroke: false,
      doubleGap: 0.02,
      dashed: rng.chance(0.45),
      dashUnits: 8,
      endCaps: 'dots',
      colorRole: 'secondary',
      opacity: 0.75,
      lineWidth: 1.15,
      rotationSpeed: rng.range(0.12, 0.28),
      direction: rng.sign(),
      initialPhase: rng.range(0, Math.PI * 2),
    });
  }

  // 3. Central hero primitive: simple inscribed polygon OR clean orbital ring
  if (rng.chance(0.65)) {
    layers.push({
      kind: 'inscribedPolygon',
      radius: rng.range(0.42, 0.6),
      sides: sym,
      starStep: rng.chance(0.3) ? pickStarStep(rng, sym, false) : 1,
      nestedCount: rng.int(1, 2),
      nestedScale: rng.range(0.68, 0.8),
      nestedTwist: Math.PI / sym,
      vertexNodes: rng.pick(['dots', 'rings', 'none']),
      vertexNodeSize: 0.02,
      drawCircumcircle: rng.chance(0.4),
      colorRole: 'primary',
      opacity: 0.9,
      lineWidth: 1.3,
      rotationSpeed: rng.range(0.14, 0.34),
      direction: rng.sign(),
      initialPhase: rng.range(0, Math.PI * 2),
    });
  } else {
    layers.push({
      kind: 'orbitalSystem',
      orbitRadius: rng.range(0.42, 0.58),
      bodyCount: sym,
      bodyRadius: rng.range(0.024, 0.036),
      bodyStyle: rng.pick(['ring', 'diamond', 'solid']),
      showTrack: true,
      showRadialArms: rng.chance(0.4),
      connectBodies: rng.chance(0.45),
      hasEpicycle: false,
      epicycleRadius: 0,
      epicycleSpeed: 0,
      epicycleBodies: 0,
      colorRole: 'accent',
      opacity: 0.88,
      lineWidth: 1.2,
      rotationSpeed: rng.range(0.18, 0.38),
      direction: rng.sign(),
      initialPhase: rng.range(0, Math.PI * 2),
    });
  }

  // 4. Minimal crisp center reticle
  layers.push({
    kind: 'coreSigil',
    radius: rng.range(0.11, 0.16),
    variant: rng.pick(['reticle', 'diamondStar']),
    petals: sym,
    colorRole: 'accent',
    opacity: 0.85,
    lineWidth: 1.15,
    rotationSpeed: rng.range(0.1, 0.25),
    direction: rng.sign(),
    initialPhase: 0,
  });
}

function buildUncommonLayers(
  rng: SeededRandom,
  sym: number,
  layers: AstrolabeLayer[],
): void {
  const dirA = rng.sign();
  const dirB: 1 | -1 = dirA === 1 ? -1 : 1;

  // 1. Precision outer dial
  layers.push({
    kind: 'tickDial',
    radius: rng.range(0.8, 0.87),
    tickCount: Math.min(96, sym * rng.pick([6, 8, 12])),
    majorEvery: rng.pick([4, 6, 8]),
    minorLength: 0.022,
    majorLength: 0.052,
    style: rng.pick(['lines', 'chevrons', 'notches']),
    inward: true,
    colorRole: 'secondary',
    opacity: 0.78,
    lineWidth: 1.05,
    rotationSpeed: rng.range(0.06, 0.15),
    direction: dirA,
    initialPhase: rng.range(0, Math.PI * 2),
  });

  // 2. Vernier sweeping arc brackets
  layers.push({
    kind: 'vernierArcs',
    radius: rng.range(0.7, 0.77),
    arcCount: sym % 2 === 0 ? Math.min(sym, 6) : sym,
    spanAngle: (Math.PI / sym) * rng.range(0.7, 1.25),
    radialThickness: 0.028,
    sweepAmp: rng.range(0.08, 0.25),
    sweepFreq: rng.range(0.5, 1.1),
    hasPointers: rng.chance(0.75),
    colorRole: 'primary',
    opacity: 0.84,
    lineWidth: 1.25,
    rotationSpeed: rng.range(0.14, 0.28),
    direction: dirB,
    initialPhase: rng.range(0, Math.PI * 2),
  });

  // 3. Harmonic curve OR Astrolabe Rete OR Chord Matrix
  const motif = rng.int(0, 2);
  if (motif === 0) {
    const curveType = rng.pick(['rose', 'hypotrochoid', 'lissajousRadial'] as const);
    const ratios: readonly [number, number][] = [
      [5, 2],
      [7, 2],
      [6, 1],
      [8, 3],
      [4, 1],
    ];
    const [ratioNum, ratioDen] = rng.pick(ratios);
    layers.push({
      kind: 'harmonicCurve',
      curveType,
      baseRadius: rng.range(0.46, 0.58),
      amplitude: rng.range(0.14, 0.24),
      lobes: sym,
      secondaryHarmonic: sym * 2,
      ratioNum,
      ratioDen,
      penOffset: rng.range(0.48, 0.86),
      breatheAmp: rng.range(0.05, 0.14),
      breatheFreq: rng.range(0.55, 1.15),
      samples: 260,
      colorRole: 'accent',
      opacity: 0.88,
      lineWidth: 1.25,
      rotationSpeed: rng.range(0.12, 0.26),
      direction: dirA,
      initialPhase: rng.range(0, Math.PI * 2),
    });
  } else if (motif === 1) {
    layers.push({
      kind: 'astrolabeRete',
      ringCount: Math.min(sym, 8),
      centerOffset: rng.range(0.2, 0.29),
      ringRadius: rng.range(0.32, 0.42),
      drawIntersectionNodes: true,
      colorRole: 'primary',
      opacity: 0.78,
      lineWidth: 1.15,
      rotationSpeed: rng.range(0.12, 0.24),
      direction: dirA,
      initialPhase: rng.range(0, Math.PI * 2),
    });
  } else {
    const pts = sym * rng.pick([3, 4]);
    layers.push({
      kind: 'chordMatrix',
      radius: rng.range(0.6, 0.68),
      points: Math.min(36, pts),
      step: Math.max(3, Math.floor(Math.min(36, pts) * rng.range(0.28, 0.42))),
      layers: 1,
      innerRadiusRatio: 0.72,
      colorRole: 'secondary',
      opacity: 0.68,
      lineWidth: 1.0,
      rotationSpeed: rng.range(0.1, 0.2),
      direction: dirA,
      initialPhase: rng.range(0, Math.PI * 2),
    });
  }

  // 4. Counter-rotating nested inscribed polygon array
  layers.push({
    kind: 'inscribedPolygon',
    radius: rng.range(0.48, 0.62),
    sides: sym,
    starStep: pickStarStep(rng, sym, true),
    nestedCount: rng.int(2, 3),
    nestedScale: rng.range(0.74, 0.84),
    nestedTwist: Math.PI / sym,
    vertexNodes: rng.pick(['rings', 'diamonds', 'dots']),
    vertexNodeSize: 0.022,
    drawCircumcircle: rng.chance(0.55),
    colorRole: 'primary',
    opacity: 0.9,
    lineWidth: 1.3,
    rotationSpeed: rng.range(0.2, 0.42),
    direction: dirB,
    initialPhase: rng.range(0, Math.PI * 2),
  });

  // 5. Orbital epicycle system
  layers.push({
    kind: 'orbitalSystem',
    orbitRadius: rng.range(0.32, 0.56),
    bodyCount: sym <= 8 ? sym : sym / 2,
    bodyRadius: rng.range(0.022, 0.032),
    bodyStyle: rng.pick(['ring', 'diamond', 'crosshair']),
    showTrack: true,
    showRadialArms: rng.chance(0.55),
    connectBodies: rng.chance(0.5),
    hasEpicycle: true,
    epicycleRadius: rng.range(0.06, 0.095),
    epicycleSpeed: rng.range(1.0, 2.1) * dirA,
    epicycleBodies: rng.pick([2, 3]),
    colorRole: 'secondary',
    opacity: 0.88,
    lineWidth: 1.15,
    rotationSpeed: rng.range(0.22, 0.44),
    direction: dirA,
    initialPhase: rng.range(0, Math.PI * 2),
  });

  // 6. Core aperture sigil
  layers.push({
    kind: 'coreSigil',
    radius: rng.range(0.13, 0.19),
    variant: rng.pick(['aperture', 'nestedHex', 'diamondStar']),
    petals: sym,
    colorRole: 'accent',
    opacity: 0.92,
    lineWidth: 1.25,
    rotationSpeed: rng.range(0.24, 0.45),
    direction: dirB,
    initialPhase: 0,
  });
}

function buildRareLayers(
  rng: SeededRandom,
  sym: number,
  layers: AstrolabeLayer[],
): void {
  const dirA = rng.sign();
  const dirB: 1 | -1 = dirA === 1 ? -1 : 1;

  // 1. High-precision outer astrolabe vernier ring
  layers.push({
    kind: 'concentricRing',
    radius: 0.9,
    arcCount: sym,
    arcFillRatio: 0.84,
    doubleStroke: true,
    doubleGap: 0.022,
    dashed: false,
    dashUnits: 12,
    endCaps: 'ticks',
    colorRole: 'primary',
    opacity: 0.85,
    lineWidth: 1.3,
    rotationSpeed: rng.range(0.06, 0.14),
    direction: dirA,
    initialPhase: 0,
  });

  // 2. High-density 72–120 degree tick dial
  const tickCount = Math.min(120, Math.max(72, sym * 10));
  layers.push({
    kind: 'tickDial',
    radius: 0.83,
    tickCount,
    majorEvery: Math.max(6, Math.round(tickCount / sym)),
    minorLength: 0.02,
    majorLength: 0.058,
    style: rng.pick(['lines', 'chevrons']),
    inward: true,
    colorRole: 'accent',
    opacity: 0.86,
    lineWidth: 1.0,
    rotationSpeed: rng.range(0.09, 0.18),
    direction: dirB,
    initialPhase: rng.range(0, Math.PI * 2),
  });

  // 3. Precision clockwork escapement gear ring
  layers.push({
    kind: 'clockworkGear',
    radius: 0.72,
    teeth: sym * rng.pick([4, 6]),
    toothDepth: 0.036,
    toothProfile: rng.pick(['trapezoid', 'square', 'saw']),
    spokes: sym,
    innerHubRadius: 0.56,
    colorRole: 'secondary',
    opacity: 0.78,
    lineWidth: 1.1,
    rotationSpeed: rng.range(0.14, 0.28),
    direction: dirA,
    initialPhase: rng.range(0, Math.PI * 2),
  });

  // 4. Sweeping vernier caliper arcs with glowing needles
  layers.push({
    kind: 'vernierArcs',
    radius: 0.77,
    arcCount: Math.min(sym, 8),
    spanAngle: (Math.PI / sym) * 1.15,
    radialThickness: 0.03,
    sweepAmp: 0.22,
    sweepFreq: 0.85,
    hasPointers: true,
    colorRole: 'accent',
    opacity: 0.92,
    lineWidth: 1.3,
    rotationSpeed: rng.range(0.18, 0.34),
    direction: dirB,
    initialPhase: rng.range(0, Math.PI * 2),
  });

  // 5. Astrolabe ecliptic rete lattice OR multi-layer chord web
  if (rng.chance(0.55)) {
    layers.push({
      kind: 'astrolabeRete',
      ringCount: Math.min(sym, 8),
      centerOffset: 0.27,
      ringRadius: 0.36,
      drawIntersectionNodes: true,
      colorRole: 'secondary',
      opacity: 0.72,
      lineWidth: 1.05,
      rotationSpeed: rng.range(0.12, 0.22),
      direction: dirA,
      initialPhase: 0,
    });
  } else {
    const pts = Math.min(48, sym * 4);
    layers.push({
      kind: 'chordMatrix',
      radius: 0.66,
      points: pts,
      step: Math.floor(pts * 0.375),
      layers: 2,
      innerRadiusRatio: 0.74,
      colorRole: 'secondary',
      opacity: 0.64,
      lineWidth: 0.95,
      rotationSpeed: rng.range(0.1, 0.2),
      direction: dirA,
      initialPhase: 0,
    });
  }

  // 6. Harmonic spirograph / hypotrochoid / epitrochoid precision resonance curve
  const rareRatios: readonly [number, number][] = [
    [7, 3],
    [8, 3],
    [9, 4],
    [10, 3],
    [12, 5],
  ];
  const [ratioNum, ratioDen] = rng.pick(rareRatios);
  layers.push({
    kind: 'harmonicCurve',
    curveType: rng.pick(['hypotrochoid', 'epitrochoid', 'lissajousRadial']),
    baseRadius: 0.49,
    amplitude: 0.2,
    lobes: sym,
    secondaryHarmonic: sym * 2,
    ratioNum,
    ratioDen,
    penOffset: rng.range(0.62, 0.92),
    breatheAmp: 0.12,
    breatheFreq: 0.9,
    samples: 340,
    colorRole: 'primary',
    opacity: 0.92,
    lineWidth: 1.3,
    rotationSpeed: rng.range(0.16, 0.3),
    direction: dirB,
    initialPhase: rng.range(0, Math.PI * 2),
  });

  // 7. High-precision Schlafli star polygon sigil
  layers.push({
    kind: 'inscribedPolygon',
    radius: 0.58,
    sides: sym,
    starStep: pickStarStep(rng, sym, false),
    nestedCount: 2,
    nestedScale: 0.72,
    nestedTwist: Math.PI / sym,
    vertexNodes: 'diamonds',
    vertexNodeSize: 0.024,
    drawCircumcircle: true,
    colorRole: 'accent',
    opacity: 0.92,
    lineWidth: 1.25,
    rotationSpeed: rng.range(0.22, 0.38),
    direction: dirA,
    initialPhase: 0,
  });

  // 8. Counter-rotating inner gear + epicycle planetary nodes
  layers.push({
    kind: 'orbitalSystem',
    orbitRadius: 0.42,
    bodyCount: sym <= 8 ? sym : Math.floor(sym / 2),
    bodyRadius: 0.025,
    bodyStyle: 'crosshair',
    showTrack: true,
    showRadialArms: true,
    connectBodies: true,
    hasEpicycle: true,
    epicycleRadius: 0.085,
    epicycleSpeed: rng.range(1.4, 2.4) * dirB,
    epicycleBodies: rng.pick([2, 3, 4]),
    colorRole: pickRole(rng, true),
    opacity: 0.94,
    lineWidth: 1.2,
    rotationSpeed: rng.range(0.26, 0.48),
    direction: dirB,
    initialPhase: rng.range(0, Math.PI * 2),
  });

  // 9. Inner fine counter-rotating ring
  layers.push({
    kind: 'concentricRing',
    radius: 0.27,
    arcCount: sym,
    arcFillRatio: 0.62,
    doubleStroke: true,
    doubleGap: 0.016,
    dashed: true,
    dashUnits: 5,
    endCaps: 'dots',
    colorRole: 'primary',
    opacity: 0.9,
    lineWidth: 1.1,
    rotationSpeed: rng.range(0.32, 0.56),
    direction: dirA,
    initialPhase: 0,
  });

  // 10. Intricate central arcane aperture sigil
  layers.push({
    kind: 'coreSigil',
    radius: 0.16,
    variant: rng.pick(['aperture', 'nestedHex', 'diamondStar']),
    petals: sym,
    colorRole: 'accent',
    opacity: 0.96,
    lineWidth: 1.35,
    rotationSpeed: rng.range(0.35, 0.6),
    direction: dirB,
    initialPhase: 0,
  });
}
