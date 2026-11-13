import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { monologueDue, canOpenSignalDoor, SIGNAL_MONOLOGUE, signalMovement } from "./signal-flow";

describe("signal corridor", () => {
  it("allows a full 360-degree turn without changing the movement position", () => {
    for (const yaw of [0, Math.PI / 2, Math.PI, Math.PI * 1.5, Math.PI * 2, Math.PI * 4]) {
      assert.deepEqual(signalMovement(yaw, 0, 0, 1, 1), { x: 0, z: 0 });
    }
    const fullTurn = signalMovement(Math.PI * 2, 1, 0, 1, 1);
    assert.ok(Math.abs(fullTurn.x) < 1e-10);
    assert.equal(fullTurn.z, 1);
  });
  it("walks and sidesteps relative to the direction being viewed", () => {
    const reverse = signalMovement(Math.PI, 1, 0, 1, 1);
    assert.ok(Math.abs(reverse.x) < 1e-10);
    assert.equal(reverse.z, -1);
    const right = signalMovement(Math.PI / 2, 0, 1, 1, 1);
    assert.ok(Math.abs(right.x) < 1e-10);
    assert.equal(right.z, -1);
    assert.equal(signalMovement(Math.PI / 2, 1, 0, 1, 1).x, 1);
  });
  it("plays the three monologue beats in order as Tamara moves forward", () => {
    assert.equal(SIGNAL_MONOLOGUE.length, 3);
    assert.equal(monologueDue(0, 0), null);
    assert.equal(monologueDue(10, 0), 0);
    assert.equal(monologueDue(30, 0), 0); // never skips ahead
    assert.equal(monologueDue(30, 1), 1);
    assert.equal(monologueDue(50, 2), 2);
    assert.equal(monologueDue(59, 3), null);
  });
  it("the far door only opens at the end of the corridor", () => {
    assert.equal(canOpenSignalDoor(5), false);
    assert.equal(canOpenSignalDoor(56), true);
  });
});
