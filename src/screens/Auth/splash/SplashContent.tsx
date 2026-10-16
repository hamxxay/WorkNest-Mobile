import { Animated, View, useWindowDimensions } from "react-native";
import { BrandLogo } from "../../../components/ui/BrandLogo";
import type { useSplashAnimation } from "./useSplashAnimation";
import { SPLASH_LOGO_WIDTH, type SplashStyles } from "./styles";

type SplashAnimation = ReturnType<typeof useSplashAnimation>;

/** Below this window height (a phone in landscape) the progress bar sits closer to the bottom edge. */
const SHORT_WINDOW = 520;

export function SplashContent({ animation, styles }: { animation: SplashAnimation; styles: SplashStyles }) {
  const { height } = useWindowDimensions();
  const short = height < SHORT_WINDOW;
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
        <BrandLogo size={SPLASH_LOGO_WIDTH} accessible={false} />
      </Animated.View>

      <Animated.View
        style={[styles.copyBlock, { opacity: animation.copyOpacity, transform: [{ translateY: animation.copyTranslateY }] }]}
      >
        {/* Brand lettering, capped so the largest system text still leaves room for the logo and progress bar. */}
        <Animated.Text style={styles.wordmark} maxFontSizeMultiplier={1.4}>
          WorkNest
        </Animated.Text>
        <Animated.Text style={styles.tagline} maxFontSizeMultiplier={1.6}>
          Find your ideal workspace
        </Animated.Text>
      </Animated.View>

      <Animated.View style={[styles.loaderWrap, short && styles.loaderWrapShort, { opacity: animation.loaderOpacity }]}>
        <View style={styles.loaderTrack}>
          <Animated.View style={[styles.loaderFill, { transform: [{ scaleX: animation.loaderProgress }] }]} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}
