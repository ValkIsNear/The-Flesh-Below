export const CORRIDOR_LENGTH = 96;
export type TunnelDirection = "outbound" | "return";

export function tunnelStart(direction: TunnelDirection) {
  return direction === "return"
    ? { z: CORRIDOR_LENGTH - 4, yaw: Math.PI }
    : { z: 1.5, yaw: 0 };
}

export function reachesStoryEncounter(direction: TunnelDirection, z: number) {
  return direction === "outbound" && z > CORRIDOR_LENGTH - 7;
}