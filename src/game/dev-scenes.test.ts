import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { validateDevScene, devSceneTarget, DEV_SCENES } from "./dev-scenes";
import { postMorgueState } from "./pravi-glas-flow";

describe("invisible developer scene entries", () => {
  it("normal play starts at the title and invalid entries are ignored", () => {
    assert.equal(devSceneTarget(validateDevScene(undefined)), "title");
    assert.equal(validateDevScene("invalid"), undefined);
  });
  it("comms and divelog reuse the actual post-credits scene", () => {
    assert.equal(devSceneTarget(validateDevScene("comms")), "pravi-glas");
    assert.equal(devSceneTarget(validateDevScene("divelog")), "pravi-glas");
    assert.equal(devSceneTarget(validateDevScene("praviglas")), "pravi-glas");
  });
  it("unbuilt narrative scenes are never redirected into unrelated story", () => {
    for (const scene of ["signal", "thebleed", "finale"] as const) assert.equal(devSceneTarget(scene), "dev-unbuilt");
  });
  it("every accepted developer entry uses completed morgue and credits state", () => {
    for (const scene of DEV_SCENES) {
      assert.equal(validateDevScene(scene), scene);
      const state = postMorgueState(new Date("2026-11-03T18:56:00Z"));
      assert.equal(state.morgueCompleted, true);
      assert.equal(state.creditsCompleted, true);
      assert.deepEqual(state.entries.map(entry => entry.id), ["morgue"]);
    }
  });
});