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

export function canShoot(direction: TunnelDirection) {
  return direction === "return";
}

export function doubleTapSprint(direction: TunnelDirection, previous: number, now: number, repeated: boolean) {
  return direction === "return" && !repeated && now > previous && now - previous <= 320;
}

export function walkSpeed(direction: TunnelDirection, sprint: boolean, forward: number, aiming: boolean) {
  return direction === "return" && sprint && forward > 0 && !aiming ? 4.8 : 2.7;
}