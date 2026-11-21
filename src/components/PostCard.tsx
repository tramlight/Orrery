import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getAstrolabeSpec } from '../engine/generator';
import { hapticBookmark, hapticExpand, hapticRareArrival, hapticTap } from '../engine/haptics';
import {
  GeometricAvatar,
  GlyphHandle,
  PhaseInvertRuneIcon,
  RarityGlyph,
  ResonanceRuneIcon,
  RuneButton,
  VaultRuneIcon,
} from './AlienChrome';
import { AstrolabeCanvas } from './AstrolabeCanvas';

interface PostCardProps {
  seed: number;
  isBookmarked: boolean;
  isResonated: boolean;
  isInverted: boolean;
  compact?: boolean;
  onToggleBookmark: (seed: number) => void;
  onToggleResonate: (seed: number) => void;
  onToggleInvert: (seed: number) => void;
  onExpand: (seed: number, phaseTime: number) => void;
}

export const PostCard: React.FC<PostCardProps> = React.memo(
  ({
    seed,
    isBookmarked,
    isResonated,
    isInverted,
    compact = false,
    onToggleBookmark,
    onToggleResonate,
    onToggleInvert,
    onExpand,
  }) => {
    const spec = useMemo(() => getAstrolabeSpec(seed), [seed]);
    const cardRef = useRef<HTMLElement | null>(null);
    const phaseTimeRef = useRef<number>((seed % 1000) * 0.13);
    const rareTriggeredRef = useRef<boolean>(false);

    const [isVisible, setIsVisible] = useState<boolean>(false);
    const [pulseToken, setPulseToken] = useState<number>(0);
    const [rareArrivalToken, setRareArrivalToken] = useState<number>(0);
    const [showRareBorderPulse, setShowRareBorderPulse] = useState<boolean>(false);

    // Pause animation when off-screen to keep scrolling locked at 60fps
    useEffect(() => {
      const el = cardRef.current;
      if (!el) return;

      const visObserver = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (entry) {
            setIsVisible(entry.isIntersecting);
          }
        },
        { rootMargin: '140px 0px', threshold: 0.01 },
      );

      visObserver.observe(el);
      return () => visObserver.disconnect();
    }, []);

    // Subtle double-tap haptic pulse + visual arrival resonance when a Rare post scrolls into view
    useEffect(() => {
      if (spec.rarity !== 'rare' || compact) return;
      const el = cardRef.current;
      if (!el) return;

      const rareObserver = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (entry?.isIntersecting && !rareTriggeredRef.current) {
            rareTriggeredRef.current = true;
            hapticRareArrival();
            setRareArrivalToken((n) => n + 1);
            setShowRareBorderPulse(true);
            window.setTimeout(() => setShowRareBorderPulse(false), 900);
          }
        },
        { threshold: 0.55 },
      );

      rareObserver.observe(el);
      return () => rareObserver.disconnect();
    }, [spec.rarity, compact]);

    const handleResonate = () => {
      hapticTap();
      setPulseToken((n) => n + 1);
      onToggleResonate(seed);
    };

    const handleInvert = () => {
      hapticTap();
      onToggleInvert(seed);
    };

    const handleBookmark = () => {
      hapticBookmark(!isBookmarked);
      onToggleBookmark(seed);
    };

    const handleStageClick = () => {
      hapticExpand();
      onExpand(seed, phaseTimeRef.current);
    };

    const isRare = spec.rarity === 'rare';
    const rareBorderStyle = isRare
      ? { borderColor: `${spec.palette.primaryHex}33` }
      : undefined;

    if (compact) {
      // Compact archive tile for the hidden Vault grid view
      return (
        <article
          ref={cardRef}
          className="relative bg-[#07090F] border border-white/[0.06] rounded-xl overflow-hidden group"
          style={rareBorderStyle}
        >
          <button
            type="button"
            onClick={handleStageClick}
            aria-label="Expand geometric animation"
            className="block w-full aspect-square bg-[#030509] cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400/70"
          >
            <AstrolabeCanvas
              spec={spec}
              isVisible={isVisible}
              isInverted={isInverted}
              isResonated={isResonated}
              pulseToken={pulseToken}
              rareArrivalToken={rareArrivalToken}
              onPhaseTimeRef={phaseTimeRef}
            />
          </button>

          {/* Subtle corner rarity glyph & quick unbookmark */}
          <div className="absolute top-2 left-2 pointer-events-none opacity-85">
            <RarityGlyph rarity={spec.rarity} palette={spec.palette} />
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleBookmark();
            }}
            aria-label="Toggle vault bookmark"
            className="absolute bottom-1 right-1 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg bg-[#05070D]/70 backdrop-blur-sm transition-transform active:scale-90 cursor-pointer"
            style={{
              filter: `drop-shadow(0 0 6px ${spec.palette.primaryHex}bb)`,
            }}
          >
            <VaultRuneIcon active={isBookmarked} color={spec.palette.primaryHex} />
          </button>
        </article>
      );
    }

    return (
      <article
        ref={cardRef}
        className="relative bg-[#07090F] border-y sm:border border-white/[0.06] sm:rounded-2xl overflow-hidden transition-colors duration-300"
        style={rareBorderStyle}
      >
        {/* Subtle luminous double-pulse border flash on Rare arrival */}
        {showRareBorderPulse && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-20 sm:rounded-2xl animate-rare-arrival"
            style={{
              boxShadow: `inset 0 0 0 1.5px ${spec.palette.accentHex}aa, inset 0 0 24px ${spec.palette.primaryHex}33`,
            }}
          />
        )}

        {/* Minimalist Alien Header: Procedural geometric avatar + abstract glyph handle + rarity emblem */}
        <header className="flex items-center justify-between px-3.5 py-2.5 bg-[#07090F]">
          <div className="flex items-center gap-2.5 min-w-0">
            <GeometricAvatar avatar={spec.avatar} palette={spec.palette} rarity={spec.rarity} />
            <GlyphHandle
              glyphs={spec.handleGlyphs}
              palette={spec.palette}
              rarity={spec.rarity}
            />
          </div>
          <RarityGlyph rarity={spec.rarity} palette={spec.palette} />
        </header>

        {/* Edge-to-edge vector animation stage */}
        <button
          type="button"
          onClick={handleStageClick}
          aria-label="Expand geometric animation"
          className="block w-full aspect-square relative bg-[#020306] border-y border-white/[0.04] cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400/70"
        >
          <AstrolabeCanvas
            spec={spec}
            isVisible={isVisible}
            isInverted={isInverted}
            isResonated={isResonated}
            pulseToken={pulseToken}
            rareArrivalToken={rareArrivalToken}
            onPhaseTimeRef={phaseTimeRef}
          />
        </button>

        {/* Footer: 3 simple, cryptic geometric icon buttons that glow when tapped */}
        <footer className="flex items-center justify-between px-2 py-1 bg-[#07090F]">
          <div className="flex items-center gap-1">
            <RuneButton
              active={isResonated}
              accentHex={spec.palette.primaryHex}
              onClick={handleResonate}
              ariaLabel="Harmonic resonance"
            >
              <ResonanceRuneIcon active={isResonated} color={spec.palette.primaryHex} />
            </RuneButton>

            <RuneButton
              active={isInverted}
              accentHex={spec.palette.secondaryHex}
              onClick={handleInvert}
              ariaLabel="Invert orbital phase"
            >
              <PhaseInvertRuneIcon active={isInverted} color={spec.palette.secondaryHex} />
            </RuneButton>
          </div>

          <RuneButton
            active={isBookmarked}
            accentHex={spec.palette.primaryHex}
            onClick={handleBookmark}
            ariaLabel="Save seed to vault"
          >
            <VaultRuneIcon active={isBookmarked} color={spec.palette.primaryHex} />
          </RuneButton>
        </footer>
      </article>
    );
  },
);
