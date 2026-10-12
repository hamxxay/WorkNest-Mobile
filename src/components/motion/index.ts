/**
 * Motion helpers shared by the UI kit. Every one of them honours the OS "reduce motion" setting.
 * Guide: ../ui/docs/motion-and-haptics.md
 */
export { useReduceMotion, isReduceMotionEnabled } from "./useReduceMotion";
export { ScalePressable, PRESS_SCALE, PRESS_SCALE_LARGE, type ScalePressableProps } from "./ScalePressable";
