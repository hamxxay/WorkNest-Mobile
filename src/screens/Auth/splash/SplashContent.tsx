import { Animated, Image, View } from "react-native";
import type { useSplashAnimation } from "./useSplashAnimation";
import type { SplashStyles } from "./styles";

type SplashAnimation = ReturnType<typeof useSplashAnimation>;

export function SplashContent({ animation, styles }: { animation: SplashAnimation; styles: SplashStyles }) {
  return (
    <Animated.View
      accessible
      accessibilityLabel="WorkNest. Find your ideal workspace. Loading"
      accessibilityRole="progressbar"
      style={[styles.container, { opacity: animation.exitOpacity }]}
    >
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <Animated.View
        style={[styles.brandBlock, { opacity: animation.logoOpacity, transform: [{ scale: animation.logoScale }] }]}
      >
        <View style={styles.logoTile}>
          <Image source={require("../../../../public/Logo1.png")} style={styles.logo} resizeMode="contain" />
        </View>
      </Animated.View>

      <Animated.View
        style={[styles.copyBlock, { opacity: animation.copyOpacity, transform: [{ translateY: animation.copyTranslateY }] }]}
      >
        <Animated.Text style={styles.wordmark}>WorkNest</Animated.Text>
        <Animated.Text style={styles.tagline}>Find your ideal workspace</Animated.Text>
      </Animated.View>

      <Animated.View style={[styles.loaderWrap, { opacity: animation.loaderOpacity }]}>
        <View style={styles.loaderTrack}>
          <Animated.View style={[styles.loaderFill, { transform: [{ scaleX: animation.loaderProgress }] }]} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}
