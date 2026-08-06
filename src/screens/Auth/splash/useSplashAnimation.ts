import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";

export function useSplashAnimation(reduceMotion: boolean) {
  const backgroundOpacity = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoEntranceScale = useRef(new Animated.Value(0.75)).current;
  const logoBreathScale = useRef(new Animated.Value(1)).current;
  const logoTranslateY = useRef(new Animated.Value(0)).current;
  const copyOpacity = useRef(new Animated.Value(0)).current;
  const copyTranslateY = useRef(new Animated.Value(14)).current;
  const loaderOpacity = useRef(new Animated.Value(0)).current;
  const loaderProgress = useRef(new Animated.Value(0)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion) {
      backgroundOpacity.setValue(1);
      logoOpacity.setValue(1);
      logoEntranceScale.setValue(1);
      copyOpacity.setValue(1);
      copyTranslateY.setValue(0);
      loaderOpacity.setValue(1);
      loaderProgress.setValue(1);
      return;
    }

    const easeOut = Easing.out(Easing.cubic);
    const animations = Animated.parallel([
      Animated.timing(backgroundOpacity, { toValue: 1, duration: 400, easing: easeOut, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 400, easing: easeOut, useNativeDriver: true }),
        Animated.timing(logoEntranceScale, { toValue: 1, duration: 400, easing: easeOut, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(logoTranslateY, { toValue: -10, duration: 400, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(logoTranslateY, { toValue: -8, duration: 400, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(logoBreathScale, { toValue: 1.03, duration: 400, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(logoBreathScale, { toValue: 1, duration: 400, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(1200),
        Animated.parallel([
          Animated.timing(copyOpacity, { toValue: 1, duration: 420, easing: easeOut, useNativeDriver: true }),
          Animated.timing(copyTranslateY, { toValue: 0, duration: 420, easing: easeOut, useNativeDriver: true }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(1800),
        Animated.parallel([
          Animated.timing(loaderOpacity, { toValue: 1, duration: 220, easing: easeOut, useNativeDriver: true }),
          Animated.timing(loaderProgress, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        ]),
      ]),
    ]);
    animations.start();
    return () => animations.stop();
  }, [backgroundOpacity, copyOpacity, copyTranslateY, loaderOpacity, loaderProgress, logoBreathScale, logoEntranceScale, logoOpacity, logoTranslateY, reduceMotion]);

  const fadeOut = (onComplete: () => void) => {
    Animated.timing(exitOpacity, {
      toValue: 0,
      duration: reduceMotion ? 100 : 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onComplete();
    });
  };

  return { backgroundOpacity, logoOpacity, logoEntranceScale, logoBreathScale, logoTranslateY, copyOpacity, copyTranslateY, loaderOpacity, loaderProgress, exitOpacity, fadeOut };
}
