export const CORRIDOR_LENGTH = 96;
export type TunnelDirection = "outbound" | "return";

export function tunnelStart(direction: TunnelDirection) {
  return direction === "return"
    ? { z: CORRIDOR_LENGTH - 4, yaw: Math.PI }
    : { z: 1.5, yaw: 0 };
}

export function reachesStoryEncounter(direction: TunnelDirection, z: number) {
  return direction === "return" ? z <= 1.8 : z > CORRIDOR_LENGTH - 7;
}

export const TRANSFORMED_REMAINS = [1, 2] as const;

export function isTransformedRemain(index: number) {
  return TRANSFORMED_REMAINS.some((i) => i === index);
}

export function advanceReturnGrowth(index: number, growth: number, hits: number, distance: number, dt: number) {
  return isTransformedRemain(index) && hits < 3 && distance < 10
    ? Math.min(1, growth + dt * 0.3)
    : growth;
}

export function eyeContainsCrosshair(eye: { x: number; y: number; r: number; depth: number }, x: number, y: number) {
  if (eye.depth <= 0.4 || eye.depth >= 10) return false;
  const rx = Math.max(3, eye.r * 1.25);
  const ry = Math.max(3, eye.r * 0.8);
  return ((eye.x - x) / rx) ** 2 + ((eye.y - y) / ry) ** 2 <= 1;
}

export function canShoot(direction: TunnelDirection) {
  return direction === "return";
}

export function doubleTapSprint(direction: TunnelDirection, previous: number, now: number, repeated: boolean) {
  return direction === "return" && !repeated && now > previous && now - previous <= 320;
}

export function walkSpeed(direction: TunnelDirection, sprint: boolean, forward: number, aiming: boolean) {
  return direction === "return" && sprint && forward > 0 && !aiming ? 4.8 : 2.7;
}