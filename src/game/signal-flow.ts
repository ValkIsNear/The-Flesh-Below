// Browser-safe rules for the "Signal" corridor: length, monologue triggers, exit door.
export const SIGNAL_LENGTH = 60;
export const SIGNAL_DOOR_Z = 57;
export const SIGNAL_DOOR_RANGE = 2.2;

export const SIGNAL_MONOLOGUE = [
  { id: "cold", z: 9, text: "The water is colder than it was thirty minutes ago." },
  { id: "bulkhead", z: 26, text: "This bulkhead isn't on the station schematics." },
  { id: "static", z: 43, text: "Static is chewing through his channel." },
] as const;

/** Index of the next monologue beat reached at z, given how many already played. */
export function monologueDue(z: number, played: number): number | null {
  const beat = SIGNAL_MONOLOGUE[played];
  return beat && z >= beat.z ? played : null;
}

export function canOpenSignalDoor(z: number) {
  return z >= SIGNAL_DOOR_Z - SIGNAL_DOOR_RANGE;
}

/** Water level as a fraction of corridor height; rises slowly toward the door. */
export function waterLevel(z: number) {
  return 0.06 + Math.min(1, Math.max(0, z / SIGNAL_LENGTH)) * 0.08;
}
