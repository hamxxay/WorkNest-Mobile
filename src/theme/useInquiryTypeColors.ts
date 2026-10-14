import { useCallback } from "react";
import { useTheme } from "./ThemeProvider";
import { inquiryTypeColor, type InquiryType } from "./inquiryTypes";

/** Inquiry Type colours for the active light / dark theme: `const colorOf = useInquiryTypeColors(); colorOf("WalkIn")`. */
export function useInquiryTypeColors(): (type: InquiryType | null | undefined) => string {
  const { isDark } = useTheme();
  return useCallback((type: InquiryType | null | undefined) => inquiryTypeColor(type, isDark), [isDark]);
}
