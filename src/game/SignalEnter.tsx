import { useEffect, useState } from "react";
import { clang, metalGroan, radioCarrier } from "./audio";

const LINES = ["The hatch gives under my hands.", "Cold water finds the seams of the suit.", "His signal is somewhere down there. I go after it."];

export default function SignalEnter({ onDone }: { onDone: () => void }) {
  const [shown, setShown] = useState(-1);
  useEffect(() => {
    const t: number[] = [];
    const at = (ms: number, f: () => void) => t.push(window.setTimeout(f, ms));
    at(300, () => radioCarrier(1.2));
    at(1200, () => { clang("hydraulic"); setShown(0); });
    at(1700, () => clang("hydraulic"));
    at(2600, () => metalGroan());
    at(3200, () => setShown(1));
    [3400, 4000, 4600, 5200, 5800].forEach((ms) => at(ms, () => clang("step")));
    at(5600, () => setShown(2));
    at(8200, onDone);
    return () => t.forEach(clearTimeout);
  }, [onDone]);
  return <div className="sy-screen" style={{ background: "#000", flexDirection: "column", gap: 14, animation: "sy-fadein 1s ease" }}>
    {LINES.map((l, i) => <div key={l} style={{ fontFamily: "Georgia, serif", fontStyle: "italic", color: "#8a7a6a", opacity: shown >= i ? 1 : 0, transition: "opacity 1.2s" }}>{l}</div>)}
    <style>{`@keyframes sy-fadein { from { opacity: 0 } to { opacity: 1 } }`}</style>
  </div>;
}
