import { Animated, Image, Text, View } from "react-native";
import type { useSplashAnimation } from "./useSplashAnimation";
import type { SplashStyles } from "./styles";

type SplashAnimation = ReturnType<typeof useSplashAnimation>;

export function SplashContent({ animation, styles }: { animation: SplashAnimation; styles: SplashStyles }) {
  const logoTransform = [{ translateY: animation.logoTranslateY }, { scale: Animated.multiply(animation.logoEntranceScale, animation.logoBreathScale) }];
  return <Animated.View style={[styles.container, { opacity: animation.exitOpacity }]}>
    <Animated.View style={[styles.background, { opacity: animation.backgroundOpacity }]}>
      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />
    </Animated.View>
    <Animated.View style={[styles.brandBlock, { opacity: animation.logoOpacity, transform: logoTransform }]}>
      <View style={styles.logoWell}><View style={styles.logoGlow} /><Image source={require("../../../../public/Logo.png")} style={styles.logo} resizeMode="contain" accessibilityLabel="WorkNest" /></View>
    </Animated.View>
    <Animated.View style={[styles.copyBlock, { opacity: animation.copyOpacity, transform: [{ translateY: animation.copyTranslateY }] }]}>
      <Text style={styles.brand}>WORKNEST</Text>
      <Text style={styles.subtitle}>Find Your Ideal Workspace</Text>
    </Animated.View>
    <Animated.View accessibilityLabel="Loading WorkNest" style={[styles.loaderWrap, { opacity: animation.loaderOpacity }]}>
      <View style={styles.loaderTrack}><Animated.View style={[styles.loaderFill, { transform: [{ scaleX: animation.loaderProgress }] }]} /></View>
    </Animated.View>
  </Animated.View>;
}
