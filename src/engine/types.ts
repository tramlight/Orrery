export type Rarity = 'common' | 'uncommon' | 'rare';

export type RGB = readonly [number, number, number];

export interface AstrolabePalette {
  id: string;
  primaryRgb: RGB;
  secondaryRgb: RGB;
  accentRgb: RGB;
  primaryHex: string;
  secondaryHex: string;
  accentHex: string;
}

export type LayerColorRole = 'primary' | 'secondary' | 'accent';

export interface BaseLayer {
  colorRole: LayerColorRole;
  opacity: number;
  lineWidth: number;
  rotationSpeed: number; // radians per second
  direction: 1 | -1;
  initialPhase: number;
}

export interface ConcentricRingLayer extends BaseLayer {
  kind: 'concentricRing';
  radius: number; // normalized 0..1 relative to canvas half-size
  arcCount: number; // 1 = full circle, >1 = N symmetrical segments
  arcFillRatio: number; // 0.3..0.95
  doubleStroke: boolean;
  doubleGap: number;
  dashed: boolean;
  dashUnits: number;
  endCaps: 'none' | 'dots' | 'ticks';
}

export interface TickDialLayer extends BaseLayer {
  kind: 'tickDial';
  radius: number;
  tickCount: number;
  majorEvery: number;
  minorLength: number;
  majorLength: number;
  style: 'lines' | 'dots' | 'chevrons' | 'notches';
  inward: boolean;
}

export interface InscribedPolygonLayer extends BaseLayer {
  kind: 'inscribedPolygon';
  radius: number;
  sides: number;
  starStep: number; // 1 for regular polygon, >1 for Schlafli star {n/k}
  nestedCount: number;
  nestedScale: number;
  nestedTwist: number; // angular offset per nested copy
  vertexNodes: 'none' | 'dots' | 'rings' | 'diamonds';
  vertexNodeSize: number;
  drawCircumcircle: boolean;
}

export interface OrbitalSystemLayer extends BaseLayer {
  kind: 'orbitalSystem';
  orbitRadius: number;
  bodyCount: number;
  bodyRadius: number;
  bodyStyle: 'ring' | 'solid' | 'diamond' | 'crosshair';
  showTrack: boolean;
  showRadialArms: boolean;
  connectBodies: boolean;
  hasEpicycle: boolean;
  epicycleRadius: number;
  epicycleSpeed: number;
  epicycleBodies: number;
}

export interface HarmonicCurveLayer extends BaseLayer {
  kind: 'harmonicCurve';
  curveType: 'rose' | 'hypotrochoid' | 'epitrochoid' | 'lissajousRadial';
  baseRadius: number;
  amplitude: number;
  lobes: number; // guarantees strict rotational symmetry
  secondaryHarmonic: number;
  ratioNum: number;
  ratioDen: number;
  penOffset: number;
  breatheAmp: number;
  breatheFreq: number;
  samples: number;
}

export interface ChordMatrixLayer extends BaseLayer {
  kind: 'chordMatrix';
  radius: number;
  points: number;
  step: number;
  layers: number;
  innerRadiusRatio: number;
}

export interface ClockworkGearLayer extends BaseLayer {
  kind: 'clockworkGear';
  radius: number;
  teeth: number;
  toothDepth: number;
  toothProfile: 'trapezoid' | 'saw' | 'square';
  spokes: number;
  innerHubRadius: number;
}

export interface AstrolabeReteLayer extends BaseLayer {
  kind: 'astrolabeRete';
  ringCount: number;
  centerOffset: number;
  ringRadius: number;
  drawIntersectionNodes: boolean;
}

export interface VernierArcsLayer extends BaseLayer {
  kind: 'vernierArcs';
  radius: number;
  arcCount: number;
  spanAngle: number;
  radialThickness: number;
  sweepAmp: number;
  sweepFreq: number;
  hasPointers: boolean;
}

export interface CoreSigilLayer extends BaseLayer {
  kind: 'coreSigil';
  radius: number;
  variant: 'reticle' | 'aperture' | 'diamondStar' | 'nestedHex';
  petals: number;
}

export type AstrolabeLayer =
  | ConcentricRingLayer
  | TickDialLayer
  | InscribedPolygonLayer
  | OrbitalSystemLayer
  | HarmonicCurveLayer
  | ChordMatrixLayer
  | ClockworkGearLayer
  | AstrolabeReteLayer
  | VernierArcsLayer
  | CoreSigilLayer;

export interface AvatarSpec {
  frame: 'circle' | 'hexagon' | 'octagon' | 'diamond';
  symmetry: number;
  innerPolygons: number;
  hasCross: boolean;
  hasCenterDot: boolean;
  ringScale: number;
  rotationDeg: number;
}

export interface GlyphStroke {
  type: 'line' | 'circle' | 'arc' | 'poly';
  d?: string;
  cx?: number;
  cy?: number;
  r?: number;
  filled?: boolean;
}

export interface GlyphSpec {
  strokes: GlyphStroke[];
}

export interface AstrolabeSpec {
  seed: number;
  rarity: Rarity;
  symmetryOrder: number;
  palette: AstrolabePalette;
  layers: AstrolabeLayer[];
  avatar: AvatarSpec;
  handleGlyphs: GlyphSpec[];
  globalPulseSpeed: number;
}
