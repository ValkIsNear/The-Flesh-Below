import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { confessionBranch, RECEPTION, COMMS_END, COMMS_CHOICES, recordPraviGlas, deathLogSlot, canUseComms, postMorgueState } from "./pravi-glas-flow";
describe("Pravi glas canon", () => {
  it("test entry restores completed morgue and credits without pre-completing the new conversation", () => {
    const state = postMorgueState(new Date("2026-11-02T20:46:00Z"));
    assert.equal(state.morgueCompleted, true);
    assert.equal(state.creditsCompleted, true);
    assert.deepEqual(state.entries.map(e => e.id), ["morgue"]);
    assert.equal(deathLogSlot().date, "NOW");
  });
  for (const choice of ["already", "forgot", "log"] as const) {
    it(`${choice} runs its own branch then converges before the wires and final echo`, () => {
      const beats = [...RECEPTION, ...confessionBranch(choice)];
      const ids = beats.map(b => b.id);
      assert.equal(beats.filter(b => b.id === choice).length, 1);
      assert.deepEqual(confessionBranch(choice).slice(-COMMS_END.length), COMMS_END);
      const order = ["reception", "identification", choice, "convergence", "wires", "promise", "echo", "cold-water"];
      for (let i = 1; i < order.length; i++) assert.ok(ids.indexOf(order[i]) > ids.indexOf(order[i - 1]));
      assert.equal(beats.filter(b => b.echo).length, 1);
      assert.equal(beats.filter(b => b.id === "convergence").length, 1);
    });
  }
  it("offers three distinct cracks without leaking the other branches", () => {
    assert.deepEqual(COMMS_CHOICES.map(c => c.id), ["already", "forgot", "log"]);
    assert.equal(confessionBranch("already").some(b => b.id === "eleven"), true);
    assert.equal(confessionBranch("forgot").some(b => b.id === "first-time"), true);
    assert.equal(confessionBranch("log").some(b => b.id === "wrong"), true);
    assert.equal(confessionBranch("forgot").some(b => b.id === "eleven"), false);
    assert.equal(confessionBranch("already").some(b => b.id === "first-time"), false);
    assert.equal(confessionBranch("log").some(b => b.id === "eleven"), false);
  });
  it("records a real date while the death slot always remains NOW", () => {
    const entries = recordPraviGlas([], new Date("2026-11-02T20:46:00Z"));
    assert.equal(entries[0].date, "2026-11-02T20:46:00.000Z");
    assert.equal(deathLogSlot().date, "NOW");
    assert.equal(recordPraviGlas(entries, new Date("2026-11-03T00:00:00Z")).length, 1);
    assert.equal(deathLogSlot().date, "NOW");
  });
  it("requires walking up to the comms terminal before starting", () => {
    assert.equal(canUseComms(0.7), false);
    assert.equal(canUseComms(11), false);
    assert.equal(canUseComms(12), true);
  });
});