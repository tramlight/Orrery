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

function resolveColor(spec: AstrolabeSpec, role: AstrolabeLayer['colorRole']): RGB {
  if (role === 'accent') return spec.palette.accentRgb;
  if (role === 'secondary') return spec.palette.secondaryRgb;
  return spec.palette.primaryRgb;
}

/**
 * Crisp neon vector stroke using layered semi-transparent additive passes.
 * Avoids heavy shadowBlur shaders so 60fps stays rock-solid across mobile GPUs.
 */
function strokeGlowing(
  ctx: CanvasRenderingContext2D,
  drawPath: () => void,
  rgb: RGB,
  width: number,
  alpha: number,
  scaleBoost: number,
  whiteCore = false,
): void {
  const w = Math.max(0.65, width * scaleBoost);

  // Outer aura pass
  ctx.beginPath();
  drawPath();
  ctx.lineWidth = w * 4.4;
  ctx.strokeStyle = rgba(rgb, alpha * 0.085);
  ctx.stroke();

  // Mid halo pass
  ctx.beginPath();
  drawPath();
  ctx.lineWidth = w * 2.1;
  ctx.strokeStyle = rgba(rgb, alpha * 0.24);
  ctx.stroke();

  // Crisp primary vector core
  ctx.beginPath();
  drawPath();
  ctx.lineWidth = w;
  ctx.strokeStyle = rgba(rgb, Math.min(1, alpha * 0.94));
  ctx.stroke();

  // Optional razor white-hot inner filament for Rare accents & active resonance
  if (whiteCore) {
    ctx.beginPath();
    drawPath();
    ctx.lineWidth = Math.max(0.5, w * 0.42);
    ctx.strokeStyle = `rgba(255,255,255,${(alpha * 0.48).toFixed(3)})`;
    ctx.stroke();
  }
}

function drawGlowDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rgb: RGB,
  alpha: number,
): void {
  ctx.beginPath();
  ctx.arc(x, y, r * 2.5, 0, Math.PI * 2);
  ctx.fillStyle = rgba(rgb, alpha * 0.16);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, r * 1.4, 0, Math.PI * 2);
  ctx.fillStyle = rgba(rgb, alpha * 0.42);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = rgba(rgb, Math.min(1, alpha * 0.95));
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,255,255,${(alpha * 0.72).toFixed(3)})`;
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
  const scaleBoost = Math.max(0.75, Math.min(1.5, minDim / 390));

  // Deep void dark-mode background
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = state.isFullscreen ? '#020306' : '#030509';
  ctx.fillRect(0, 0, width, height);

  // Subtle precision framing reticle in outer corners (never organic, strictly digital)
  drawFrameReticles(ctx, width, height, spec, state, scaleBoost);

  // Switch to additive blending for crisp luminous vector overlays
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Subtle ambient boost when resonated or pulsing
  const pulseBoost =
    state.pulseProgress > 0 && state.pulseProgress < 1
      ? Math.sin(state.pulseProgress * Math.PI) * 0.28
      : 0;
  const resonanceAlphaMult = (state.isResonated ? 1.12 : 1.0) + pulseBoost;

  // Ultra-faint central coordinate crosshairs (strictly precision instrument lines)
  ctx.beginPath();
  ctx.moveTo(-R * 0.95, 0);
  ctx.lineTo(R * 0.95, 0);
  ctx.moveTo(0, -R * 0.95);
  ctx.lineTo(0, R * 0.95);
  ctx.lineWidth = 0.75 * scaleBoost;
  ctx.strokeStyle = rgba(spec.palette.secondaryRgb, spec.rarity === 'rare' ? 0.08 : 0.05);
  ctx.stroke();

  const isRare = spec.rarity === 'rare';

  for (let i = 0; i < spec.layers.length; i++) {
    const layer = spec.layers[i];
    const rgb = resolveColor(spec, layer.colorRole);
    const alpha = Math.min(1, layer.opacity * resonanceAlphaMult);
    const angle = layer.initialPhase + state.phaseTime * layer.rotationSpeed * layer.direction;
    const whiteCore =
      (isRare && layer.colorRole === 'accent') ||
      (state.isResonated && layer.colorRole === 'accent');

    ctx.save();
    ctx.rotate(angle);

    switch (layer.kind) {
      case 'concentricRing':
        drawConcentricRing(ctx, layer, R, rgb, alpha, scaleBoost, whiteCore);
        break;
      case 'tickDial':
        drawTickDial(ctx, layer, R, rgb, alpha, scaleBoost, whiteCore);
        break;
      case 'inscribedPolygon':
        drawInscribedPolygon(ctx, layer, R, rgb, alpha, scaleBoost, whiteCore);
        break;
      case 'orbitalSystem':
        drawOrbitalSystem(ctx, layer, R, rgb, alpha, scaleBoost, state.phaseTime, whiteCore);
        break;
      case 'harmonicCurve':
        drawHarmonicCurve(ctx, layer, R, rgb, alpha, scaleBoost, state.wallTime, whiteCore);
        break;
      case 'chordMatrix':
        drawChordMatrix(ctx, layer, R, rgb, alpha, scaleBoost);
        break;
      case 'clockworkGear':
        drawClockworkGear(ctx, layer, R, rgb, alpha, scaleBoost, whiteCore);
        break;
      case 'astrolabeRete':
        drawAstrolabeRete(ctx, layer, R, rgb, alpha, scaleBoost, whiteCore);
        break;
      case 'vernierArcs':
        drawVernierArcs(ctx, layer, R, rgb, alpha, scaleBoost, state.wallTime, whiteCore);
        break;
      case 'coreSigil':
        drawCoreSigil(ctx, layer, R, rgb, alpha, scaleBoost, state.wallTime, whiteCore);
        break;
    }

    ctx.restore();
  }

  // Interactive resonance pulse wave (expanding crisp concentric geometric ring)
  if (state.pulseProgress > 0 && state.pulseProgress < 1) {
    const p = state.pulseProgress;
    const eased = 1 - Math.pow(1 - p, 3);
    const waveR = R * (0.12 + eased * 0.94);
    const waveAlpha = (1 - p) * 0.85;
    strokeGlowing(
      ctx,
      () => {
        ctx.arc(0, 0, waveR, 0, Math.PI * 2);
      },
      spec.palette.accentRgb,
      1.6,
      waveAlpha,
      scaleBoost,
      true,
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
        spec.palette.accentRgb,
        1.4,
        (1 - ring1) * 0.72,
        scaleBoost,
        true,
      );
    }
    if (ring2 > 0 && ring2 < 1) {
      const r2 = R * (0.2 + (1 - Math.pow(1 - ring2, 3)) * 0.8);
      strokeGlowing(
        ctx,
        () => ctx.arc(0, 0, r2, 0, Math.PI * 2),
        spec.palette.primaryRgb,
        1.3,
        (1 - ring2) * 0.82,
        scaleBoost,
        true,
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
  whiteCore: boolean,
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

  strokeGlowing(ctx, () => traceArcs(rad), rgb, layer.lineWidth, alpha, scaleBoost, whiteCore);

  if (layer.doubleStroke) {
    const r2 = rad - layer.doubleGap * R;
    strokeGlowing(ctx, () => traceArcs(r2), rgb, layer.lineWidth * 0.72, alpha * 0.65, scaleBoost);
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
  whiteCore: boolean,
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
    whiteCore,
  );
}

function drawInscribedPolygon(
  ctx: CanvasRenderingContext2D,
  layer: InscribedPolygonLayer,
  R: number,
  rgb: RGB,
  alpha: number,
  scaleBoost: number,
  whiteCore: boolean,
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
      whiteCore && n === 0,
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
            whiteCore,
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
  whiteCore: boolean,
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
        whiteCore,
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
        whiteCore,
      );
    } else {
      strokeGlowing(
        ctx,
        () => ctx.arc(bx, by, bodyR, 0, Math.PI * 2),
        rgb,
        layer.lineWidth,
        alpha,
        scaleBoost,
        whiteCore,
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
  whiteCore: boolean,
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
    whiteCore,
  );
}

function drawChordMatrix(
  ctx: CanvasRenderingContext2D,
  layer: ChordMatrixLayer,
  R: number,
  rgb: RGB,
  alpha: number,
  scaleBoost: number,
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
  whiteCore: boolean,
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
    whiteCore,
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
  );
}

function drawAstrolabeRete(
  ctx: CanvasRenderingContext2D,
  layer: AstrolabeReteLayer,
  R: number,
  rgb: RGB,
  alpha: number,
  scaleBoost: number,
  whiteCore: boolean,
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
    whiteCore,
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
  whiteCore: boolean,
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
    whiteCore,
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
  whiteCore: boolean,
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
    whiteCore,
  );

  drawGlowDot(ctx, 0, 0, Math.max(2.2, rad * 0.14), rgb, alpha);
}
