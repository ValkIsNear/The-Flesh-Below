
# SY: The Heavy — Prototype Plan

A short (~15 min) browser-based pixel-art narrative game inspired by Signalis / Pressure / KOG, built with React + Canvas. English narration with **Serbian phrases** as in-world speech (mirroring Signalis' German). Plays in the existing TanStack Start app at `/`.

## Scope of the prototype

A vertical slice covering the opening described in the brief:
1. **Intro** — title card "SY", italic Serbian epigraph, melancholic intro text
2. **Airlock 4** — Tamara sits, kicks her hydraulic leg (Klang-Tap), Kayla on comms ("Pritisak 800 atmosfera. Proveri zaptivke, Tamara.")
3. **The Dive** — top-down pixel exploration of a flooded sector (WASD/arrows), suit light cone, ambient drone
4. **The Husk encounter** — find the drifting body, interact, visor "morph" hallucination, Kayla screams over comms
5. **Retreat** — bio-meat whispers Tamara's lover's name; cut to morgue epilogue text (pages 3–6 from uploads, condensed)

Total play length ~12–15 min, mostly atmospheric walking + reading + 2–3 interactions. No combat, no inventory.

## Story & tone

- Third-person internal narration in English, **Serbian** for radio chatter, system warnings, ambient voice fragments (e.g. *"Asset 77-T, javi se."*, *"Dug se mora platiti."*, *"Vrati se kući."*)
- Sad lesbian backstory delivered through 3 short flashback vignettes (text + still pixel portrait) triggered by environmental objects: a cigarette, a cassette, the Husk
- Ending: bittersweet, not a win-state — Tamara surfaces, files the report, grief wave (mirrors page 5–6)

## Characters in the slice

- **Tamara (Asset #77-T)** — player character. Pixel sprite: thin silhouette, beanie, grafted helmet, chrome eyes (two bright dots), hydraulic right leg (distinct stomp animation frame)
- **Kayla / Isidora** — radio-only in this prototype. Portrait shown in comms UI box (pale, hollow eyes, dark circles)
- **The Husk** — static encounter sprite that morphs (palette swap + frame blend) into the lover's silhouette
- **The Lover (flashback only)** — warm-palette portrait, contrast to the cold sub-strata

## Visual direction

- **Pixel art**, 320×180 internal resolution, integer-scaled to viewport
- Palette: bruised purples, rust orange, sodium red alarms, chrome highlights, deep teal "Vital Fluid"
- CRT scanline + chromatic aberration shader overlay (CSS, cheap)
- Diegetic UI: helmet HUD frame around the viewport with depth meter, O₂, pressure (800 atm), comms log
- Fonts: a pixel display font for HUD/titles, a typewriter serif for narration (matches the uploaded pages' feel)

## Audio

- Procedural drones via WebAudio (no large assets): low sine + filtered noise for pressure, metallic clangs for footsteps (alternating soft step / hydraulic *Klang*), heartbeat on tense beats
- Optional muted ambient track slot (can be added later)

## Tech / file layout

- `src/routes/index.tsx` — mounts `<Game />`, sets SEO head (title "SY — The Heavy", meta, og)
- `src/game/Game.tsx` — top-level component, scene state machine (`intro → airlock → dive → husk → morgue → credits`)
- `src/game/engine/` — small canvas engine: `useGameLoop`, `Renderer`, `Input`, `Camera`
- `src/game/scenes/` — one file per scene
- `src/game/audio/Audio.ts` — WebAudio drones + SFX
- `src/game/data/dialogue.ts` — all narration + Serbian lines, typed
- `src/game/sprites/` — small inline pixel sprites generated as data URIs from compact hex strings (keeps repo light; no binary uploads needed)
- `src/styles.css` — add CRT/scanline tokens; semantic color tokens for the bruised palette

Pure frontend; no Lovable Cloud / DB needed for the prototype. Save state (scene + flags) in `localStorage`.

## Controls

- Arrow keys / WASD — move
- E / Space — interact / advance dialogue
- Esc — pause + Serbian-styled menu (Nastavi / Postavke / Izađi)
- Skippable intro after first read

## Out of scope (for this prototype, can be added later)

- Multiple endings, inventory, enemies/chase, save slots, settings menu beyond volume, real voice acting, custom font files

## Open assumption

Defaulting to **keyboard-only desktop**, **English narration + Serbian in-world lines**, **no real audio assets** (procedural only). If you'd rather have mobile touch controls, full Serbian narration, or want me to source/commission a music track, tell me before I build.
