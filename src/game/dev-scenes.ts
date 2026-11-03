export const DEV_SCENES = ["praviglas", "comms", "divelog", "signal", "thebleed", "finale", "intro", "airlock", "dive", "husk", "chase", "return", "morgue", "credits"] as const;
export type DevScene = typeof DEV_SCENES[number];
export function validateDevScene(value: unknown): DevScene | undefined {
  return typeof value === "string" ? DEV_SCENES.find(scene => scene === value) : undefined;
}
export function devSceneTarget(scene?: DevScene) {
  if (!scene) return "title";
  if (scene === "praviglas" || scene === "comms" || scene === "divelog") return "pravi-glas";
  if (scene === "signal" || scene === "thebleed" || scene === "finale") return "dev-unbuilt";
  return scene;
}