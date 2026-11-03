export type ConfessionChoice = "direct" | "present" | "deflect";
export type RadioBeat = { id: string; speaker?: "FRIEND" | "T-77" | "CHANNEL 02"; text: string; pause?: number; echo?: boolean };
export const CONFESSION = "She died when the suit failed. The visor shattered. The pressure got in.";
export const ADVICE = "You have to let go of the people from the past to survive.";
export const RECEPTION: RadioBeat[] = [
  { id: "reception", speaker: "FRIEND", text: "T-77… do you read me? How was the dive?", pause: 1100 },
  { id: "reply", speaker: "T-77", text: "I'm back." },
  { id: "reception-end", speaker: "FRIEND", text: "Good. I'm here. Signal is breaking up… stand by.", pause: 850 },
  { id: "inner", text: "A breath arrives twice. The second half of his sentence is missing. I wait for it." },
];
export function confessionBranch(choice: ConfessionChoice): RadioBeat[] {
  const opening: RadioBeat[] = choice === "present" ? [
    { id: "present", speaker: "T-77", text: "She's with me. Can't you hear her?" },
    { id: "silence", text: "The carrier stays open. No breathing. Then a small click.", pause: 2300 },
    { id: "correction", speaker: "FRIEND", text: "Tamara… She's not on the channel. Nobody is on the channel.", pause: 800 },
  ] : choice === "deflect" ? [
    { id: "deflect-attempt", speaker: "T-77", text: "Can we just check the signal?" },
    { id: "involuntary", text: "I mean to ask about the signal. My mouth keeps moving." },
  ] : [{ id: "direct", speaker: "T-77", text: "I need to say something." }];
  return [...opening,
    { id: "confession", speaker: "T-77", text: CONFESSION },
    { id: "weight", text: "Said aloud, it has nowhere to go. It stays between my teeth." },
    { id: "advice", speaker: "FRIEND", text: ADVICE, pause: 700 },
    { id: "echo", speaker: "CHANNEL 02", text: "Come home.", echo: true, pause: 600 },
    { id: "deflection", speaker: "T-77", text: "What's the signal like in the lower sector?" },
    { id: "work", speaker: "FRIEND", text: "Weak. I have to stay at the relay. If I drop the link, we lose the channel.", pause: 900 },
    { id: "promise", speaker: "T-77", text: "One more dive. Then I'll come back." },
    { id: "exit", speaker: "FRIEND", text: "Respond. When you get there. I need to get back to the signal.", pause: 900 },
    { id: "unresolved", text: "The relay clicks back into its rhythm. I keep my hand on the switch a little longer." },
  ];
}
export type DiveLogEntry = { id: string; date: string; record: string };
export function recordPraviGlas(entries: DiveLogEntry[], at: Date): DiveLogEntry[] {
  return [...entries.filter(e => e.id !== "pravi-glas"), { id: "pravi-glas", date: at.toISOString(), record: "T-77 · A Real Voice · Shared channel. Transmission closed. One more dive." }];
}
export function deathLogSlot() { return { id: "death", date: "NOW", record: "She · death", corrupted: true }; }
export function canUseComms(z: number) { return z >= 11.5; }
export function postMorgueState(at: Date) {
  return { morgueCompleted: true, creditsCompleted: true, entries: [{ id: "morgue", date: at.toISOString(), record: "T-77 · Morgue · Identification: Unknown." }] satisfies DiveLogEntry[] };
}