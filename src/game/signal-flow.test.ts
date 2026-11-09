import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { monologueDue, canOpenSignalDoor, SIGNAL_MONOLOGUE } from "./signal-flow";

describe("signal corridor", () => {
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
