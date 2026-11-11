import React, { useState, useEffect } from 'react';
import { ChevronUp } from 'lucide-react';

interface BackToTopButtonProps {
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
}

export const BackToTopButton: React.FC<BackToTopButtonProps> = ({ scrollContainerRef }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const checkScroll = () => {
      let scrollY = window.scrollY || document.documentElement.scrollTop || 0;
      if (scrollContainerRef?.current) {
        scrollY = Math.max(scrollY, scrollContainerRef.current.scrollTop || 0);
      }
      // Show when scrolled down more than 200px
      setIsVisible(scrollY > 200);
    };

    const container = scrollContainerRef?.current;
    if (container) {
      container.addEventListener('scroll', checkScroll, { passive: true });
    }
    window.addEventListener('scroll', checkScroll, { passive: true });

    // Initial check
    checkScroll();

    return () => {
      if (container) {
        container.removeEventListener('scroll', checkScroll);
      }
      window.removeEventListener('scroll', checkScroll);
    };
  }, [scrollContainerRef]);

  const scrollToTop = () => {
    if (scrollContainerRef?.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!isVisible) return null;

  return (
    <button
      id="btn-back-to-top"
      type="button"
      onClick={scrollToTop}
      aria-label="Scroll back to top"
      title="Back to Top"
      className="print:hidden sm:hidden fixed bottom-16 right-4 z-50 p-3 rounded-full bg-blue-700 hover:bg-blue-800 text-white shadow-xl shadow-blue-900/30 dark:bg-blue-600 dark:hover:bg-blue-500 border border-blue-400/40 hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center cursor-pointer focus:outline-none focus:ring-4 focus:ring-blue-400/50"
    >
      <ChevronUp className="w-5 h-5 stroke-[2.5]" />
    </button>
  );
};
