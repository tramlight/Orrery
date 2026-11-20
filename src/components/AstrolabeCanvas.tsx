import React, { useEffect, useId, useRef } from 'react';
import { renderAstrolabe } from '../engine/renderer';
import { animationScheduler } from '../engine/scheduler';
import { AstrolabeSpec } from '../engine/types';

interface AstrolabeCanvasProps {
  spec: AstrolabeSpec;
  isVisible: boolean;
  isInverted: boolean;
  isResonated: boolean;
  pulseToken: number;
  rareArrivalToken: number;
  isFullscreen?: boolean;
  initialPhaseTime?: number;
  onPhaseTimeRef?: React.MutableRefObject<number>;
  className?: string;
}

export const AstrolabeCanvas: React.FC<AstrolabeCanvasProps> = ({
  spec,
  isVisible,
  isInverted,
  isResonated,
  pulseToken,
  rareArrivalToken,
  isFullscreen = false,
  initialPhaseTime,
  onPhaseTimeRef,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const schedulerId = useId();

  // Mutable animation state stored in refs to avoid React re-renders at 60fps
  const phaseTimeRef = useRef<number>(
    initialPhaseTime !== undefined ? initialPhaseTime : (spec.seed % 1000) * 0.13,
  );
  const wallTimeRef = useRef<number>(0);
  const directionVelRef = useRef<number>(isInverted ? -1 : 1);
  const targetDirectionRef = useRef<number>(isInverted ? -1 : 1);
  const isResonatedRef = useRef<boolean>(isResonated);
  const pulseProgressRef = useRef<number>(1);
  const rareArrivalProgressRef = useRef<number>(1);
  const lastPulseTokenRef = useRef<number>(pulseToken);
  const lastRareTokenRef = useRef<number>(rareArrivalToken);
  const sizeRef = useRef<{ w: number; h: number; dpr: number }>({ w: 0, h: 0, dpr: 1 });

  useEffect(() => {
    targetDirectionRef.current = isInverted ? -1 : 1;
  }, [isInverted]);

  useEffect(() => {
    isResonatedRef.current = isResonated;
  }, [isResonated]);

  useEffect(() => {
    if (pulseToken !== lastPulseTokenRef.current) {
      lastPulseTokenRef.current = pulseToken;
      pulseProgressRef.current = 0.001;
    }
  }, [pulseToken]);

  useEffect(() => {
    if (rareArrivalToken !== lastRareTokenRef.current) {
      lastRareTokenRef.current = rareArrivalToken;
      rareArrivalProgressRef.current = 0.001;
    }
  }, [rareArrivalToken]);

  const drawFrame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w, h, dpr } = sizeRef.current;
    if (w <= 0 || h <= 0) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderAstrolabe(ctx, w, h, spec, {
      phaseTime: phaseTimeRef.current,
      wallTime: wallTimeRef.current,
      pulseProgress: pulseProgressRef.current,
      rareArrivalProgress: rareArrivalProgressRef.current,
      isResonated: isResonatedRef.current,
      isFullscreen,
    });
    ctx.restore();
  };

  // Sync canvas DPR dimensions on resize and paint an immediate crisp frame
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, isFullscreen ? 2.25 : 2);
      const targetW = Math.round(rect.width * dpr);
      const targetH = Math.round(rect.height * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      sizeRef.current = { w: rect.width, h: rect.height, dpr };
      drawFrame();
    };

    updateSize();

    const ro = new ResizeObserver(updateSize);
    ro.observe(canvas);
    return () => {
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, isFullscreen]);

  // Register/unregister with centralized 60fps scheduler strictly based on viewport visibility
  useEffect(() => {
    if (!isVisible) return;

    const unsubscribe = animationScheduler.subscribe(
      schedulerId,
      (_nowSec, dtSec) => {
        // Smoothly ease angular velocity direction on phase invert
        const diff = targetDirectionRef.current - directionVelRef.current;
        directionVelRef.current += diff * Math.min(1, dtSec * 6.5);

        // Brief phase velocity surge during resonance pulse
        let speedMult = 1;
        if (pulseProgressRef.current > 0 && pulseProgressRef.current < 1) {
          pulseProgressRef.current = Math.min(1, pulseProgressRef.current + dtSec * 1.35);
          speedMult = 1 + Math.sin(pulseProgressRef.current * Math.PI) * 1.45;
        }

        if (rareArrivalProgressRef.current > 0 && rareArrivalProgressRef.current < 1) {
          rareArrivalProgressRef.current = Math.min(1, rareArrivalProgressRef.current + dtSec * 1.05);
        }

        wallTimeRef.current += dtSec;
        phaseTimeRef.current += dtSec * directionVelRef.current * speedMult;
        if (onPhaseTimeRef) {
          onPhaseTimeRef.current = phaseTimeRef.current;
        }

        drawFrame();
      },
      isFullscreen,
    );

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, isFullscreen, schedulerId, spec]);

  return <canvas ref={canvasRef} className={`block w-full h-full ${className}`} />;
};
