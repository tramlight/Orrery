import React from 'react';
import { AstrolabePalette, AvatarSpec, GlyphSpec, Rarity } from '../engine/types';

function polygonPoints(sides: number, cx: number, cy: number, r: number, rotDeg = -90): string {
  const pts: string[] = [];
  const radOffset = (rotDeg * Math.PI) / 180;
  for (let i = 0; i < sides; i++) {
    const a = radOffset + (i * Math.PI * 2) / sides;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)}`);
  }
  return pts.join(' ');
}

export const GeometricAvatar: React.FC<{
  avatar: AvatarSpec;
  palette: AstrolabePalette;
  rarity: Rarity;
}> = React.memo(({ avatar, palette }) => {
  const strokeMain = palette.primaryHex;
  const strokeSub = palette.secondaryHex;
  const accent = palette.accentHex;

  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      {/* Subtle obsidian container backing */}
      <circle cx="16" cy="16" r="14.5" fill="#060911" />

      {/* Outer geometric frame */}
      {avatar.frame === 'circle' && (
        <circle cx="16" cy="16" r="13.5" stroke={strokeMain} strokeOpacity="0.72" strokeWidth="1.15" />
      )}
      {avatar.frame === 'hexagon' && (
        <polygon
          points={polygonPoints(6, 16, 16, 13.8, -90)}
          stroke={strokeMain}
          strokeOpacity="0.74"
          strokeWidth="1.15"
        />
      )}
      {avatar.frame === 'octagon' && (
        <polygon
          points={polygonPoints(8, 16, 16, 13.8, -67.5)}
          stroke={strokeMain}
          strokeOpacity="0.74"
          strokeWidth="1.15"
        />
      )}
      {avatar.frame === 'diamond' && (
        <polygon
          points={polygonPoints(4, 16, 16, 14.2, -90)}
          stroke={strokeMain}
          strokeOpacity="0.78"
          strokeWidth="1.15"
        />
      )}

      {/* Optional cardinal reticle cross */}
      {avatar.hasCross && (
        <path
          d="M 16 4.5 L 16 27.5 M 4.5 16 L 27.5 16"
          stroke={strokeSub}
          strokeOpacity="0.4"
          strokeWidth="0.9"
        />
      )}

      {/* Inner symmetric polygon sigil */}
      <polygon
        points={polygonPoints(avatar.symmetry, 16, 16, 9.8 * avatar.ringScale + 2.5, avatar.rotationDeg - 90)}
        stroke={strokeSub}
        strokeOpacity="0.9"
        strokeWidth="1.15"
      />

      {avatar.innerPolygons > 1 && (
        <polygon
          points={polygonPoints(
            avatar.symmetry,
            16,
            16,
            6.1,
            avatar.rotationDeg - 90 + 180 / avatar.symmetry,
          )}
          stroke={accent}
          strokeOpacity="0.82"
          strokeWidth="1"
        />
      )}

      {avatar.hasCenterDot && <circle cx="16" cy="16" r="1.7" fill={accent} />}
    </svg>
  );
});

export const GlyphHandle: React.FC<{
  glyphs: GlyphSpec[];
  palette: AstrolabePalette;
  rarity: Rarity;
}> = React.memo(({ glyphs, palette }) => {
  // Apply each post's selected palette consistently to its procedural glyph handle
  return (
    <div className="flex items-center gap-[3px]" aria-hidden="true">
      {glyphs.map((glyph, idx) => {
        const strokeColor = idx % 3 === 2 ? palette.secondaryHex : palette.primaryHex;
        const strokeOpacity = idx % 3 === 2 ? 0.84 : 0.78;
        return (
          <svg
            key={idx}
            width="11"
            height="13"
            viewBox="0 0 10 12"
            fill="none"
            className="shrink-0"
          >
            {glyph.strokes.map((stroke, sIdx) => {
              if (stroke.type === 'circle') {
                return (
                  <circle
                    key={sIdx}
                    cx={stroke.cx}
                    cy={stroke.cy}
                    r={stroke.r}
                    fill={stroke.filled ? palette.accentHex : 'none'}
                    fillOpacity={stroke.filled ? 0.88 : 0}
                    stroke={stroke.filled ? 'none' : strokeColor}
                    strokeOpacity={strokeOpacity}
                    strokeWidth="1.15"
                  />
                );
              }
              return (
                <path
                  key={sIdx}
                  d={stroke.d}
                  stroke={strokeColor}
                  strokeOpacity={strokeOpacity}
                  strokeWidth="1.15"
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                />
              );
            })}
          </svg>
        );
      })}
    </div>
  );
});

export const RarityGlyph: React.FC<{
  rarity: Rarity;
  palette: AstrolabePalette;
}> = React.memo(({ rarity, palette }) => {
  if (rarity === 'common') {
    return (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="4" stroke={palette.primaryHex} strokeOpacity="0.52" strokeWidth="1.1" />
        <circle cx="10" cy="10" r="1.2" fill={palette.accentHex} fillOpacity="0.7" />
      </svg>
    );
  }

  if (rarity === 'uncommon') {
    return (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <polygon
          points="10,2.5 17.5,10 10,17.5 2.5,10"
          stroke={palette.primaryHex}
          strokeOpacity="0.78"
          strokeWidth="1.15"
        />
        <polygon
          points="10,6.2 13.8,10 10,13.8 6.2,10"
          stroke={palette.secondaryHex}
          strokeOpacity="0.92"
          strokeWidth="1.1"
        />
      </svg>
    );
  }

  // Rare: Distinct 4-point astrolabe star + concentric ring in the post's own palette
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ filter: `drop-shadow(0 0 5px ${palette.primaryHex}99)` }}
    >
      <circle cx="12" cy="12" r="8.2" stroke={palette.secondaryHex} strokeOpacity="0.62" strokeWidth="1" />
      <path
        d="M 12 2.2 L 14.1 9.9 L 21.8 12 L 14.1 14.1 L 12 21.8 L 9.9 14.1 L 2.2 12 L 9.9 9.9 Z"
        stroke={palette.accentHex}
        strokeWidth="1.25"
        fill={palette.primaryHex}
        fillOpacity="0.24"
      />
      <circle cx="12" cy="12" r="1.5" fill="#FFFFFF" fillOpacity="0.95" />
    </svg>
  );
});

interface RuneButtonProps {
  active: boolean;
  accentHex: string;
  onClick: () => void;
  ariaLabel: string;
  children: React.ReactNode;
}

export const RuneButton: React.FC<RuneButtonProps> = ({
  active,
  accentHex,
  onClick,
  ariaLabel,
  children,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      className="relative min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-transform duration-150 ease-out active:scale-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400/60 cursor-pointer"
      style={
        active
          ? {
              filter: `drop-shadow(0 0 7px ${accentHex}bb) drop-shadow(0 0 2px ${accentHex})`,
            }
          : undefined
      }
    >
      {children}
    </button>
  );
};

/** Rune 1: Resonance / Harmonic Pulse Sigil */
export const ResonanceRuneIcon: React.FC<{ active: boolean; color: string }> = ({
  active,
  color,
}) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <polygon
      points="12,3 21,12 12,21 3,12"
      stroke={active ? color : '#64748B'}
      strokeOpacity={active ? 1 : 0.72}
      strokeWidth="1.45"
      fill={active ? color : 'none'}
      fillOpacity={active ? 0.16 : 0}
    />
    <circle
      cx="12"
      cy="12"
      r="3.2"
      stroke={active ? '#FFFFFF' : '#64748B'}
      strokeOpacity={active ? 0.92 : 0.65}
      strokeWidth="1.25"
    />
    <path
      d="M 12 1.2 L 12 3.2 M 12 20.8 L 12 22.8 M 1.2 12 L 3.2 12 M 20.8 12 L 22.8 12"
      stroke={active ? color : '#475569'}
      strokeWidth="1.3"
      strokeLinecap="round"
    />
  </svg>
);

/** Rune 2: Counter-Orbital Phase Invert Sigil */
export const PhaseInvertRuneIcon: React.FC<{ active: boolean; color: string }> = ({
  active,
  color,
}) => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    className={`transition-transform duration-300 ease-out ${active ? 'rotate-180' : 'rotate-0'}`}
  >
    <path
      d="M 5.5 9.2 A 7.2 7.2 0 0 1 18.5 9.2"
      stroke={active ? color : '#64748B'}
      strokeOpacity={active ? 1 : 0.72}
      strokeWidth="1.45"
      strokeLinecap="round"
    />
    <path
      d="M 18.5 14.8 A 7.2 7.2 0 0 1 5.5 14.8"
      stroke={active ? color : '#64748B'}
      strokeOpacity={active ? 1 : 0.72}
      strokeWidth="1.45"
      strokeLinecap="round"
    />
    <path
      d="M 16.5 6.8 L 19 9.5 L 15.6 10.1"
      stroke={active ? color : '#64748B'}
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M 7.5 17.2 L 5 14.5 L 8.4 13.9"
      stroke={active ? color : '#64748B'}
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="12"
      cy="12"
      r="1.9"
      fill={active ? '#FFFFFF' : 'none'}
      stroke={active ? color : '#64748B'}
      strokeWidth="1.25"
    />
  </svg>
);

/** Rune 3: Hidden Vault / Bookmark Seed Sigil */
export const VaultRuneIcon: React.FC<{ active: boolean; color: string }> = ({
  active,
  color,
}) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M 12 2.8 L 19.2 7.4 L 16.8 18.8 L 12 21.6 L 7.2 18.8 L 4.8 7.4 Z"
      stroke={active ? color : '#64748B'}
      strokeOpacity={active ? 1 : 0.72}
      strokeWidth="1.45"
      strokeLinejoin="miter"
      fill={active ? color : 'none'}
      fillOpacity={active ? 0.18 : 0}
    />
    <path
      d="M 12 7.2 L 15.2 12 L 12 16.8 L 8.8 12 Z"
      stroke={active ? '#FFFFFF' : '#64748B'}
      strokeOpacity={active ? 0.95 : 0.65}
      strokeWidth="1.25"
      fill={active ? color : 'none'}
      fillOpacity={active ? 0.45 : 0}
    />
    <path
      d="M 12 2.8 L 12 7.2"
      stroke={active ? color : '#475569'}
      strokeWidth="1.2"
    />
  </svg>
);
