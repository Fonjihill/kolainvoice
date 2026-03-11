import { useEffect, useRef } from "react";

/**
 * Tracks whether a form has unsaved changes.
 *
 * Usage:
 *   const { markDirty, markClean, isDirty } = useUnsavedGuard();
 *   // On field change: markDirty()
 *   // On save: markClean()
 *   // On back/navigate: if (isDirty()) showConfirmModal()
 */
export function useUnsavedGuard() {
  const dirty = useRef(false);

  function markDirty() {
    dirty.current = true;
  }

  function markClean() {
    dirty.current = false;
  }

  // Warn on window close/reload
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty.current) {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  return { markDirty, markClean, isDirty: () => dirty.current };
}
