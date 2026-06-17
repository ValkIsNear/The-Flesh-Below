import { createFileRoute } from "@tanstack/react-router";
import Game from "@/game/Game";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SY: The Heavy — a short pixel dive" },
      {
        name: "description",
        content:
          "A short pixel-art narrative game inspired by Signalis. Dive into The Sub-Strata as Tamara, Asset #77-T. Eight hundred atmospheres of grief.",
      },
      { property: "og:title", content: "SY: The Heavy" },
      {
        property: "og:description",
        content: "A short pixel-art dive into the abyss. Inspired by Signalis. Serbian whispers, eight hundred atmospheres, one lost name.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return <Game />;
}
