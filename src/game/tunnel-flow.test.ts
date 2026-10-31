import { describe, it as test } from "node:test";
import { strict as assert } from "node:assert";
import { CORRIDOR_LENGTH, reachesStoryEncounter, tunnelStart, canShoot, doubleTapSprint, walkSpeed, TRANSFORMED_REMAINS } from "./tunnel-flow";

describe("return after the three tumors", () => {
  test("starts at the opposite end facing back down the original corridor", () => {
    const start = tunnelStart("return");
    assert.equal(start.z, CORRIDOR_LENGTH - 4);
    assert.equal(start.yaw, Math.PI);
    assert.equal(Math.cos(start.yaw), -1);
  });
  test("return exit starts the morgue without replaying the far-end encounter", () => {
    assert.equal(reachesStoryEncounter("return", 92), false);
    assert.equal(reachesStoryEncounter("return", 0.7), true);
    assert.equal(reachesStoryEncounter("return", 2), false);
    assert.equal(reachesStoryEncounter("outbound", 92), true);
  });
  test("double W enables sprint only on the final visit, not key repeat or a single press", () => {
    assert.equal(doubleTapSprint("return", 1000, 1200, false), true);
    assert.equal(doubleTapSprint("outbound", 1000, 1200, false), false);
    assert.equal(doubleTapSprint("return", 1000, 1400, false), false);
    assert.equal(doubleTapSprint("return", 1000, 1200, true), false);
    assert.equal(walkSpeed("return", true, 1, false), 4.8);
    assert.equal(walkSpeed("return", true, 1, true), 2.7);
    assert.equal(walkSpeed("outbound", true, 1, false), 2.7);
  });
  test("shooting is enabled only on the return visit", () => {
    assert.equal(canShoot("return"), true);
    assert.equal(canShoot("outbound"), false);
  });
  test("exactly two remains transform", () => {
    assert.deepEqual([...TRANSFORMED_REMAINS], [1, 2]);
    assert.equal(new Set(TRANSFORMED_REMAINS).size, 2);
  });
});