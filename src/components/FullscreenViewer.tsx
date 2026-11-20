import { AnimatePresence, motion } from 'motion/react';
import React, { useEffect, useMemo } from 'react';
import { getAstrolabeSpec } from '../engine/generator';
import { hapticExpand } from '../engine/haptics';
import { animationScheduler } from '../engine/scheduler';
import { AstrolabeCanvas } from './AstrolabeCanvas';

interface FullscreenViewerProps {
  activeItem: { seed: number; phaseTime: number } | null;
  isInverted: boolean;
  isResonated: boolean;
  onDismiss: () => void;
}

export const FullscreenViewer: React.FC<FullscreenViewerProps> = ({
  activeItem,
  isInverted,
  isResonated,
  onDismiss,
}) => {
  const spec = useMemo(
    () => (activeItem ? getAstrolabeSpec(activeItem.seed) : null),
    [activeItem],
  );

  // Pause background feed animations while fullscreen is open and lock body scroll
  useEffect(() => {
    if (!activeItem) {
      animationScheduler.setFeedPaused(false);
      return;
    }

    animationScheduler.setFeedPaused(true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        hapticExpand();
        onDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      animationScheduler.setFeedPaused(false);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeItem, onDismiss]);

  const handleDismiss = () => {
    hapticExpand();
    onDismiss();
  };

  return (
    <AnimatePresence>
      {activeItem && spec && (
        <motion.div
          key={activeItem.seed}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          onClick={handleDismiss}
          role="dialog"
          aria-modal="true"
          aria-label="Full-screen geometric animation"
          className="fixed inset-0 z-50 bg-[#020306] flex items-center justify-center cursor-pointer select-none touch-none"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0.4 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.93, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            className="w-full h-full"
          >
            <AstrolabeCanvas
              spec={spec}
              isVisible={true}
              isInverted={isInverted}
              isResonated={isResonated}
              pulseToken={0}
              rareArrivalToken={0}
              isFullscreen={true}
              initialPhaseTime={activeItem.phaseTime}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
