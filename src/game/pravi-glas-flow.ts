export type ConfessionChoice = "already" | "forgot" | "log";
export type RadioBeat = { id: string; speaker?: "R." | "T-77" | "CHANNEL 02"; text: string; pause?: number; echo?: boolean; sound?: "console" | "regulator" | "static" };
export const COMMS_ENTRY = "The morgue drawer closes with the same sound it always makes. I walk the corridor to comms. My boots are wet. They have been wet for a long time.";
export const COMMS_CHOICES: { id: ConfessionChoice; text: string }[] = [
  { id: "already", text: "She was already there." },
  { id: "forgot", text: "I don't remember opening it." },
  { id: "log", text: "Just log it, R. Please." },
];
export const RECEPTION: RadioBeat[] = [
  { id: "reception", speaker: "R.", text: "T-77. Reporting." },
  { id: "reply", speaker: "T-77", text: "Yes." },
  { id: "sector", speaker: "R.", text: "Sector?" },
  { id: "gamma", speaker: "T-77", text: "Gamma-7." },
  { id: "designation", speaker: "R.", text: "Designation of the recovered.", pause: 1800 },
  { id: "identification", speaker: "T-77", text: "K-23." },
  { id: "one-key", text: "He does not type. He does not need to. I hear him breathe once, twice. Then a key. Only one key.", sound: "console" },
  { id: "logged", speaker: "R.", text: "Logged. Time of recovery —" },
  { id: "now", speaker: "T-77", text: "Now." },
  { id: "same-entry", speaker: "R.", text: "…Now. Same as last entry. Same as the entry before that.", pause: 1400 },
  { id: "dont-understand", speaker: "T-77", text: "I don't understand." },
  { id: "no", speaker: "R.", text: "No. You don't." },
  { id: "breathing", text: "A long silence. His breathing comes through the channel, irregular.", pause: 2300, sound: "regulator" },
  { id: "ask", speaker: "R.", text: "Tamara, I have to ask you something. And I need you to listen to me before you answer." },
  { id: "listening", speaker: "T-77", text: "I'm listening." },
  { id: "drawer", speaker: "R.", text: "When you opened that drawer just now. Was it empty before you put her in?" },
  { id: "what", speaker: "T-77", text: "What?" },
  { id: "yes-or-no", speaker: "R.", text: "Was the drawer empty, Tamara. Before you brought her back. Yes or no." },
  { id: "missing-word", text: "I open my mouth to say yes. The word does not arrive. I wait for it. It does not arrive." },
  { id: "thought", speaker: "R.", text: "That's what I thought." },
];
export function confessionBranch(choice: ConfessionChoice): RadioBeat[] {
  const branches: Record<ConfessionChoice, RadioBeat[]> = {
    already: [
      { id: "already", speaker: "T-77", text: "She was already there." },
      { id: "know", speaker: "R.", text: "I know." },
      { id: "eleven", speaker: "R.", text: "She's been there the whole time, Tamara. I've logged K-23 eleven times this week. Eleven. Same body. Same drawer. Same —", pause: 1800 },
      { id: "console-hit", text: "A fist strikes the console.", sound: "console" },
      { id: "timestamp", speaker: "R.", text: "— same timestamp. NOW. Every single time, the log says NOW. The system won't let me change it. I've tried. God, I've tried." },
    ],
    forgot: [
      { id: "forgot", speaker: "T-77", text: "I don't remember opening it." },
      { id: "laugh", text: "A short laugh. No joy in it.", pause: 900 },
      { id: "of-course", speaker: "R.", text: "Of course you don't." },
      { id: "first-time", speaker: "R.", text: "I remember the first time you brought her in. You were screaming. You couldn't breathe. You kept saying her name, over and over, until your regulator iced up and I had to talk you through the lockout procedure for forty minutes. Forty minutes, Tamara. I counted." },
      { id: "laundry", speaker: "R.", text: "Now you walk in here like you're picking up laundry. You don't even remember screaming.", pause: 1800 },
    ],
    log: [
      { id: "log", speaker: "T-77", text: "Just log it, R. Please." },
      { id: "brave", speaker: "R.", text: "I used to think you were the brave one. Down there, in the dark, with the — whatever the hell grows on those walls. I thought you were the one holding this station together. That I was just the voice on the relay.", pause: 2300 },
      { id: "regulator-first", text: "His regulator gurgles for a moment, then steadies.", sound: "regulator" },
      { id: "wrong", speaker: "R.", text: "I was wrong. You're not holding anything together, Tamara. You're just — you're just walking through it. And I'm the idiot at the desk, logging the same corpse, talking to the same person, knowing damn well you won't remember this conversation by the time you reach the bulkhead." },
    ],
  };
  return [...branches[choice], ...COMMS_END];
}
export const COMMS_END: RadioBeat[] = [
  { id: "convergence", speaker: "R.", text: "You want to know why I'm short with you today? You want to know why I can't — why I can't do this voice anymore?" },
  { id: "r-interrupt", speaker: "T-77", text: "R. —" },
  { id: "remember", speaker: "R.", text: "Because I am the only person in this station who remembers. That's the job, Tamara. Someone has to log. Someone has to remember. And you know what happens when you remember everything and the person next to you remembers nothing?" },
  { id: "calm", speaker: "T-77", text: "R., calm —" },
  { id: "rot", speaker: "R.", text: "You start to rot. From the inside out. Same way the walls are rotting down in your corridor. Same way your regulator's going to taste, soon, if you keep going down there." },
  { id: "regulator-question", speaker: "T-77", text: "What do you mean, my regulator?" },
  { id: "nothing", speaker: "R.", text: "Nothing. Forget that.", pause: 1600 },
  { id: "insist", speaker: "T-77", text: "You said my regulator. What did you mean." },
  { id: "drop-it", speaker: "R.", text: "I meant nothing. Drop it." },
  { id: "never", text: "He has never said drop it to me before. R. does not say drop it. R. says stand by. R. says respond when you get there. R. does not say drop it." },
  { id: "wires", speaker: "R.", text: "Listen. Before you go back down. There's something in the lower corridor. Past the second bulkhead, near the junction box — the relay wires. They're — something's wrong with them." },
  { id: "wrong-how", speaker: "T-77", text: "Wrong how." },
  { id: "feed", speaker: "R.", text: "I don't — I can't see from here. The feed is — it's been degrading for hours. There's growth on the line. I keep losing the channel in patches. I lost you for almost a full minute when you were in the morgue." },
  { id: "didnt-say", speaker: "T-77", text: "You didn't say anything." },
  { id: "stop", speaker: "R.", text: "I didn't want you to stop." },
  { id: "stop-what", speaker: "T-77", text: "Stop what." },
  { id: "dont-know", speaker: "R.", text: "Stop — being down there. Doing what you do. I don't know, Tamara. I don't know what you do down there anymore. I just hear you come back up and I log it and I —" },
  { id: "regulator-again", text: "His regulator gurgles again. Longer this time.", sound: "regulator", pause: 1800 },
  { id: "junction", speaker: "R.", text: "The wires, Tamara. The junction box. Something's wrong. Will you look at it. For me. Before you go back to Gamma-7." },
  { id: "go-now", speaker: "T-77", text: "I'll go now." },
  { id: "wait", speaker: "R.", text: "Wait — Tamara, there's something else, I need to tell you about —" },
  { id: "fix", speaker: "T-77", text: "I'll fix the wires. Then I'll come back. Then we'll talk." },
  { id: "listen", speaker: "R.", text: "No, listen to me, that's not —" },
  { id: "promise", speaker: "T-77", text: "One more dive, R. Then I'll come back." },
  { id: "last-time", speaker: "R.", text: "You said that last time.", pause: 1400 },
  { id: "dont-remember", speaker: "T-77", text: "I don't remember saying that." },
  { id: "know-dont", speaker: "R.", text: "I know you don't." },
  { id: "respond", speaker: "R.", text: "Just — respond. When you get to the junction box. I need to know you're —", pause: 1800 },
  { id: "signal-loss", text: "Static. Crackling. His voice arrives in pieces.", sound: "static" },
  { id: "losing", speaker: "R.", text: "— channel's — Tamara, I'm losing —" },
  { id: "r-question", speaker: "T-77", text: "R.?" },
  { id: "still-here", speaker: "R.", text: "— still here. Still here. Just — the wires, Tamara. Fix the wires. And then —" },
  { id: "echo", speaker: "CHANNEL 02", text: "Come home.", echo: true, pause: 2500 },
  { id: "warm-switch", text: "I take my hand off the switch. The metal is still warm. I tell myself it is warm from his voice. I do not let myself think about what else might have been breathing into it." },
  { id: "gear", text: "I take my gear. I walk toward the bulkhead. I do not look back at the channel, because I know that if I look back, I will sit down in that chair and I will not get up again." },
  { id: "cold-water", text: "The water is colder than it was thirty minutes ago." },
];
export type DiveLogEntry = { id: string; date: string; record: string };
export function recordPraviGlas(entries: DiveLogEntry[], at: Date): DiveLogEntry[] {
  return [...entries.filter(e => e.id !== "pravi-glas"), { id: "pravi-glas", date: at.toISOString(), record: "T-77 · R. · K-23 recovery reported. Shared channel lost. Relay wires / junction box." }];
}
export function deathLogSlot() { return { id: "death", date: "NOW", record: "She · death", corrupted: true }; }
export function canUseComms(z: number) { return z >= 11.5; }
export function postMorgueState(at: Date) {
  return { morgueCompleted: true, creditsCompleted: true, entries: [{ id: "morgue", date: at.toISOString(), record: "T-77 · Morgue · Identification: Unknown." }] satisfies DiveLogEntry[] };
}