import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing } from "react-native";

/**
 * Splash entrance, about 0.8 s in total: logo scales in, wordmark rises, then a short progress bar fills.
 * With reduce motion everything is shown at once.
 */
export function useSplashAnimation(reduceMotion: boolean) {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.86)).current;
  const copyOpacity = useRef(new Animated.Value(0)).current;
  const copyTranslateY = useRef(new Animated.Value(10)).current;
  const loaderOpacity = useRef(new Animated.Value(0)).current;
  const loaderProgress = useRef(new Animated.Value(0)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion) {
      logoOpacity.setValue(1);
      logoScale.setValue(1);
      copyOpacity.setValue(1);
      copyTranslateY.setValue(0);
      loaderOpacity.setValue(1);
      loaderProgress.setValue(1);
      return;
    }

    const easeOut = Easing.out(Easing.cubic);
    const animations = Animated.parallel([
      Animated.timing(logoOpacity, { toValue: 1, duration: 260, easing: easeOut, useNativeDriver: true }),
      Animated.timing(logoScale, { toValue: 1, duration: 320, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(160),
        Animated.parallel([
          Animated.timing(copyOpacity, { toValue: 1, duration: 300, easing: easeOut, useNativeDriver: true }),
          Animated.timing(copyTranslateY, { toValue: 0, duration: 300, easing: easeOut, useNativeDriver: true }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(280),
        Animated.parallel([
          Animated.timing(loaderOpacity, { toValue: 1, duration: 160, easing: easeOut, useNativeDriver: true }),
          Animated.timing(loaderProgress, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        ]),
      ]),
    ]);
    animations.start();
    return () => animations.stop();
  }, [copyOpacity, copyTranslateY, loaderOpacity, loaderProgress, logoOpacity, logoScale, reduceMotion]);

  // Stable object: SplashScreen's navigation effect depends on it and must not restart on every render.
  return useMemo(() => {
    const fadeOut = (onComplete: () => void) => {
      Animated.timing(exitOpacity, {
        toValue: 0,
        duration: reduceMotion ? 80 : 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) onComplete();
      });
    };
    return { logoOpacity, logoScale, copyOpacity, copyTranslateY, loaderOpacity, loaderProgress, exitOpacity, fadeOut };
  }, [copyOpacity, copyTranslateY, exitOpacity, loaderOpacity, loaderProgress, logoOpacity, logoScale, reduceMotion]);
}
