// How the game feels: every number the curves move by, as data. The server, the page's own game
// (shared keyboard) and the prediction of your own curve all read the same profile, so a playtest
// can change the feel by changing a profile: in the room's Tune panel, or a saved profile on the
// server. Nothing below is hard-wired into the engine.
//
// The Classic numbers were measured from the reference's public replays on 2026-10-22 (frame by
// frame; development/plans/curveextreme.md, "The feel, measured"). Units are map units.

/** The reference's default modes (None, Basic, Thin, Corner…). */
export const CLASSIC = Object.freeze({
  name: 'Classic',
  tickRate: 50, // ticks per second (the reference's About page; the picture can't show it)
  speed: 90, // units per second, constant all round
  radius: 35, // turn radius while a key is held: 147°/s at 90 u/s; no ramp-up
  width: 6.9, // line width, and the head's diameter
  hit: 5, // the head's hit size across (at most 5: it came within 2.5 of every wall)
  gapMean: 158, // average line between two gaps (random, memoryless: 0.57 gaps a second)
  gapMin: 0, // shortest line between two gaps
  gapLength: 16, // a gap's length
  stillTime: 2.5, // seconds the curves sit still, with a heading arrow
  freeTime: 2.5, // seconds they move without a line (no collisions)
  // the walls while they move without a line: 'off' as measured (the dot left the field and drove
  // back in; still outside when the lines start is a crash), 'wrap' (through to the other side) or
  // 'solid' (a crash, like later). What the reference does with a dot still outside is unknown.
  freeWalls: 'off',
  lingerTime: 4.65, // seconds a decided round runs on before it clears
  fieldBase: 255, // a "Scaled" square field is fieldBase × √players units a side
  fieldWide: 1, // the field's width and height relative to that square
  fieldTall: 1,
  spawnMargin: 0.105, // spawns keep this share of the field's side from every wall
  spawnApart: 60, // and this far from each other
  powerupRadius: 22, // a powerup disc's radius (about 45 across in the replays)
  powerupEvery: 2.5, // seconds between powerup spawns on average (a mode multiplies the rate)
  powerupMax: 25, // at most on the field at once
});

/** The reference's GS++: twice as fast, a bigger map, 60 ticks. */
export const GSPP = Object.freeze({
  ...CLASSIC,
  name: 'GS++',
  tickRate: 60,
  speed: 180,
  radius: 38.5,
  gapMean: 316,
  gapLength: 22.4,
  fieldWide: 1.62, // 922 × 763 for five players in the replay
  fieldTall: 1.34,
});

export const BUILT_IN = Object.freeze({ classic: CLASSIC, gspp: GSPP });

/** The Tune panel's choices (settings that aren't numbers). */
export const CHOICES = Object.freeze([
  { key: 'freeWalls', label: 'Walls while moving without a line', options: ['off', 'wrap', 'solid'] },
]);

/** The Tune panel's dials: one per number, with the range a playtest might want. */
export const DIALS = Object.freeze([
  { key: 'speed', label: 'Speed', unit: 'u/s', min: 30, max: 400, step: 1 },
  { key: 'radius', label: 'Turn radius', unit: 'u', min: 10, max: 120, step: 0.5 },
  { key: 'width', label: 'Line width', unit: 'u', min: 1, max: 20, step: 0.1 },
  { key: 'hit', label: 'Hit size of the head', unit: 'u', min: 0, max: 15, step: 0.5 },
  { key: 'gapMean', label: 'Average line between gaps', unit: 'u', min: 20, max: 1000, step: 1 },
  { key: 'gapMin', label: 'Shortest line between gaps', unit: 'u', min: 0, max: 300, step: 1 },
  { key: 'gapLength', label: 'Gap length', unit: 'u', min: 0, max: 60, step: 0.1 },
  { key: 'stillTime', label: 'Still, with the arrow', unit: 's', min: 0, max: 5, step: 0.1 },
  { key: 'freeTime', label: 'Moving without a line', unit: 's', min: 0, max: 5, step: 0.1 },
  { key: 'lingerTime', label: 'A decided round runs on', unit: 's', min: 0, max: 8, step: 0.05 },
  { key: 'tickRate', label: 'Ticks per second', unit: '/s', min: 20, max: 120, step: 1 },
  { key: 'fieldBase', label: 'Field size (× √players)', unit: 'u', min: 150, max: 450, step: 1 },
  { key: 'powerupEvery', label: 'Seconds between powerups', unit: 's', min: 0.5, max: 10, step: 0.1 },
  { key: 'powerupRadius', label: 'Powerup size', unit: 'u', min: 8, max: 40, step: 0.5 },
]);

/** A profile from anywhere (a saved file, a message) made safe: known keys, numbers in range. */
export function cleanFeel(input, base = CLASSIC) {
  const out = { ...base };
  if (!input || typeof input !== 'object') return out;
  if (typeof input.name === 'string') out.name = input.name.slice(0, 40);
  for (const choice of CHOICES) {
    if (choice.options.includes(input[choice.key])) out[choice.key] = input[choice.key];
  }
  for (const key of Object.keys(CLASSIC)) {
    if (key === 'name' || CHOICES.some((c) => c.key === key)) continue;
    const v = Number(input[key]);
    if (!Number.isFinite(v)) continue;
    const dial = DIALS.find((d) => d.key === key);
    out[key] = dial ? Math.min(dial.max, Math.max(dial.min, v)) : v;
  }
  out.tickRate = Math.round(out.tickRate);
  return out;
}

/** The field for a number of players, in units: [width, height]. */
export function fieldFor(feel, players) {
  const side = feel.fieldBase * Math.sqrt(Math.max(1, players));
  return [Math.round(side * feel.fieldWide), Math.round(side * feel.fieldTall)];
}
