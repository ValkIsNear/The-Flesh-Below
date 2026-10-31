import { describe, expect, test } from "bun:test";
import { CORRIDOR_LENGTH, reachesStoryEncounter, tunnelStart } from "./tunnel-flow";

describe("return after the three tumors", () => {
  test("starts at the opposite end facing back down the original corridor", () => {
    const start = tunnelStart("return");
    expect(start.z).toBe(CORRIDOR_LENGTH - 4);
    expect(start.yaw).toBe(Math.PI);
    expect(Math.cos(start.yaw)).toBe(-1);
  });
  test("does not replay the encounter or end the return walk", () => {
    expect(reachesStoryEncounter("return", 92)).toBe(false);
    expect(reachesStoryEncounter("return", 0.7)).toBe(false);
    expect(reachesStoryEncounter("outbound", 92)).toBe(true);
  });
});