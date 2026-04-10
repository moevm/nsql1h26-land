const MOTION_DURATION_MS = 360;
export const MOTION_DURATION_S = MOTION_DURATION_MS / 1000;

// Smooth ease-out curve reused across Framer Motion transitions.
const MOTION_EASE = [0.22, 1, 0.36, 1] as const;

export const MOTION_TRANSITION = {
  duration: MOTION_DURATION_S,
  ease: MOTION_EASE,
} as const;
