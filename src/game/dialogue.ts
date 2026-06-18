// All narration + Serbian in-world lines for SY: The Heavy.
// English = internal narration. Serbian = radio chatter / system / abyss whispers.

export type Line =
  | { kind: "narration"; text: string }
  | { kind: "radio"; speaker: "KAYLA" | "SYSTEM" | "ABYSS"; text: string; sr?: string }
  | { kind: "sfx"; text: string };

export const INTRO_EPIGRAPH = [
  "Dole, pritisak ne lomi samo kost.",
  "Melje smisao u prah,",
  "odjek života kojeg se više ne sećaš.",
];

export const INTRO_PROSE: Line[] = [
  { kind: "narration", text: "The beam from my suit cut through the murk, catching something drifting ahead — something that shouldn't be moving. Not like that." },
  { kind: "narration", text: "It was a suit, adrift in the current, one arm twisted back at a sickening angle, the other limp, trailing like a broken wing. And below the waist… nothing. Just a ragged tear of fabric and dark water where a leg should have been." },
  { kind: "narration", text: "I knew that suit. I knew the way the shoulder plates were scuffed, the faint burn mark on the left breastplate — a jagged line we'd etched together, a secret joke that wasn't funny anymore." },
  { kind: "narration", text: "She'd been gone a week. A full week." },
];

export const AIRLOCK_LINES: Line[] = [
  { kind: "sfx", text: "— Airlock 4. Red light. A tinned synth-pop loop bleeds from a cracked speaker. —" },
  { kind: "narration", text: "I sit on the rusted bench, the hydraulic in my right leg cold and sluggish. I kick my heel against the floor." },
  { kind: "sfx", text: "Klang. Tap. Klang." },
  { kind: "narration", text: "In my pocket, a broken cigarette I will never light. A useless piece of the surface I carry like a relic." },
  { kind: "radio", speaker: "KAYLA", sr: "Javi se.", text: "Asset 77-T, respond. Pressure at eight hundred atmospheres." },
  { kind: "radio", speaker: "KAYLA", sr: "Proveri zaptivke.", text: "Opening the floodgate. Check your seals, Tamara." },
  { kind: "narration", text: "Her voice is flat. Static-heavy. But it's the only warm thing down here, and we both know it." },
  { kind: "radio", speaker: "KAYLA", sr: "Vrati se kući.", text: "…Come back home." },
  { kind: "narration", text: "I don't answer. The floodgate groans open. The Vital Fluid swallows the light." },

];

export const HUSK_LINES: Line[] = [
  { kind: "sfx", text: "— Sector Gamma-7. Three thousand meters. The suit's beam catches something drifting. —" },
  { kind: "narration", text: "A suit. One leg torn away. Faceplate shattered, blinded by the pressure. The body listing in the current, slow and dreamlike, as if still asleep." },
  { kind: "narration", text: "I knew that suit." },
  { kind: "radio", speaker: "SYSTEM", sr: "Upozorenje.", text: "Warning. Bio-mass reacting to your presence." },
  { kind: "narration", text: "The faceplate flickers. The bio-meat on the helmet's seams pulses — and, for an instant, it takes the shape of her face. The girl I left on the surface without saying goodbye." },
  { kind: "radio", speaker: "ABYSS", sr: "Tamara…", text: "…Tamara." },
  { kind: "radio", speaker: "KAYLA", sr: "Odmakni se!", text: "Back away! That isn't a face — it's just meat and calibration!" },
  { kind: "radio", speaker: "KAYLA", sr: "Čuješ li me?", text: "It's feeding on your grief. Do you hear me? DO YOU HEAR ME?" },

  { kind: "narration", text: "I drop the cassette. I back away. The wet, clicking sound behind me is trying to learn her name." },
];

export const MORGUE_LINES: Line[] = [
  { kind: "sfx", text: "— The Morgue. Cold room, lower level. Red emergency lights. —" },
  { kind: "narration", text: "I set the helmet down on the slab beside the body — still covered, for now. My breath clouds in the frigid air. I stand straight. Shoulders back. No slouching. No weakness." },
  { kind: "narration", text: "\"T-77 reporting,\" I say, my voice flat. \"Body located, Sector Gamma-7. Suit compromised. One limb missing. Visor shattered.\"" },
  { kind: "radio", speaker: "SYSTEM", sr: "Vreme otkrića?", text: "Time of discovery?" },
  { kind: "narration", text: "\"Standard sweep. Approximately four hundred hours.\"" },
  { kind: "radio", speaker: "SYSTEM", sr: "Uzrok smrti?", text: "Cause of death?" },
  { kind: "narration", text: "\"Unknown. No visible trauma beyond limb severance. Visor damage suggests pressure breach.\" I do not mention the way the body drifted. The emptiness in the suit. The way it looked like it was still sleeping." },
  { kind: "radio", speaker: "SYSTEM", sr: "Identifikacija?", text: "Subject ID?" },
  { kind: "narration", text: "I hesitate. Just for a second. Then I force the words out. \"Unknown. No serial visible. Suit markings… inconsistent with registry.\"" },
  { kind: "narration", text: "They turn. They walk out. The door slides shut. Alone with the slab, with the cold, with her." },
  { kind: "narration", text: "The grief hits me then. Not as a stone, but as a wave. The memory of her laughter, the way she'd roll her eyes when I joked about the suits, the way her hand had brushed mine once during a particularly bad dive. It's all there, flooding my senses, and I can't breathe." },
  { kind: "narration", text: "She'd been gone. That's where this had happened." },
];

export const CREDITS = {
  title: "SY",
  subtitle: "The Heavy — Prototype",
  lines: [
    "A short project by valk.is.near",
    "Inspired by Signalis, Pressure, KOG, solo P88.",
    "Music: silence and the pressure of eight hundred atmospheres.",
    "",
    "Thank you for the support.",
  ],
};
