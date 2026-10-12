import { useContext, useEffect, useState } from "react";
import { StatusBar, type StatusBarProps } from "react-native";
import { NavigationContext } from "@react-navigation/native";

/**
 * StatusBar that only applies while its screen is focused. Tab screens stay mounted after you leave them, so a
 * plain <StatusBar/> in an unfocused tab would keep overriding the visible screen. Outside a navigator it behaves
 * like a normal <StatusBar/>.
 */
export function FocusAwareStatusBar(props: StatusBarProps) {
  const navigation = useContext(NavigationContext);
  const [focused, setFocused] = useState(() => navigation?.isFocused() ?? true);

  useEffect(() => {
    if (!navigation) return undefined;
    setFocused(navigation.isFocused());
    const offFocus = navigation.addListener("focus", () => setFocused(true));
    const offBlur = navigation.addListener("blur", () => setFocused(false));
    return () => {
      offFocus();
      offBlur();
    };
  }, [navigation]);

  return focused ? <StatusBar animated {...props} /> : null;
}

/** "light-content" for dark backgrounds, "dark-content" for light ones. Accepts #rgb / #rrggbb. */
export function barStyleFor(background: string): "light-content" | "dark-content" {
  const hex = background.trim().replace("#", "");
  const full = hex.length === 3 ? hex.split("").map(c => c + c).join("") : hex.slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(full)) return "dark-content";
  const [r, g, b] = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255);
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance < 0.4 ? "light-content" : "dark-content";
}
