import { createFileRoute } from "@tanstack/react-router";
import { validateDevScene, type DevScene } from "@/game/dev-scenes";
import Game from "@/game/Game";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { scene?: DevScene } => ({ scene: validateDevScene(search.scene) }),
  head: () => ({
    meta: [
      { title: "Flesh Below: The Heavy — a short pixel dive" },
      {
        name: "description",
        content:
          "A short pixel-art narrative game inspired by Signalis. Dive into The Sub-Strata as Tamara, Asset #77-T. Eight hundred atmospheres of grief.",
      },
      { property: "og:title", content: "Flesh Below: The Heavy" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content: "A short pixel-art dive into the abyss. Inspired by Signalis. Distorted transmissions, eight hundred atmospheres, one lost name.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { scene } = Route.useSearch();
  return <Game devScene={scene} />;
}
