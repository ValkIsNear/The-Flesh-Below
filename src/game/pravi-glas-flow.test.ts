import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { confessionBranch, RECEPTION, CONFESSION, ADVICE, recordPraviGlas, deathLogSlot, canUseComms, postMorgueState } from "./pravi-glas-flow";
describe("Pravi glas canon", () => {
  it("test entry restores completed morgue and credits without pre-completing the new conversation", () => {
    const state = postMorgueState(new Date("2026-11-02T20:46:00Z"));
    assert.equal(state.morgueCompleted, true);
    assert.equal(state.creditsCompleted, true);
    assert.deepEqual(state.entries.map(e => e.id), ["morgue"]);
    assert.equal(deathLogSlot().date, "NOW");
  });
  for (const choice of ["direct", "present", "deflect"] as const) {
    it(`${choice} converges to the same unavoidable confession and ordered beats`, () => {
      const beats = [...RECEPTION, ...confessionBranch(choice)];
      const ids = beats.map(b => b.id);
      assert.equal(beats.filter(b => b.id === "confession").length, 1);
      assert.equal(beats.find(b => b.id === "confession")?.text, CONFESSION);
      const order = ["reception", "confession", "advice", "echo", "deflection"];
      for (let i = 1; i < order.length; i++) assert.ok(ids.indexOf(order[i]) > ids.indexOf(order[i - 1]));
      assert.equal(beats.filter(b => b.echo).length, 1);
      assert.equal(beats.find(b => b.id === "advice")?.text, ADVICE);
    });
  }
  it("present tense alone triggers the silence and correction before confession", () => {
    assert.deepEqual(confessionBranch("present").slice(0, 4).map(b => b.id), ["present", "silence", "correction", "confession"]);
    for (const c of ["direct", "deflect"] as const) assert.equal(confessionBranch(c).some(b => b.id === "correction"), false);
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