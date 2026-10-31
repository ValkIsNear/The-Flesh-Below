import { describe, it as test } from "node:test";
import { strict as assert } from "node:assert";
import { CORRIDOR_LENGTH, reachesStoryEncounter, tunnelStart } from "./tunnel-flow";

describe("return after the three tumors", () => {
  test("starts at the opposite end facing back down the original corridor", () => {
    const start = tunnelStart("return");
    assert.equal(start.z, CORRIDOR_LENGTH - 4);
    assert.equal(start.yaw, Math.PI);
    assert.equal(Math.cos(start.yaw), -1);
  });
  test("does not replay the encounter or end the return walk", () => {
    assert.equal(reachesStoryEncounter("return", 92), false);
    assert.equal(reachesStoryEncounter("return", 0.7), false);
    assert.equal(reachesStoryEncounter("outbound", 92), true);
  });
});