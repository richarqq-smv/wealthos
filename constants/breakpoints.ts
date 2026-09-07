/** Minimum window widths (px) for each layout tier — mobile stays the existing bottom-tab layout untouched. */
export const breakpoints = {
  mobile: 0,
  tablet: 700,
  desktop: 960,
  wideDesktop: 1280,
} as const;

export type LayoutTier = "mobile" | "tablet" | "desktop" | "wideDesktop";

export function tierForWidth(width: number): LayoutTier {
  if (width >= breakpoints.wideDesktop) return "wideDesktop";
  if (width >= breakpoints.desktop) return "desktop";
  if (width >= breakpoints.tablet) return "tablet";
  return "mobile";
}

/** Content max-width on wide layouts so text/cards/charts don't stretch edge-to-edge on a maximized window. */
export const contentMaxWidth = 1100;
