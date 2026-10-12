// The phone's "Remove animations" / "Reduce motion" setting. One implementation for the whole app: the motion
// kit's shared store (src/components/motion/useReduceMotion.ts), re-exported here for the navigators and TabBar.
export { useReduceMotion } from "../components/motion/useReduceMotion";
