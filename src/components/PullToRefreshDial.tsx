import React from 'react';

export const PTR_THRESHOLD = 76;
export const PTR_MAX_PULL = 114;

interface PullToRefreshDialProps {
  pullDistance: number;
  isRefreshing: boolean;
  isArmed: boolean;
  flashToken: number;
}

/**
 * Strictly text-free geometric astrolabe dial that physically winds up with pull distance,
 * flashes crisply past the release threshold, and snaps back smoothly on release.
 */
export const PullToRefreshDial: React.FC<PullToRefreshDialProps> = ({
  pullDistance,
  isRefreshing,
  isArmed,
  flashToken,
}) => {
  const activeHeight = isRefreshing ? 56 : pullDistance;
  if (activeHeight <= 0.5 && !isRefreshing) {
    return null;
  }

  const progress = Math.min(1, pullDistance / PTR_THRESHOLD);
  const opacity = isRefreshing ? 1 : Math.min(1, pullDistance / 26);
  const scale = isRefreshing ? 1 : 0.62 + progress * 0.38;

  // Direct physical winding tied to pull distance
  const outerRotation = pullDistance * 2.75;
  const innerRotation = -pullDistance * 4.1;
  const ringCircumference = 2 * Math.PI * 16.5;
  const dashOffset = ringCircumference * (1 - (isRefreshing ? 1 : progress));

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 right-0 z-30 flex items-center justify-center overflow-visible"
      style={{
        height: `${Math.max(44, activeHeight)}px`,
        transform: `translate3d(0, ${Math.min(12, activeHeight * 0.14)}px, 0)`,
        opacity,
      }}
    >
      <div
        className="relative flex items-center justify-center"
        style={{
          transform: `scale(${scale.toFixed(3)})`,
          filter:
            isArmed || isRefreshing
              ? 'drop-shadow(0 0 10px rgba(240,249,255,0.85)) drop-shadow(0 0 4px rgba(56,189,248,0.8))'
              : 'drop-shadow(0 0 5px rgba(56,189,248,0.35))',
        }}
      >
        {/* Crisp bright flash ring burst when pulled past release threshold */}
        {flashToken > 0 && (
          <span
            key={flashToken}
            className="pointer-events-none absolute w-11 h-11 rounded-full border border-white/95 animate-ptr-flash"
          />
        )}

        <svg
          width="42"
          height="42"
          viewBox="0 0 44 44"
          fill="none"
          className={isRefreshing ? 'animate-spin' : ''}
          style={isRefreshing ? { animationDuration: '0.52s' } : undefined}
        >
          {/* Quiet backing track */}
          <circle
            cx="22"
            cy="22"
            r="16.5"
            stroke="#334155"
            strokeOpacity="0.4"
            strokeWidth="1.1"
          />

          {/* Winding progress orbital arc */}
          <circle
            cx="22"
            cy="22"
            r="16.5"
            stroke={isArmed || isRefreshing ? '#FFFFFF' : '#38BDF8'}
            strokeWidth={isArmed || isRefreshing ? '1.65' : '1.3'}
            strokeLinecap="round"
            strokeDasharray={ringCircumference}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 22 22)"
          />

          {/* Outer winding tick ring tied directly to pull distance */}
          <g transform={`rotate(${outerRotation.toFixed(1)} 22 22)`}>
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <line
                key={deg}
                x1="22"
                y1="2.4"
                x2="22"
                y2={deg % 90 === 0 ? '6.4' : '4.8'}
                stroke={isArmed || isRefreshing ? '#F0F9FF' : '#94A3B8'}
                strokeOpacity={deg % 90 === 0 ? 0.92 : 0.58}
                strokeWidth={deg % 90 === 0 ? '1.35' : '1'}
                strokeLinecap="round"
                transform={`rotate(${deg} 22 22)`}
              />
            ))}
          </g>

          {/* Counter-rotating inscribed geometric sigil */}
          <g transform={`rotate(${innerRotation.toFixed(1)} 22 22)`}>
            <polygon
              points="22,10.2 32.2,27.9 11.8,27.9"
              stroke={isArmed || isRefreshing ? '#FFFFFF' : '#7DD3FC'}
              strokeOpacity={isArmed || isRefreshing ? 0.98 : 0.78}
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            <polygon
              points="22,33.8 11.8,16.1 32.2,16.1"
              stroke={isArmed || isRefreshing ? '#7DD3FC' : '#38BDF8'}
              strokeOpacity={isArmed || isRefreshing ? 0.9 : 0.52}
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </g>

          {/* Luminous central pivot node */}
          <circle
            cx="22"
            cy="22"
            r={isArmed || isRefreshing ? '2.6' : '1.9'}
            fill={isArmed || isRefreshing ? '#FFFFFF' : '#38BDF8'}
          />
        </svg>
      </div>
    </div>
  );
};
