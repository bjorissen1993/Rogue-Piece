import { useEffect, useState } from "react";

/** True when viewport matches the query (client-only; false during SSR/first paint). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** Phone portrait / compact layout — keep in sync with CSS `@media (max-width: 767px)`. */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}
