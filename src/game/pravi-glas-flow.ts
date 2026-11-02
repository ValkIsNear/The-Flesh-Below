export type ConfessionChoice = "direct" | "present" | "deflect";
export type RadioBeat = { id: string; speaker?: "PRIJATELJ" | "T-77" | "KANAL 02"; text: string; pause?: number; echo?: boolean };
export const CONFESSION = "Ona je umrla kad je odelo popustilo. Vizir se razbio. Pritisak je ušao unutra.";
export const ADVICE = "Moraš da pustiš ljude iz prošlosti da bi preživela.";
export const RECEPTION: RadioBeat[] = [
  { id: "reception", speaker: "PRIJATELJ", text: "T-77… čuješ li me? Kako je prošao zaron?", pause: 1100 },
  { id: "reply", speaker: "T-77", text: "Vratila sam se." },
  { id: "reception-end", speaker: "PRIJATELJ", text: "Dobro. Tu sam. Veza prekida… sačekaj.", pause: 850 },
  { id: "inner", text: "A breath arrives twice. The second half of his sentence is missing. I wait for it." },
];
export function confessionBranch(choice: ConfessionChoice): RadioBeat[] {
  const opening: RadioBeat[] = choice === "present" ? [
    { id: "present", speaker: "T-77", text: "Ona je sa mnom. Zar je ne čuješ?" },
    { id: "silence", text: "The carrier stays open. No breathing. Then a small click.", pause: 2300 },
    { id: "correction", speaker: "PRIJATELJ", text: "Tamara… Nije na kanalu. Niko nije na kanalu.", pause: 800 },
  ] : choice === "deflect" ? [
    { id: "deflect-attempt", speaker: "T-77", text: "Možemo li samo da proverimo signal?" },
    { id: "involuntary", text: "I mean to ask about the signal. My mouth keeps moving." },
  ] : [{ id: "direct", speaker: "T-77", text: "Moram nešto da kažem." }];
  return [...opening,
    { id: "confession", speaker: "T-77", text: CONFESSION },
    { id: "weight", text: "Said aloud, it has nowhere to go. It stays between my teeth." },
    { id: "advice", speaker: "PRIJATELJ", text: ADVICE, pause: 700 },
    { id: "echo", speaker: "KANAL 02", text: "…Vrati se kući.", echo: true, pause: 600 },
    { id: "deflection", speaker: "T-77", text: "Kakav je signal u donjem sektoru?" },
    { id: "work", speaker: "PRIJATELJ", text: "Slab. Moram da ostanem na releju. Ako pustim vezu, izgubićemo kanal.", pause: 900 },
    { id: "promise", speaker: "T-77", text: "Još jedan zaron. Onda se vraćam." },
    { id: "exit", speaker: "PRIJATELJ", text: "Javi se kad stigneš. Vraćam se signalu.", pause: 900 },
    { id: "unresolved", text: "The relay clicks back into its rhythm. I keep my hand on the switch a little longer." },
  ];
}
export type DiveLogEntry = { id: string; date: string; record: string };
export function recordPraviGlas(entries: DiveLogEntry[], at: Date): DiveLogEntry[] {
  return [...entries.filter(e => e.id !== "pravi-glas"), { id: "pravi-glas", date: at.toISOString(), record: "T-77 · Pravi glas · Deljeni kanal. Razgovor završen. Još jedan zaron." }];
}
export function deathLogSlot() { return { id: "death", date: "NOW", record: "Ona · smrt", corrupted: true }; }
export function canUseComms(z: number) { return z >= 11.5; }
export function postMorgueState(at: Date) {
  return { morgueCompleted: true, creditsCompleted: true, entries: [{ id: "morgue", date: at.toISOString(), record: "T-77 · Mrtvačnica · Identifikacija: Unknown." }] satisfies DiveLogEntry[] };
}