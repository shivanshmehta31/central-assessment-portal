'use client';

import { useCallback, useEffect, useRef } from 'react';

type ViolationType =
  | 'TAB_SWITCH'
  | 'WINDOW_BLUR'
  | 'FULLSCREEN_EXIT'
  | 'PAGE_REFRESH'
  | 'NAVIGATION_ATTEMPT'
  | 'COPY_PASTE'
  | 'DEVTOOLS_OPENED'
  | 'OTHER';

interface Options {
  enabled: boolean;
  requireFullscreen: boolean;
  onViolation: (type: ViolationType) => void;
}

// Realistic scope: a browser cannot fully prevent switching devices, apps, or
// taking screenshots — this only detects what the Page Visibility, focus, and
// Fullscreen APIs can observe within this tab.
export function useIntegrityMonitor({ enabled, requireFullscreen, onViolation }: Options) {
  const onViolationRef = useRef(onViolation);
  onViolationRef.current = onViolation;

  const enterFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Some browsers block programmatic fullscreen without a fresh user gesture — safe to ignore.
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleVisibility = () => {
      if (document.hidden) onViolationRef.current('TAB_SWITCH');
    };
    const handleBlur = () => onViolationRef.current('WINDOW_BLUR');
    const handleFullscreenChange = () => {
      if (requireFullscreen && !document.fullscreenElement) onViolationRef.current('FULLSCREEN_EXIT');
    };
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      onViolationRef.current('PAGE_REFRESH');
      e.preventDefault();
      e.returnValue = '';
    };
    const handlePopState = () => {
      onViolationRef.current('NAVIGATION_ATTEMPT');
      history.pushState(null, '', window.location.href);
    };
    const handleCopyPasteBlock = (e: ClipboardEvent) => {
      e.preventDefault();
      onViolationRef.current('COPY_PASTE');
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    document.addEventListener('copy', handleCopyPasteBlock);
    document.addEventListener('paste', handleCopyPasteBlock);

    history.pushState(null, '', window.location.href);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('copy', handleCopyPasteBlock);
      document.removeEventListener('paste', handleCopyPasteBlock);
    };
  }, [enabled, requireFullscreen]);

  return { enterFullscreen };
}
