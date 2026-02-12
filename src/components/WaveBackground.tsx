import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";

type WaveProps = {
  height?: number;
};

const WaveLayer = ({
  width,
  height,
  color,
  durationMs,
}: {
  width: number;
  height: number;
  color: string;
  durationMs: number;
}) => {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: durationMs,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [durationMs, progress]);

  // move full width for seamless loop
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -width],
  });

  const path = useMemo(() => {
    const mid = height * 0.55;
    const amp = height * 0.18;
    const half = width / 2;
    const c1x = half * 0.5;
    const c2x = half * 1.5;

    return `M0 ${mid}
      C ${c1x} ${mid - amp} ${c1x} ${mid + amp} ${half} ${mid}
      C ${c2x} ${mid - amp} ${c2x} ${mid + amp} ${width} ${mid}
      L ${width} ${height}
      L 0 ${height}
      Z`;
  }, [height, width]);

  return (
    <Animated.View
      style={[
        styles.layer,
        {
          width: width * 2,
          height,
          transform: [{ translateX }],
        },
      ]}
    >
      <Svg width={width * 2} height={height}>
        {/* first wave */}
        <Path d={path} fill={color} />

        {/* duplicate wave for seamless loop */}
        <Path d={path} fill={color} transform={`translate(${width},0)`} />
      </Svg>
    </Animated.View>
  );
};

export function WaveDivider({ height = 140 }: WaveProps) {
  const { width } = useWindowDimensions();

  if (!width) return null;

  const waveWidth = width;

  return (
    <View
      style={[
        styles.container,
        {
          height,
          // break parent horizontal padding automatically
          marginLeft: -width * 0.05,
          width: width * 1.1,
        },
      ]}
    >
      <WaveLayer
        width={waveWidth}
        height={height}
        color="rgba(40, 167, 164, 0.12)"
        durationMs={12000}
      />
      <WaveLayer
        width={waveWidth}
        height={height}
        color="rgba(35, 52, 70, 0.08)"
        durationMs={22000}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    justifyContent: "center",
  },
  layer: {
    position: "absolute",
    left: 0,
    top: 0,
  },
});

