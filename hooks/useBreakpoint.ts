import { useWindowDimensions } from "react-native";
import { tierForWidth, type LayoutTier } from "@/constants/breakpoints";

interface Breakpoint {
  width: number;
  tier: LayoutTier;
  isDesktop: boolean;
}

/** Reacts to the Electron window being resized/maximized/fullscreened — `useWindowDimensions` updates on every resize event. */
export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  const tier = tierForWidth(width);
  return { width, tier, isDesktop: tier === "desktop" || tier === "wideDesktop" };
}
