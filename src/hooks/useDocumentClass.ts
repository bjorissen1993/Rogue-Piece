import { useEffect } from "react";

/**
 * Toggle a class on <html> while a blocking UI layer is open.
 * Used to pause background mood/faction animations under overlays.
 */
export function useDocumentClass(className: string, active: boolean): void {
  useEffect(() => {
    if (!active) {
      return;
    }
    const root = document.documentElement;
    root.classList.add(className);
    return () => {
      root.classList.remove(className);
    };
  }, [className, active]);
}
