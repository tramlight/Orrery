import {
  AstrolabeLayer,
  AstrolabeReteLayer,
  AstrolabeSpec,
  ChordMatrixLayer,
  ClockworkGearLayer,
  ConcentricRingLayer,
  CoreSigilLayer,
  HarmonicCurveLayer,
  InscribedPolygonLayer,
  OrbitalSystemLayer,
  RGB,
  TickDialLayer,
  VernierArcsLayer,
} from './types';

export interface RenderState {
  phaseTime: number; // integrated phase time (can reverse smoothly)
  wallTime: number; // monotonic time for breathing/pulse harmonics
  pulseProgress: number; // 0..1 resonance wave (<=0 or >=1 means inactive)
  rareArrivalProgress: number; // 0..1 double-ring sweep when Rare enters view
  isResonated: boolean;
  isFullscreen: boolean;
}

function rgba(rgb: RGB, alpha: number): string {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha.toFixed(3)})`;
}

/**
 * Produces a high-lightness tint of a palette RGB color (blended toward white by `amount` 0..1)
 * so inner highlights glow brightly in-hue instead of blowing out to pure #FFFFFF.
 */
function tintColor(rgb: RGB, amount: number): RGB {
  return [
    Math.min(255, Math.round(rgb[0] + (255 - rgb[0]) * amount)),
    Math.min(255, Math.round(rgb[1] + (255 - rgb[1]) * amount)),
    Math.min(255, Math.round(rgb[2] + (255 - rgb[2]) * amount)),
  ];
}

function getLayerRadius(layer: AstrolabeLayer): number {
  switch (layer.kind) {
    case 'orbitalSystem':
      return layer.orbitRadius;
    case 'harmonicCurve':
      return layer.baseRadius;
    case 'astrolabeRete':
      return layer.centerOffset + layer.ringRadius * 0.5;
    default:
      return layer.radius;
  }
}

function resolveColor(
  spec: AstrolabeSpec,
  role: AstrolabeLayer['colorRole'],
  isDense: boolean,
  layerIndex: number,
): RGB {
  if (role === 'accent') {
    if (isDense) {
      // On dense/Rare stacks, use a bright palette-tinted highlight rather than near-white
      // so overlapping additive strokes preserve vivid hue fidelity
      const base = layerIndex % 2 === 0 ? spec.palette.primaryRgb : spec.palette.secondaryRgb;
      return tintColor(base, 0.34);
    }
    return spec.palette.accentRgb;
  }
  if (role === 'secondary') return spec.palette.secondaryRgb;
  return spec.palette.primaryRgb;
}

/**
 * Crisp neon vector stroke using layered semi-transparent additive passes.
 * Avoids heavy shadowBlur shaders so 60fps stays rock-solid across mobile GPUs.
 * Uses a high-lightness tint of the stroke hue for the inner filament (never pure white).
 */
function strokeGlowing(
  ctx: CanvasRenderingContext2D,
  drawPath: () => void,
  rgb: RGB,
  width: number,
  alpha: number,
  scaleBoost: number,
  highlightCore = false,
  haloFactor = 1,
): void {
  const w = Math.max(0.55, width * scaleBoost);

  // Outer aura pass
  ctx.beginPath();
  drawPath();
  ctx.lineWidth = w * (haloFactor < 1 ? 3.8 : 4.4);
  ctx.strokeStyle = rgba(rgb, alpha * 0.085 * haloFactor);
  ctx.stroke();

  // Mid halo pass
  ctx.beginPath();
  drawPath();
  ctx.lineWidth = w * (haloFactor < 1 ? 1.9 : 2.1);
  ctx.strokeStyle = rgba(rgb, alpha * 0.24 * haloFactor);
  ctx.stroke();

  // Crisp primary vector core
  ctx.beginPath();
  drawPath();
  ctx.lineWidth = w;
  ctx.strokeStyle = rgba(rgb, Math.min(1, alpha * 0.94));
  ctx.stroke();

  // Optional razor high-lightness tinted inner filament (tinted hue, never raw #FFFFFF)
  if (highlightCore) {
    const tinted = tintColor(rgb, haloFactor < 1 ? 0.45 : 0.62);
    ctx.beginPath();
    drawPath();
    ctx.lineWidth = Math.max(0.45, w * 0.4);
    ctx.strokeStyle = rgba(tinted, alpha * (haloFactor < 1 ? 0.34 : 0.46));
    ctx.stroke();
  }
}

/**
 * Luminous accent dot / orbital node—pure white pinpoint is reserved strictly here.
 */
function drawGlowDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rgb: RGB,
  alpha: number,
): void {
  ctx.beginPath();
  ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
  ctx.fillStyle = rgba(rgb, alpha * 0.16);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, r * 1.35, 0, Math.PI * 2);
  ctx.fillStyle = rgba(rgb, alpha * 0.42);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = rgba(rgb, Math.min(1, alpha * 0.95));
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, r * 0.44, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,255,255,${Math.min(0.95, alpha * 0.85).toFixed(3)})`;
  ctx.fill();
}

export function renderAstrolabe(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  spec: AstrolabeSpec,
  state: RenderState,
): void {
  const cx = width * 0.5;
  const cy = height * 0.5;
  const minDim = Math.min(width, height);
  const R = minDim * (state.isFullscreen ? 0.455 : 0.435);
  const baseScaleBoost = Math.max(0.75, Math.min(1.5, minDim / 390));

  // Pure dark-mode void backdrop for crisp additive neon contrast
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = state.isFullscreen ? '#000000' : '#020306';
  ctx.fillRect(0, 0, width, height);

  // Subtle precision framing reticle in outer corners (never organic, strictly digital)
  drawFrameReticles(ctx, width, height, spec, state, baseScaleBoost);

  // Switch to additive blending for crisp luminous vector overlays
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const isRare = spec.rarity === 'rare';
  const isDense = isRare || spec.layers.length >= 8;

  // Subtle ambient boost when resonated or pulsing
  const pulseBoost =
    state.pulseProgress > 0 && state.pulseProgress < 1
      ? Math.sin(state.pulseProgress * Math.PI) * (isDense ? 0.18 : 0.28)
      : 0;
  const resonanceAlphaMult = (state.isResonated ? (isDense ? 1.08 : 1.12) : 1.0) + pulseBoost;

  // Ultra-faint central coordinate crosshairs (strictly precision instrument lines)
  ctx.beginPath();
  ctx.moveTo(-R * 0.95, 0);
  ctx.lineTo(R * 0.95, 0);
  ctx.moveTo(0, -R * 0.95);
  ctx.lineTo(0, R * 0.95);
  ctx.lineWidth = 0.75 * baseScaleBoost;
  ctx.strokeStyle = rgba(spec.palette.secondaryRgb, isDense ? 0.055 : 0.05);
  ctx.stroke();

  // Density scaling: keep Common & Uncommon at 100% brightness/width,
  // while scaling down alpha (~55-64%) and slightly thinning inner strokes on Rare/dense stacks
  // so overlapping additive layers stay richly colored instead of clipping to #FFFFFF.
  const haloFactor = isDense ? 0.66 : 1;

  for (let i = 0; i < spec.layers.length; i++) {
    const layer = spec.layers[i];
    const normR = getLayerRadius(layer);
    const isInnerLayer = normR <= 0.64;

    const densityAlphaScale = isDense
      ? layer.kind === 'astrolabeRete' || layer.kind === 'chordMatrix'
        ? 0.52
        : isInnerLayer
        ? 0.57
        : 0.64
      : 1;

    const densityWidthScale = isDense ? (isInnerLayer ? 0.8 : 0.9) : 1;
    const layerScaleBoost = baseScaleBoost * densityWidthScale;

    const rgb = resolveColor(spec, layer.colorRole, isDense, i);
    const alpha = Math.min(1, layer.opacity * resonanceAlphaMult * densityAlphaScale);
    const angle = layer.initialPhase + state.phaseTime * layer.rotationSpeed * layer.direction;
    const highlightCore = isDense
      ? layer.kind === 'coreSigil' || (state.isResonated && layer.colorRole === 'primary')
      : layer.colorRole === 'accent' || (state.isResonated && layer.colorRole === 'primary');

    ctx.save();
    ctx.rotate(angle);

    switch (layer.kind) {
      case 'concentricRing':
        drawConcentricRing(ctx, layer, R, rgb, alpha, layerScaleBoost, highlightCore, haloFactor);
        break;
      case 'tickDial':
        drawTickDial(ctx, layer, R, rgb, alpha, layerScaleBoost, highlightCore, haloFactor);
        break;
      case 'inscribedPolygon':
        drawInscribedPolygon(ctx, layer, R, rgb, alpha, layerScaleBoost, highlightCore, haloFactor);
        break;
      case 'orbitalSystem':
        drawOrbitalSystem(
          ctx,
          layer,
          R,
          rgb,
          alpha,
          layerScaleBoost,
          state.phaseTime,
          highlightCore,
          haloFactor,
        );
        break;
      case 'harmonicCurve':
        drawHarmonicCurve(
          ctx,
          layer,
          R,
          rgb,
          alpha,
          layerScaleBoost,
          state.wallTime,
          highlightCore,
          haloFactor,
        );
        break;
      case 'chordMatrix':
        drawChordMatrix(ctx, layer, R, rgb, alpha, layerScaleBoost, haloFactor);
        break;
      case 'clockworkGear':
        drawClockworkGear(ctx, layer, R, rgb, alpha, layerScaleBoost, highlightCore, haloFactor);
        break;
      case 'astrolabeRete':
        drawAstrolabeRete(ctx, layer, R, rgb, alpha, layerScaleBoost, highlightCore, haloFactor);
        break;
      case 'vernierArcs':
        drawVernierArcs(
          ctx,
          layer,
          R,
          rgb,
          alpha,
          layerScaleBoost,
          state.wallTime,
          highlightCore,
          haloFactor,
        );
        break;
      case 'coreSigil':
        drawCoreSigil(
          ctx,
          layer,
          R,
          rgb,
          alpha,
          layerScaleBoost,
          state.wallTime,
          highlightCore,
          haloFactor,
        );
        break;
    }

    ctx.restore();
  }

  // Interactive resonance pulse wave (expanding crisp concentric geometric ring)
  if (state.pulseProgress > 0 && state.pulseProgress < 1) {
    const p = state.pulseProgress;
    const eased = 1 - Math.pow(1 - p, 3);
    const waveR = R * (0.12 + eased * 0.94);
    const waveAlpha = (1 - p) * (isDense ? 0.65 : 0.85);
    strokeGlowing(
      ctx,
      () => {
        ctx.arc(0, 0, waveR, 0, Math.PI * 2);
      },
      tintColor(spec.palette.primaryRgb, 0.35),
      1.5,
      waveAlpha,
      baseScaleBoost,
      true,
      haloFactor,
    );
  }

  // Rare arrival double-tap visual harmonic pulse
  if (state.rareArrivalProgress > 0 && state.rareArrivalProgress < 1) {
    const p = state.rareArrivalProgress;
    const ring1 = Math.min(1, p * 1.45);
    const ring2 = Math.max(0, Math.min(1, (p - 0.24) * 1.32));

    if (ring1 > 0 && ring1 < 1) {
      const r1 = R * (0.28 + (1 - Math.pow(1 - ring1, 3)) * 0.74);
      strokeGlowing(
        ctx,
        () => ctx.arc(0, 0, r1, 0, Math.PI * 2),
        tintColor(spec.palette.secondaryRgb, 0.3),
        1.35,
        (1 - ring1) * 0.62,
        baseScaleBoost,
        true,
        haloFactor,
      );
    }
    if (ring2 > 0 && ring2 < 1) {
      const r2 = R * (0.2 + (1 - Math.pow(1 - ring2, 3)) * 0.8);
      strokeGlowing(
        ctx,
        () => ctx.arc(0, 0, r2, 0, Math.PI * 2),
        spec.palette.primaryRgb,
        1.25,
        (1 - ring2) * 0.7,
        baseScaleBoost,
        true,
        haloFactor,
      );
    }
  }

  ctx.restore();
}

function drawFrameReticles(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  spec: AstrolabeSpec,
  state: RenderState,
  scaleBoost: number,
): void {
  const pad = state.isFullscreen ? 20 : 12;
  const len = state.isFullscreen ? 14 : 9;
  const isRare = spec.rarity === 'rare';
  const color = isRare ? spec.palette.primaryRgb : spec.palette.secondaryRgb;
  const baseAlpha = isRare ? 0.34 : 0.16;

  ctx.save();
  ctx.strokeStyle = rgba(color, baseAlpha);
  ctx.lineWidth = 1 * scaleBoost;
  ctx.beginPath();

  // Top-left
  ctx.moveTo(pad, pad + len);
  ctx.lineTo(pad, pad);
  ctx.lineTo(pad + len, pad);

  // Top-right
  ctx.moveTo(width - pad - len, pad);
  ctx.lineTo(width - pad, pad);
  ctx.lineTo(width - pad, pad + len);

  // Bottom-left
  ctx.moveTo(pad, height - pad - len);
  ctx.lineTo(pad, height - pad);
  ctx.lineTo(pad + len, height - pad);

  // Bottom-right
  ctx.moveTo(width - pad - len, height - pad);
  ctx.lineTo(width - pad, height - pad);
  ctx.lineTo(width - pad, height - pad - len);

  ctx.stroke();

  // Rare corner micro-diamonds
  if (isRare) {
    ctx.fillStyle = rgba(spec.palette.accentRgb, 0.55);
    const d = 2.2 * scaleBoost;
    const corners = [
      [pad + 4, pad + 4],
      [width - pad - 4, pad + 4],
      [pad + 4, height - pad - 4],
      [width - pad - 4, height - pad - 4],
    ];
    for (const [x, y] of corners) {
      ctx.beginPath();
      ctx.moveTo(x, y - d);
      ctx.lineTo(x + d, y);
      ctx.lineTo(x, y + d);
      ctx.lineTo(x - d, y);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawConcentricRing(
  ctx: CanvasRenderingContext2D,
  layer: ConcentricRingLayer,
  R: number,
  rgb: RGB,
  alpha: number,
  scaleBoost: number,
  highlightCore: boolean,
  haloFactor: number,
): void {
  const rad = layer.radius * R;

  if (layer.dashed) {
    const dashLen = Math.max(3, layer.dashUnits * scaleBoost);
    ctx.setLineDash([dashLen, dashLen * 0.85]);
  }

  const traceArcs = (r: number) => {
    if (layer.arcCount <= 1) {
      ctx.arc(0, 0, r, 0, Math.PI * 2);
    } else {
      const step = (Math.PI * 2) / layer.arcCount;
      const span = step * layer.arcFillRatio;
      for (let i = 0; i < layer.arcCount; i++) {
        const start = i * step;
        ctx.moveTo(Math.cos(start) * r, Math.sin(start) * r);
        ctx.arc(0, 0, r, start, start + span);
      }
    }
  };

  strokeGlowing(
    ctx,
    () => traceArcs(rad),
    rgb,
    layer.lineWidth,
    alpha,
    scaleBoost,
    highlightCore,
    haloFactor,
  );

  if (layer.doubleStroke) {
    const r2 = rad - layer.doubleGap * R;
    strokeGlowing(
      ctx,
      () => traceArcs(r2),
      rgb,
      layer.lineWidth * 0.72,
      alpha * 0.65,
      scaleBoost,
      false,
      haloFactor,
    );
  }

  ctx.setLineDash([]);

  // Symmetrical arc end-caps
  if (layer.arcCount > 1 && layer.endCaps !== 'none') {
    const step = (Math.PI * 2) / layer.arcCount;
    const span = step * layer.arcFillRatio;
    for (let i = 0; i < layer.arcCount; i++) {
      const a1 = i * step;
      const a2 = a1 + span;
      if (layer.endCaps === 'dots') {
        drawGlowDot(ctx, Math.cos(a1) * rad, Math.sin(a1) * rad, 1.9 * scaleBoost, rgb, alpha);
        drawGlowDot(ctx, Math.cos(a2) * rad, Math.sin(a2) * rad, 1.9 * scaleBoost, rgb, alpha);
      } else {
        const tickR = 0.022 * R;
        strokeGlowing(
          ctx,
          () => {
            ctx.moveTo(Math.cos(a1) * (rad - tickR), Math.sin(a1) * (rad - tickR));
            ctx.lineTo(Math.cos(a1) * (rad + tickR), Math.sin(a1) * (rad + tickR));
            ctx.moveTo(Math.cos(a2) * (rad - tickR), Math.sin(a2) * (rad - tickR));
            ctx.lineTo(Math.cos(a2) * (rad + tickR), Math.sin(a2) * (rad + tickR));
          },
          rgb,
          layer.lineWidth * 0.9,
          alpha,
          scaleBoost,
          false,
          haloFactor,
        );
      }
    }
  }
}

function drawTickDial(
  ctx: CanvasRenderingContext2D,
  layer: TickDialLayer,
  R: number,
  rgb: RGB,
  alpha: number,
  scaleBoost: number,
  highlightCore: boolean,
  haloFactor: number,
): void {
  const rad = layer.radius * R;
  const dir = layer.inward ? -1 : 1;
  const step = (Math.PI * 2) / layer.tickCount;

  // Minor ticks in one batched path
  strokeGlowing(
    ctx,
    () => {
      for (let i = 0; i < layer.tickCount; i++) {
        if (i % layer.majorEvery === 0) continue;
        const a = i * step;
        const c = Math.cos(a);
        const s = Math.sin(a);
        if (layer.style === 'dots') {
          ctx.moveTo(c * rad + 1.2 * scaleBoost, s * rad);
          ctx.arc(c * rad, s * rad, 1.2 * scaleBoost, 0, Math.PI * 2);
        } else {
          const len = layer.minorLength * R * dir;
          ctx.moveTo(c * rad, s * rad);
          ctx.lineTo(c * (rad + len), s * (rad + len));
        }
      }
    },
    rgb,
    layer.lineWidth * 0.78,
    alpha * 0.58,
    scaleBoost,
    false,
    haloFactor,
  );

  // Major ticks with higher luminous intensity
  strokeGlowing(
    ctx,
    () => {
      for (let i = 0; i < layer.tickCount; i += layer.majorEvery) {
        const a = i * step;
        const c = Math.cos(a);
        const s = Math.sin(a);
        const len = layer.majorLength * R * dir;

        if (layer.style === 'chevrons') {
          const tipR = rad + len;
          const wingA = step * 0.35;
          ctx.moveTo(Math.cos(a - wingA) * rad, Math.sin(a - wingA) * rad);
          ctx.lineTo(c * tipR, s * tipR);
          ctx.lineTo(Math.cos(a + wingA) * rad, Math.sin(a + wingA) * rad);
        } else if (layer.style === 'notches') {
          const wingA = step * 0.22;
          ctx.moveTo(Math.cos(a - wingA) * rad, Math.sin(a - wingA) * rad);
          ctx.lineTo(Math.cos(a - wingA) * (rad + len), Math.sin(a - wingA) * (rad + len));
          ctx.lineTo(Math.cos(a + wingA) * (rad + len), Math.sin(a + wingA) * (rad + len));
          ctx.lineTo(Math.cos(a + wingA) * rad, Math.sin(a + wingA) * rad);
        } else {
          ctx.moveTo(c * rad, s * rad);
          ctx.lineTo(c * (rad + len), s * (rad + len));
        }
      }
    },
    rgb,
    layer.lineWidth * 1.15,
    alpha * 0.95,
    scaleBoost,
    highlightCore,
    haloFactor,
  );
}

function drawInscribedPolygon(
  ctx: CanvasRenderingContext2D,
  layer: InscribedPolygonLayer,
  R: number,
  rgb: RGB,
  alpha: number,
  scaleBoost: number,
  highlightCore: boolean,
  haloFactor: number,
): void {
  const baseRad = layer.radius * R;

  if (layer.drawCircumcircle) {
    strokeGlowing(
      ctx,
      () => ctx.arc(0, 0, baseRad, 0, Math.PI * 2),
      rgb,
      layer.lineWidth * 0.65,
      alpha * 0.45,
      scaleBoost,
      false,
      haloFactor,
    );
  }

  for (let n = 0; n < layer.nestedCount; n++) {
    const r = baseRad * Math.pow(layer.nestedScale, n);
    const rot = n * layer.nestedTwist;
    const layerAlpha = alpha * Math.pow(0.84, n);

    strokeGlowing(
      ctx,
      () => {
        const stepAngle = (Math.PI * 2) / layer.sides;
        if (layer.starStep <= 1) {
          for (let i = 0; i <= layer.sides; i++) {
            const a = rot + i * stepAngle;
            const x = Math.cos(a) * r;
            const y = Math.sin(a) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
        } else {
          // Star polygon {n/k}: trace every vertex connection cleanly
          for (let i = 0; i < layer.sides; i++) {
            const a1 = rot + i * stepAngle;
            const a2 = rot + ((i + layer.starStep) % layer.sides) * stepAngle;
            ctx.moveTo(Math.cos(a1) * r, Math.sin(a1) * r);
            ctx.lineTo(Math.cos(a2) * r, Math.sin(a2) * r);
          }
        }
      },
      rgb,
      layer.lineWidth * (n === 0 ? 1 : 0.82),
      layerAlpha,
      scaleBoost,
      highlightCore && n === 0,
      haloFactor,
    );

    if (n === 0 && layer.vertexNodes !== 'none') {
      const nodeR = layer.vertexNodeSize * R;
      const stepAngle = (Math.PI * 2) / layer.sides;
      for (let i = 0; i < layer.sides; i++) {
        const a = rot + i * stepAngle;
        const vx = Math.cos(a) * r;
        const vy = Math.sin(a) * r;

        if (layer.vertexNodes === 'dots') {
          drawGlowDot(ctx, vx, vy, nodeR * 0.38, rgb, alpha);
        } else if (layer.vertexNodes === 'rings') {
          strokeGlowing(
            ctx,
            () => ctx.arc(vx, vy, nodeR * 0.62, 0, Math.PI * 2),
            rgb,
            layer.lineWidth * 0.85,
            alpha,
            scaleBoost,
            false,
            haloFactor,
          );
          drawGlowDot(ctx, vx, vy, nodeR * 0.2, rgb, alpha);
        } else {
          // Diamond vertex sigil
          const d = nodeR * 0.72;
          strokeGlowing(
            ctx,
            () => {
              ctx.moveTo(vx, vy - d);
              ctx.lineTo(vx + d, vy);
              ctx.lineTo(vx, vy + d);
              ctx.lineTo(vx - d, vy);
              ctx.closePath();
            },
            rgb,
            layer.lineWidth * 0.85,
            alpha,
            scaleBoost,
            highlightCore,
            haloFactor,
          );
        }
      }
    }
  }
}

function drawOrbitalSystem(
  ctx: CanvasRenderingContext2D,
  layer: OrbitalSystemLayer,
  R: number,
  rgb: RGB,
  alpha: number,
  scaleBoost: number,
  phaseTime: number,
  highlightCore: boolean,
  haloFactor: number,
): void {
  const orbitR = layer.orbitRadius * R;
  const bodyR = layer.bodyRadius * R;
  const step = (Math.PI * 2) / layer.bodyCount;

  if (layer.showTrack) {
    strokeGlowing(
      ctx,
      () => ctx.arc(0, 0, orbitR, 0, Math.PI * 2),
      rgb,
      layer.lineWidth * 0.65,
      alpha * 0.36,
      scaleBoost,
      false,
      haloFactor,
    );
  }

  if (layer.showRadialArms) {
    strokeGlowing(
      ctx,
      () => {
        for (let i = 0; i < layer.bodyCount; i++) {
          const a = i * step;
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * orbitR, Math.sin(a) * orbitR);
        }
      },
      rgb,
      layer.lineWidth * 0.6,
      alpha * 0.32,
      scaleBoost,
      false,
      haloFactor,
    );
  }

  if (layer.connectBodies && layer.bodyCount >= 3) {
    strokeGlowing(
      ctx,
      () => {
        for (let i = 0; i <= layer.bodyCount; i++) {
          const a = i * step;
          const x = Math.cos(a) * orbitR;
          const y = Math.sin(a) * orbitR;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
      },
      rgb,
      layer.lineWidth * 0.72,
      alpha * 0.42,
      scaleBoost,
      false,
      haloFactor,
    );
  }

  for (let i = 0; i < layer.bodyCount; i++) {
    const a = i * step;
    const bx = Math.cos(a) * orbitR;
    const by = Math.sin(a) * orbitR;

    if (layer.bodyStyle === 'solid') {
      drawGlowDot(ctx, bx, by, bodyR * 0.55, rgb, alpha);
    } else if (layer.bodyStyle === 'diamond') {
      strokeGlowing(
        ctx,
        () => {
          ctx.moveTo(bx, by - bodyR);
          ctx.lineTo(bx + bodyR, by);
          ctx.lineTo(bx, by + bodyR);
          ctx.lineTo(bx - bodyR, by);
          ctx.closePath();
        },
        rgb,
        layer.lineWidth,
        alpha,
        scaleBoost,
        highlightCore,
        haloFactor,
      );
      drawGlowDot(ctx, bx, by, bodyR * 0.25, rgb, alpha);
    } else if (layer.bodyStyle === 'crosshair') {
      strokeGlowing(
        ctx,
        () => {
          ctx.arc(bx, by, bodyR * 0.78, 0, Math.PI * 2);
          ctx.moveTo(bx - bodyR * 1.25, by);
          ctx.lineTo(bx + bodyR * 1.25, by);
          ctx.moveTo(bx, by - bodyR * 1.25);
          ctx.lineTo(bx, by + bodyR * 1.25);
        },
        rgb,
        layer.lineWidth * 0.85,
        alpha,
        scaleBoost,
        highlightCore,
        haloFactor,
      );
    } else {
      strokeGlowing(
        ctx,
        () => ctx.arc(bx, by, bodyR, 0, Math.PI * 2),
        rgb,
        layer.lineWidth,
        alpha,
        scaleBoost,
        highlightCore,
        haloFactor,
      );
      drawGlowDot(ctx, bx, by, bodyR * 0.3, rgb, alpha);
    }

    // Secondary precision epicycles orbiting each main body
    if (layer.hasEpicycle && layer.epicycleRadius > 0) {
      const epiR = layer.epicycleRadius * R;
      strokeGlowing(
        ctx,
        () => ctx.arc(bx, by, epiR, 0, Math.PI * 2),
        rgb,
        layer.lineWidth * 0.6,
        alpha * 0.44,
        scaleBoost,
        false,
        haloFactor,
      );

      const epiStep = (Math.PI * 2) / Math.max(1, layer.epicycleBodies);
      const epiAngleBase = phaseTime * layer.epicycleSpeed;
      for (let j = 0; j < layer.epicycleBodies; j++) {
        const ea = epiAngleBase + j * epiStep;
        const sx = bx + Math.cos(ea) * epiR;
        const sy = by + Math.sin(ea) * epiR;
        drawGlowDot(ctx, sx, sy, Math.max(1.8, bodyR * 0.34), rgb, alpha * 0.95);
      }
    }
  }
}

function drawHarmonicCurve(
  ctx: CanvasRenderingContext2D,
  layer: HarmonicCurveLayer,
  R: number,
  rgb: RGB,
  alpha: number,
  scaleBoost: number,
  wallTime: number,
  highlightCore: boolean,
  haloFactor: number,
): void {
  const breathe = 1 + Math.sin(wallTime * layer.breatheFreq) * layer.breatheAmp;
  const samples = layer.samples;

  strokeGlowing(
    ctx,
    () => {
      if (layer.curveType === 'rose') {
        const base = layer.baseRadius * R;
        const amp = layer.amplitude * R * breathe;
        for (let i = 0; i <= samples; i++) {
          const theta = (i / samples) * Math.PI * 2;
          const r = base + amp * Math.cos(layer.lobes * theta);
          const x = Math.cos(theta) * r;
          const y = Math.sin(theta) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
      } else if (layer.curveType === 'lissajousRadial') {
        const base = layer.baseRadius * R;
        const a1 = layer.amplitude * 0.65 * R * breathe;
        const a2 = layer.amplitude * 0.35 * R;
        const phaseShift = Math.sin(wallTime * layer.breatheFreq * 0.7) * 0.85;
        for (let i = 0; i <= samples; i++) {
          const theta = (i / samples) * Math.PI * 2;
          const r =
            base +
            a1 * Math.cos(layer.lobes * theta) +
            a2 * Math.cos(layer.secondaryHarmonic * theta + phaseShift);
          const x = Math.cos(theta) * r;
          const y = Math.sin(theta) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
      } else if (layer.curveType === 'hypotrochoid') {
        // Closed rational hypotrochoid with strict rotational symmetry
        const kNum = layer.ratioNum;
        const kDen = layer.ratioDen;
        const bigR = layer.baseRadius * R * 1.15;
        const smallR = (bigR * kDen) / kNum;
        const d = smallR * layer.penOffset * breathe;
        const maxT = Math.PI * 2 * kDen;
        const maxExtent = Math.abs(bigR - smallR) + Math.abs(d);
        const normScale = maxExtent > 0 ? (layer.baseRadius + layer.amplitude) * R / maxExtent : 1;

        for (let i = 0; i <= samples; i++) {
          const t = (i / samples) * maxT;
          const ratio = (bigR - smallR) / smallR;
          const x = ((bigR - smallR) * Math.cos(t) + d * Math.cos(ratio * t)) * normScale;
          const y = ((bigR - smallR) * Math.sin(t) - d * Math.sin(ratio * t)) * normScale;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
      } else {
        // Epitrochoid (cusped floral clockwork gear curve)
        const kNum = layer.ratioNum;
        const kDen = layer.ratioDen;
        const bigR = layer.baseRadius * R * 0.72;
        const smallR = (bigR * kDen) / kNum;
        const d = smallR * layer.penOffset * breathe;
        const maxT = Math.PI * 2 * kDen;
        const maxExtent = bigR + smallR + Math.abs(d);
        const normScale = maxExtent > 0 ? (layer.baseRadius + layer.amplitude) * R / maxExtent : 1;

        for (let i = 0; i <= samples; i++) {
          const t = (i / samples) * maxT;
          const ratio = (bigR + smallR) / smallR;
          const x = ((bigR + smallR) * Math.cos(t) - d * Math.cos(ratio * t)) * normScale;
          const y = ((bigR + smallR) * Math.sin(t) - d * Math.sin(ratio * t)) * normScale;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
      }
    },
    rgb,
    layer.lineWidth,
    alpha,
    scaleBoost,
    highlightCore,
    haloFactor,
  );
}

function drawChordMatrix(
  ctx: CanvasRenderingContext2D,
  layer: ChordMatrixLayer,
  R: number,
  rgb: RGB,
  alpha: number,
  scaleBoost: number,
  haloFactor: number,
): void {
  const stepAngle = (Math.PI * 2) / layer.points;
  for (let l = 0; l < layer.layers; l++) {
    const rad = layer.radius * R * Math.pow(layer.innerRadiusRatio, l);
    strokeGlowing(
      ctx,
      () => {
        for (let i = 0; i < layer.points; i++) {
          const a1 = i * stepAngle;
          const a2 = ((i + layer.step) % layer.points) * stepAngle;
          ctx.moveTo(Math.cos(a1) * rad, Math.sin(a1) * rad);
          ctx.lineTo(Math.cos(a2) * rad, Math.sin(a2) * rad);
        }
      },
      rgb,
      layer.lineWidth * (l === 0 ? 1 : 0.8),
      alpha * (l === 0 ? 1 : 0.7),
      scaleBoost,
      false,
      haloFactor,
    );
  }
}

function drawClockworkGear(
  ctx: CanvasRenderingContext2D,
  layer: ClockworkGearLayer,
  R: number,
  rgb: RGB,
  alpha: number,
  scaleBoost: number,
  highlightCore: boolean,
  haloFactor: number,
): void {
  const baseR = layer.radius * R;
  const outerR = baseR + layer.toothDepth * R;
  const hubR = layer.innerHubRadius * R;
  const toothStep = (Math.PI * 2) / layer.teeth;

  // Precision toothed rim
  strokeGlowing(
    ctx,
    () => {
      for (let i = 0; i < layer.teeth; i++) {
        const a0 = i * toothStep;
        const a1 = a0 + toothStep * 0.22;
        const a2 = a0 + toothStep * 0.5;
        const a3 = a0 + toothStep * 0.72;

        const p0x = Math.cos(a0) * baseR;
        const p0y = Math.sin(a0) * baseR;
        if (i === 0) ctx.moveTo(p0x, p0y);
        else ctx.lineTo(p0x, p0y);

        if (layer.toothProfile === 'saw') {
          ctx.lineTo(Math.cos(a2) * outerR, Math.sin(a2) * outerR);
          ctx.lineTo(Math.cos(a3) * baseR, Math.sin(a3) * baseR);
        } else if (layer.toothProfile === 'square') {
          ctx.lineTo(Math.cos(a0) * outerR, Math.sin(a0) * outerR);
          ctx.lineTo(Math.cos(a2) * outerR, Math.sin(a2) * outerR);
          ctx.lineTo(Math.cos(a2) * baseR, Math.sin(a2) * baseR);
        } else {
          // Crisp trapezoidal clockwork tooth
          ctx.lineTo(Math.cos(a1) * outerR, Math.sin(a1) * outerR);
          ctx.lineTo(Math.cos(a2) * outerR, Math.sin(a2) * outerR);
          ctx.lineTo(Math.cos(a3) * baseR, Math.sin(a3) * baseR);
        }
      }
      ctx.closePath();
    },
    rgb,
    layer.lineWidth,
    alpha,
    scaleBoost,
    highlightCore,
    haloFactor,
  );

  // Inner structural rim + symmetrical spokes
  strokeGlowing(
    ctx,
    () => {
      ctx.arc(0, 0, hubR, 0, Math.PI * 2);
      const spokeStep = (Math.PI * 2) / layer.spokes;
      for (let i = 0; i < layer.spokes; i++) {
        const a = i * spokeStep;
        ctx.moveTo(Math.cos(a) * hubR, Math.sin(a) * hubR);
        ctx.lineTo(Math.cos(a) * baseR, Math.sin(a) * baseR);
      }
    },
    rgb,
    layer.lineWidth * 0.75,
    alpha * 0.56,
    scaleBoost,
    false,
    haloFactor,
  );
}

function drawAstrolabeRete(
  ctx: CanvasRenderingContext2D,
  layer: AstrolabeReteLayer,
  R: number,
  rgb: RGB,
  alpha: number,
  scaleBoost: number,
  highlightCore: boolean,
  haloFactor: number,
): void {
  const offset = layer.centerOffset * R;
  const ringR = layer.ringRadius * R;
  const step = (Math.PI * 2) / layer.ringCount;

  strokeGlowing(
    ctx,
    () => {
      for (let i = 0; i < layer.ringCount; i++) {
        const a = i * step;
        const rx = Math.cos(a) * offset;
        const ry = Math.sin(a) * offset;
        ctx.moveTo(rx + ringR, ry);
        ctx.arc(rx, ry, ringR, 0, Math.PI * 2);
      }
    },
    rgb,
    layer.lineWidth,
    alpha,
    scaleBoost,
    highlightCore,
    haloFactor,
  );

  if (layer.drawIntersectionNodes) {
    const outerApex = offset + ringR;
    for (let i = 0; i < layer.ringCount; i++) {
      const a = i * step;
      drawGlowDot(
        ctx,
        Math.cos(a) * outerApex,
        Math.sin(a) * outerApex,
        1.9 * scaleBoost,
        rgb,
        alpha * 0.9,
      );
    }
  }
}

function drawVernierArcs(
  ctx: CanvasRenderingContext2D,
  layer: VernierArcsLayer,
  R: number,
  rgb: RGB,
  alpha: number,
  scaleBoost: number,
  wallTime: number,
  highlightCore: boolean,
  haloFactor: number,
): void {
  const rad = layer.radius * R;
  const thick = layer.radialThickness * R;
  const step = (Math.PI * 2) / layer.arcCount;
  const sweep = Math.sin(wallTime * layer.sweepFreq) * layer.sweepAmp;

  strokeGlowing(
    ctx,
    () => {
      for (let i = 0; i < layer.arcCount; i++) {
        const centerA = i * step + sweep;
        const startA = centerA - layer.spanAngle * 0.5;
        const endA = centerA + layer.spanAngle * 0.5;

        // Outer bracket arc
        ctx.moveTo(Math.cos(startA) * (rad + thick * 0.5), Math.sin(startA) * (rad + thick * 0.5));
        ctx.arc(0, 0, rad + thick * 0.5, startA, endA);

        // Inner bracket arc
        ctx.moveTo(Math.cos(startA) * (rad - thick * 0.5), Math.sin(startA) * (rad - thick * 0.5));
        ctx.arc(0, 0, rad - thick * 0.5, startA, endA);

        // End closures
        ctx.moveTo(Math.cos(startA) * (rad - thick * 0.5), Math.sin(startA) * (rad - thick * 0.5));
        ctx.lineTo(Math.cos(startA) * (rad + thick * 0.5), Math.sin(startA) * (rad + thick * 0.5));

        ctx.moveTo(Math.cos(endA) * (rad - thick * 0.5), Math.sin(endA) * (rad - thick * 0.5));
        ctx.lineTo(Math.cos(endA) * (rad + thick * 0.5), Math.sin(endA) * (rad + thick * 0.5));

        if (layer.hasPointers) {
          ctx.moveTo(Math.cos(centerA) * (rad - thick * 1.4), Math.sin(centerA) * (rad - thick * 1.4));
          ctx.lineTo(Math.cos(centerA) * (rad + thick * 1.15), Math.sin(centerA) * (rad + thick * 1.15));
        }
      }
    },
    rgb,
    layer.lineWidth,
    alpha,
    scaleBoost,
    highlightCore,
    haloFactor,
  );
}

function drawCoreSigil(
  ctx: CanvasRenderingContext2D,
  layer: CoreSigilLayer,
  R: number,
  rgb: RGB,
  alpha: number,
  scaleBoost: number,
  wallTime: number,
  highlightCore: boolean,
  haloFactor: number,
): void {
  const rad = layer.radius * R;
  const pulse = 1 + Math.sin(wallTime * 1.6) * 0.06;

  strokeGlowing(
    ctx,
    () => {
      if (layer.variant === 'reticle') {
        ctx.arc(0, 0, rad, 0, Math.PI * 2);
        ctx.moveTo(rad * 0.45, 0);
        ctx.arc(0, 0, rad * 0.45, 0, Math.PI * 2);
        for (let i = 0; i < 4; i++) {
          const a = (i * Math.PI) / 2;
          ctx.moveTo(Math.cos(a) * rad * 0.55, Math.sin(a) * rad * 0.55);
          ctx.lineTo(Math.cos(a) * rad * 1.35, Math.sin(a) * rad * 1.35);
        }
      } else if (layer.variant === 'aperture') {
        const n = Math.max(4, Math.min(layer.petals, 8));
        const step = (Math.PI * 2) / n;
        ctx.arc(0, 0, rad, 0, Math.PI * 2);
        for (let i = 0; i < n; i++) {
          const a1 = i * step;
          const a2 = a1 + step * 1.4;
          const inner = rad * 0.36 * pulse;
          ctx.moveTo(Math.cos(a1) * rad, Math.sin(a1) * rad);
          ctx.lineTo(Math.cos(a2) * inner, Math.sin(a2) * inner);
        }
      } else if (layer.variant === 'diamondStar') {
        const pts = Math.max(4, Math.min(layer.petals, 8));
        const step = (Math.PI * 2) / (pts * 2);
        for (let i = 0; i <= pts * 2; i++) {
          const a = i * step;
          const rr = i % 2 === 0 ? rad * pulse : rad * 0.42;
          const x = Math.cos(a) * rr;
          const y = Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
      } else {
        // nestedHex / polygon iris
        const n = Math.max(4, Math.min(layer.petals, 6));
        const step = (Math.PI * 2) / n;
        for (let k = 0; k < 2; k++) {
          const rr = rad * (k === 0 ? 1 : 0.58 * pulse);
          const rot = k * (Math.PI / n);
          for (let i = 0; i <= n; i++) {
            const a = rot + i * step;
            const x = Math.cos(a) * rr;
            const y = Math.sin(a) * rr;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
        }
      }
    },
    rgb,
    layer.lineWidth,
    alpha,
    scaleBoost,
    highlightCore,
    haloFactor,
  );

  drawGlowDot(ctx, 0, 0, Math.max(2.2, rad * 0.14), rgb, Math.min(1, alpha * 1.15));
}
