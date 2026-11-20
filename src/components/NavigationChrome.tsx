import React from 'react';
import { VaultRuneIcon } from './AlienChrome';

export type ActiveTab = 'feed' | 'vault';

interface TopChromeProps {
  activeTab: ActiveTab;
  vaultCompact: boolean;
  isShuffling: boolean;
  isInstallable: boolean;
  onScrollTop: () => void;
  onReshuffle: () => void;
  onToggleVaultLayout: () => void;
  onInstall: () => void;
}

/**
 * Minimalist non-sticky top chrome with zero text—only geometric astrolabe affordances.
 */
export const TopChrome: React.FC<TopChromeProps> = ({
  activeTab,
  vaultCompact,
  isShuffling,
  isInstallable,
  onScrollTop,
  onReshuffle,
  onToggleVaultLayout,
  onInstall,
}) => {
  return (
    <header className="w-full max-w-6xl mx-auto px-3 sm:px-6 h-12 flex items-center justify-between">
      {/* Left: Minimal astrolabe emblem (tap to return to top) */}
      <button
        type="button"
        onClick={onScrollTop}
        aria-label="Return to top"
        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400/60 cursor-pointer"
      >
        <svg width="24" height="24" viewBox="0 0 28 28" fill="none" aria-hidden="true">
          <circle cx="14" cy="14" r="10.5" stroke="#38BDF8" strokeOpacity="0.65" strokeWidth="1.2" />
          <circle
            cx="14"
            cy="14"
            r="6.2"
            stroke="#94A3B8"
            strokeOpacity="0.55"
            strokeWidth="1"
            strokeDasharray="3 2.5"
          />
          <polygon points="14,5.5 21.3,18.2 6.7,18.2" stroke="#BAE6FD" strokeOpacity="0.82" strokeWidth="1.1" />
          <circle cx="14" cy="14" r="1.6" fill="#38BDF8" />
        </svg>
      </button>

      {/* Right: Optional cryptic install rune (auto-hidden when standalone) + contextual action rune */}
      <div className="flex items-center gap-1">
        {isInstallable && (
          <button
            type="button"
            onClick={onInstall}
            aria-label="Install app"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400/60 cursor-pointer"
            style={{ filter: 'drop-shadow(0 0 6px rgba(56,189,248,0.55))' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M 12 4 L 12 15 M 8 11.5 L 12 15.5 L 16 11.5"
                stroke="#38BDF8"
                strokeWidth="1.45"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M 5.5 16.5 L 5.5 19 L 18.5 19 L 18.5 16.5"
                stroke="#BAE6FD"
                strokeOpacity="0.82"
                strokeWidth="1.35"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        {activeTab === 'feed' ? (
          <button
            type="button"
            onClick={onReshuffle}
            aria-label="Randomize new feed session"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400/60 cursor-pointer"
          >
            <svg
              width="21"
              height="21"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              className={`transition-transform duration-500 ease-out ${isShuffling ? 'rotate-180' : 'rotate-0'}`}
            >
              <circle
                cx="12"
                cy="12"
                r="8.2"
                stroke="#64748B"
                strokeWidth="1.3"
                strokeDasharray="9 4.5"
              />
              <polygon points="12,6.5 16.8,14.8 7.2,14.8" stroke="#94A3B8" strokeWidth="1.2" />
              <circle cx="12" cy="12" r="1.4" fill="#38BDF8" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggleVaultLayout}
            aria-label="Toggle vault layout density"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400/60 cursor-pointer"
          >
            {vaultCompact ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="4" y="4" width="16" height="16" rx="2" stroke="#94A3B8" strokeWidth="1.35" />
                <circle cx="12" cy="12" r="3.5" stroke="#38BDF8" strokeWidth="1.2" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" stroke="#94A3B8" strokeWidth="1.3" />
                <rect x="13.5" y="3.5" width="7" height="7" rx="1.2" stroke="#94A3B8" strokeWidth="1.3" />
                <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" stroke="#94A3B8" strokeWidth="1.3" />
                <rect x="13.5" y="13.5" width="7" height="7" rx="1.2" stroke="#38BDF8" strokeWidth="1.3" />
              </svg>
            )}
          </button>
        )}
      </div>
    </header>
  );
};

interface BottomNavDockProps {
  activeTab: ActiveTab;
  vaultCount: number;
  vaultPingToken: number;
  onSelectTab: (tab: ActiveTab) => void;
}

/**
 * Slim fixed bottom thumb-zone dock (< 8% mobile viewport height) with zero text.
 * Houses the primary infinite feed sigil and the subtle hidden Vault tab sigil.
 */
export const BottomNavDock: React.FC<BottomNavDockProps> = ({
  activeTab,
  vaultCount,
  vaultPingToken,
  onSelectTab,
}) => {
  const visiblePips = Math.min(vaultCount, 5);

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#040508]/90 backdrop-blur-md border-t border-white/[0.06] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="max-w-md mx-auto h-14 flex items-center justify-around px-8">
        {/* Tab 1: Infinite Astrolabe Feed */}
        <button
          type="button"
          onClick={() => onSelectTab('feed')}
          aria-label="Infinite feed"
          aria-current={activeTab === 'feed' ? 'page' : undefined}
          className="relative min-w-[56px] min-h-[44px] flex flex-col items-center justify-center transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400/60 cursor-pointer"
        >
          <svg
            width="23"
            height="23"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            style={
              activeTab === 'feed'
                ? { filter: 'drop-shadow(0 0 7px rgba(56,189,248,0.75))' }
                : undefined
            }
          >
            <circle
              cx="12"
              cy="12"
              r="8.5"
              stroke={activeTab === 'feed' ? '#38BDF8' : '#475569'}
              strokeWidth="1.4"
            />
            <circle
              cx="12"
              cy="12"
              r="4.2"
              stroke={activeTab === 'feed' ? '#E0F2FE' : '#475569'}
              strokeWidth="1.2"
            />
            <circle
              cx="12"
              cy="3.5"
              r="1.4"
              fill={activeTab === 'feed' ? '#BAE6FD' : '#475569'}
            />
            <circle
              cx="12"
              cy="20.5"
              r="1.4"
              fill={activeTab === 'feed' ? '#BAE6FD' : '#475569'}
            />
          </svg>
          <span
            aria-hidden="true"
            className={`mt-1 h-[1.5px] rounded-full transition-all duration-200 ${
              activeTab === 'feed' ? 'w-5 bg-cyan-400 opacity-100' : 'w-0 bg-transparent opacity-0'
            }`}
          />
        </button>

        {/* Tab 2: Hidden Second Tab (Personal Seed Vault) */}
        <button
          type="button"
          onClick={() => onSelectTab('vault')}
          aria-label="Saved vault collection"
          aria-current={activeTab === 'vault' ? 'page' : undefined}
          className={`relative min-w-[56px] min-h-[44px] flex flex-col items-center justify-center transition-all duration-200 active:scale-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400/60 cursor-pointer ${
            activeTab === 'vault'
              ? 'opacity-100'
              : vaultCount > 0
              ? 'opacity-70 hover:opacity-95'
              : 'opacity-25 hover:opacity-55'
          }`}
        >
          {/* Crisp geometric ping ring when a new seed locks into the vault */}
          {vaultPingToken > 0 && (
            <span
              key={vaultPingToken}
              aria-hidden="true"
              className="pointer-events-none absolute w-7 h-7 rounded-full border border-cyan-300/80 animate-vault-ping"
            />
          )}

          <div
            style={
              activeTab === 'vault'
                ? { filter: 'drop-shadow(0 0 7px rgba(186,230,253,0.8))' }
                : undefined
            }
          >
            <VaultRuneIcon
              active={activeTab === 'vault' || vaultCount > 0}
              color={activeTab === 'vault' ? '#BAE6FD' : '#38BDF8'}
            />
          </div>

          {/* Pure geometric constellation pips (zero numbers!) */}
          <div className="mt-1 h-[4px] flex items-center justify-center gap-[3px]" aria-hidden="true">
            {activeTab === 'vault' ? (
              <span className="w-5 h-[1.5px] rounded-full bg-cyan-200" />
            ) : (
              Array.from({ length: visiblePips }).map((_, idx) => (
                <span
                  key={idx}
                  className="w-[3px] h-[3px] rotate-45 bg-cyan-300/80"
                />
              ))
            )}
          </div>
        </button>
      </div>
    </nav>
  );
};

/**
 * Pure zero-text geometric empty state for the Hidden Vault tab.
 */
export const EmptyVaultVessel: React.FC<{ onReturnFeed: () => void }> = ({ onReturnFeed }) => {
  return (
    <div className="min-h-[68vh] flex flex-col items-center justify-center px-6">
      <button
        type="button"
        onClick={onReturnFeed}
        aria-label="Return to feed"
        className="group p-8 rounded-full transition-transform duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400/50 cursor-pointer"
      >
        <svg
          width="148"
          height="148"
          viewBox="0 0 160 160"
          fill="none"
          aria-hidden="true"
          className="opacity-45 group-hover:opacity-75 transition-opacity duration-300"
        >
          <circle
            cx="80"
            cy="80"
            r="68"
            stroke="#334155"
            strokeWidth="1"
            strokeDasharray="4 6"
          />
          <circle cx="80" cy="80" r="50" stroke="#1E293B" strokeWidth="1" />
          <path
            d="M 80 26 L 122 52 L 108 118 L 80 134 L 52 118 L 38 52 Z"
            stroke="#38BDF8"
            strokeOpacity="0.4"
            strokeWidth="1.2"
            strokeDasharray="5 4"
          />
          <path
            d="M 80 56 L 96 80 L 80 104 L 64 80 Z"
            stroke="#475569"
            strokeWidth="1.1"
          />
          <circle cx="80" cy="80" r="2.2" fill="#38BDF8" fillOpacity="0.5" />
        </svg>
      </button>
    </div>
  );
};
