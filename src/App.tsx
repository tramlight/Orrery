import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FullscreenViewer } from './components/FullscreenViewer';
import {
  ActiveTab,
  BottomNavDock,
  EmptyVaultVessel,
  TopChrome,
} from './components/NavigationChrome';
import { PostCard } from './components/PostCard';
import {
  PTR_MAX_PULL,
  PTR_THRESHOLD,
  PullToRefreshDial,
} from './components/PullToRefreshDial';
import { hapticTap } from './engine/haptics';
import { deriveItemSeed, generateFreshSeed } from './engine/prng';
import {
  loadInvertedSeeds,
  loadResonatedSeeds,
  loadVaultSeeds,
  saveInvertedSeeds,
  saveResonatedSeeds,
  saveVaultSeeds,
} from './engine/storage';
import { usePWAInstall } from './hooks/usePWAInstall';

const INITIAL_BATCH = 15;
const APPEND_BATCH = 12;

export default function App() {
  const [sessionSeed, setSessionSeed] = useState<number>(() => generateFreshSeed());
  const [feedCount, setFeedCount] = useState<number>(INITIAL_BATCH);
  const [activeTab, setActiveTab] = useState<ActiveTab>('feed');
  const [vaultCompact, setVaultCompact] = useState<boolean>(false);
  const [isShuffling, setIsShuffling] = useState<boolean>(false);
  const { isInstallable, install } = usePWAInstall();

  // Pull-to-refresh state
  const [pullDistance, setPullDistance] = useState<number>(0);
  const [isPullDragging, setIsPullDragging] = useState<boolean>(false);
  const [isPullRefreshing, setIsPullRefreshing] = useState<boolean>(false);
  const [isPullArmed, setIsPullArmed] = useState<boolean>(false);
  const [ptrFlashToken, setPtrFlashToken] = useState<number>(0);

  // Offline-persisted personal states
  const [vaultSeeds, setVaultSeeds] = useState<number[]>(() => loadVaultSeeds());
  const [resonatedSeeds, setResonatedSeeds] = useState<Set<number>>(() => loadResonatedSeeds());
  const [invertedSeeds, setInvertedSeeds] = useState<Set<number>>(() => loadInvertedSeeds());
  const [vaultPingToken, setVaultPingToken] = useState<number>(0);

  // Fullscreen edge-to-edge viewer state
  const [fullscreenItem, setFullscreenItem] = useState<{
    seed: number;
    phaseTime: number;
  } | null>(null);

  // Remember feed scroll position when hopping into the hidden Vault tab
  const feedScrollYRef = useRef<number>(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Pull-to-refresh gesture refs
  const ptrStartRef = useRef<{ x: number; y: number; eligible: boolean } | null>(null);
  const ptrPullingRef = useRef<boolean>(false);
  const ptrArmedRef = useRef<boolean>(false);
  const ptrRefreshingRef = useRef<boolean>(false);
  const ptrTimerRef = useRef<number | null>(null);

  const vaultSet = useMemo(() => new Set(vaultSeeds), [vaultSeeds]);

  const feedSeeds = useMemo(() => {
    const arr: number[] = new Array(feedCount);
    for (let i = 0; i < feedCount; i++) {
      arr[i] = deriveItemSeed(sessionSeed, i);
    }
    return arr;
  }, [sessionSeed, feedCount]);

  // Infinite scroll sentinel observer
  useEffect(() => {
    if (activeTab !== 'feed') return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setFeedCount((prev) => prev + APPEND_BATCH);
        }
      },
      { rootMargin: '700px 0px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [activeTab]);

  // Custom tactile pull-to-refresh gesture at the top of the main feed
  useEffect(() => {
    if (activeTab !== 'feed' || fullscreenItem) {
      ptrStartRef.current = null;
      ptrPullingRef.current = false;
      ptrArmedRef.current = false;
      setPullDistance(0);
      setIsPullDragging(false);
      setIsPullArmed(false);
      return;
    }

    const onTouchStart = (e: TouchEvent) => {
      if (ptrRefreshingRef.current || e.touches.length !== 1) return;
      const t = e.touches[0];
      const atTop = window.scrollY <= 1;
      ptrStartRef.current = { x: t.clientX, y: t.clientY, eligible: atTop };
      ptrPullingRef.current = false;
      ptrArmedRef.current = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      const start = ptrStartRef.current;
      if (!start || !start.eligible || ptrRefreshingRef.current || e.touches.length !== 1) return;

      const t = e.touches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;

      // Cancel pull if user scrolls down into feed or intends a horizontal swipe
      if (!ptrPullingRef.current) {
        if (dy < 6 || window.scrollY > 1) {
          if (dy < -4) start.eligible = false;
          return;
        }
        if (Math.abs(dx) > dy * 0.85) {
          start.eligible = false;
          return;
        }
        ptrPullingRef.current = true;
        setIsPullDragging(true);
      }

      if (dy <= 0) {
        setPullDistance(0);
        if (ptrArmedRef.current) {
          ptrArmedRef.current = false;
          setIsPullArmed(false);
        }
        return;
      }

      // Prevent Android Chrome's native browser reload spinner from hijacking the gesture
      if (e.cancelable) {
        e.preventDefault();
      }

      // Clockwork spring damping curve
      const damped = Math.min(PTR_MAX_PULL, Math.pow(dy, 0.86) * 0.82);
      setPullDistance(damped);

      const crossed = damped >= PTR_THRESHOLD;
      if (crossed && !ptrArmedRef.current) {
        ptrArmedRef.current = true;
        setIsPullArmed(true);
        hapticTap();
        setPtrFlashToken((n) => n + 1);
      } else if (!crossed && ptrArmedRef.current) {
        ptrArmedRef.current = false;
        setIsPullArmed(false);
      }
    };

    const finishPull = () => {
      const wasPulling = ptrPullingRef.current;
      const wasArmed = ptrArmedRef.current;

      ptrStartRef.current = null;
      ptrPullingRef.current = false;
      ptrArmedRef.current = false;
      setIsPullDragging(false);
      setIsPullArmed(false);

      if (!wasPulling) return;

      if (wasArmed) {
        ptrRefreshingRef.current = true;
        setIsPullRefreshing(true);
        setPullDistance(56);

        // Immediately roll a freshly randomized session feed
        setSessionSeed(generateFreshSeed());
        setFeedCount(INITIAL_BATCH);

        if (ptrTimerRef.current !== null) {
          window.clearTimeout(ptrTimerRef.current);
        }
        ptrTimerRef.current = window.setTimeout(() => {
          ptrRefreshingRef.current = false;
          setIsPullRefreshing(false);
          setPullDistance(0);
          ptrTimerRef.current = null;
        }, 380);
      } else {
        setPullDistance(0);
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', finishPull, { passive: true });
    window.addEventListener('touchcancel', finishPull, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', finishPull);
      window.removeEventListener('touchcancel', finishPull);
    };
  }, [activeTab, fullscreenItem]);

  useEffect(() => {
    return () => {
      if (ptrTimerRef.current !== null) {
        window.clearTimeout(ptrTimerRef.current);
      }
    };
  }, []);

  const handleToggleBookmark = useCallback((seed: number) => {
    setVaultSeeds((prev) => {
      const exists = prev.includes(seed);
      const next = exists ? prev.filter((s) => s !== seed) : [seed, ...prev];
      saveVaultSeeds(next);
      if (!exists) {
        setVaultPingToken((t) => t + 1);
      }
      return next;
    });
  }, []);

  const handleToggleResonate = useCallback((seed: number) => {
    setResonatedSeeds((prev) => {
      const next = new Set(prev);
      if (next.has(seed)) {
        next.delete(seed);
      } else {
        next.add(seed);
      }
      saveResonatedSeeds(next);
      return next;
    });
  }, []);

  const handleToggleInvert = useCallback((seed: number) => {
    setInvertedSeeds((prev) => {
      const next = new Set(prev);
      if (next.has(seed)) {
        next.delete(seed);
      } else {
        next.add(seed);
      }
      saveInvertedSeeds(next);
      return next;
    });
  }, []);

  const handleExpand = useCallback((seed: number, phaseTime: number) => {
    setFullscreenItem({ seed, phaseTime });
  }, []);

  const handleDismissFullscreen = useCallback(() => {
    setFullscreenItem(null);
  }, []);

  const handleSelectTab = useCallback(
    (tab: ActiveTab) => {
      if (tab === activeTab) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      hapticTap();
      if (activeTab === 'feed') {
        feedScrollYRef.current = window.scrollY;
      }
      setActiveTab(tab);
      requestAnimationFrame(() => {
        if (tab === 'feed') {
          window.scrollTo({ top: feedScrollYRef.current, behavior: 'instant' as ScrollBehavior });
        } else {
          window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
        }
      });
    },
    [activeTab],
  );

  const handleScrollTop = useCallback(() => {
    hapticTap();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleReshuffle = useCallback(() => {
    hapticTap();
    setIsShuffling(true);
    setSessionSeed(generateFreshSeed());
    setFeedCount(INITIAL_BATCH);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.setTimeout(() => setIsShuffling(false), 520);
  }, []);

  const handleToggleVaultLayout = useCallback(() => {
    hapticTap();
    setVaultCompact((prev) => !prev);
  }, []);

  const handleInstall = useCallback(() => {
    hapticTap();
    void install();
  }, [install]);

  // Natural horizontal swipe between Feed and hidden Vault tab on mobile touchscreens
  const handleTouchStart = (e: React.TouchEvent) => {
    if (fullscreenItem || e.touches.length !== 1) return;
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (
      fullscreenItem ||
      ptrPullingRef.current ||
      !touchStartRef.current ||
      e.changedTouches.length !== 1
    ) {
      touchStartRef.current = null;
      return;
    }
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    // Require clear horizontal intent (> 78px and > 2x vertical movement)
    if (Math.abs(dx) > 78 && Math.abs(dx) > Math.abs(dy) * 2) {
      if (dx < 0 && activeTab === 'feed') {
        handleSelectTab('vault');
      } else if (dx > 0 && activeTab === 'vault') {
        handleSelectTab('feed');
      }
    }
  };

  const contentOffsetY = activeTab === 'feed' ? pullDistance : 0;

  return (
    <div
      className="min-h-dvh bg-[#040508] text-slate-100 pb-20 overscroll-y-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {activeTab === 'feed' && (
        <PullToRefreshDial
          pullDistance={pullDistance}
          isRefreshing={isPullRefreshing}
          isArmed={isPullArmed}
          flashToken={ptrFlashToken}
        />
      )}

      <div
        className={
          isPullDragging
            ? 'will-change-transform'
            : 'transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]'
        }
        style={
          contentOffsetY > 0
            ? { transform: `translate3d(0, ${contentOffsetY.toFixed(1)}px, 0)` }
            : undefined
        }
      >
        <TopChrome
          activeTab={activeTab}
          vaultCompact={vaultCompact}
          isShuffling={isShuffling}
          isInstallable={isInstallable}
          onScrollTop={handleScrollTop}
          onReshuffle={handleReshuffle}
          onToggleVaultLayout={handleToggleVaultLayout}
          onInstall={handleInstall}
        />

        <main className="w-full max-w-6xl mx-auto sm:px-6">
          {activeTab === 'feed' ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
                {feedSeeds.map((seed) => (
                  <PostCard
                    key={`${sessionSeed}-${seed}`}
                    seed={seed}
                    isBookmarked={vaultSet.has(seed)}
                    isResonated={resonatedSeeds.has(seed)}
                    isInverted={invertedSeeds.has(seed)}
                    onToggleBookmark={handleToggleBookmark}
                    onToggleResonate={handleToggleResonate}
                    onToggleInvert={handleToggleInvert}
                    onExpand={handleExpand}
                  />
                ))}
              </div>

              {/* Pure geometric infinite-scroll loading sentinel (zero text) */}
              <div
                ref={sentinelRef}
                aria-hidden="true"
                className="h-24 flex items-center justify-center"
              >
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 28 28"
                  fill="none"
                  className="animate-spin opacity-35"
                  style={{ animationDuration: '5s' }}
                >
                  <circle
                    cx="14"
                    cy="14"
                    r="10"
                    stroke="#38BDF8"
                    strokeWidth="1.2"
                    strokeDasharray="6 6"
                  />
                  <circle cx="14" cy="4" r="1.4" fill="#BAE6FD" />
                </svg>
              </div>
            </>
          ) : vaultSeeds.length === 0 ? (
            <EmptyVaultVessel onReturnFeed={() => handleSelectTab('feed')} />
          ) : (
            <div
              className={
                vaultCompact
                  ? 'px-3 sm:px-0 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 pt-1'
                  : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6'
              }
            >
              {vaultSeeds.map((seed) => (
                <PostCard
                  key={`vault-${seed}`}
                  seed={seed}
                  compact={vaultCompact}
                  isBookmarked={true}
                  isResonated={resonatedSeeds.has(seed)}
                  isInverted={invertedSeeds.has(seed)}
                  onToggleBookmark={handleToggleBookmark}
                  onToggleResonate={handleToggleResonate}
                  onToggleInvert={handleToggleInvert}
                  onExpand={handleExpand}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      <BottomNavDock
        activeTab={activeTab}
        vaultCount={vaultSeeds.length}
        vaultPingToken={vaultPingToken}
        onSelectTab={handleSelectTab}
      />

      <FullscreenViewer
        activeItem={fullscreenItem}
        isInverted={fullscreenItem ? invertedSeeds.has(fullscreenItem.seed) : false}
        isResonated={fullscreenItem ? resonatedSeeds.has(fullscreenItem.seed) : false}
        onDismiss={handleDismissFullscreen}
      />
    </div>
  );
}
