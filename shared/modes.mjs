// The reference's modes: which powerups spawn, how often, and which feel profile they start from.
// A room's host picks one; Custom switches each powerup on or off.

import { POWERUP_KINDS } from './powerups.mjs';

export const MODES = Object.freeze({
  basic: {
    name: 'Basic',
    blurb: 'Lots of powerups, to learn what they do.',
    feel: 'classic',
    rate: 1.4,
    powerups: ['greenSpeed', 'redSpeed', 'fat', 'greenTurtle', 'redTurtle', 'openWalls', 'eraser', 'fly', 'reverse', 'bubbles'],
  },
  none: { name: 'None', blurb: 'No powerups: just driving.', feel: 'classic', rate: 1, powerups: [] },
  thin: { name: 'Thin', blurb: 'Thin lines through narrow paths.', feel: 'classic', rate: 1, powerups: ['thin'] },
  corner: { name: 'Corner', blurb: 'Right angles and patterns.', feel: 'classic', rate: 1, powerups: ['greenCorner'] },
  thorner: { name: 'Thorner', blurb: 'Thin and Corner together.', feel: 'classic', rate: 1, powerups: ['thin', 'greenCorner'] },
  gspeed: { name: 'GSpeed', blurb: 'Grab speed, circle the others; erasers save you.', feel: 'classic', rate: 1.2, powerups: ['greenSpeed', 'eraser', 'bubbles'] },
  rspeed: { name: 'RSpeed', blurb: 'Red speeds: everyone else gets faster.', feel: 'classic', rate: 1, powerups: ['redSpeed'] },
  gspp: { name: 'GS++', blurb: 'GSpeed, much faster, on a bigger field.', feel: 'gspp', rate: 2, powerups: ['greenSpeed', 'eraser'] },
  custom: { name: 'Custom', blurb: 'Every setting yours.', feel: 'classic', rate: 1, powerups: [...POWERUP_KINDS] },
});

export const MODE_KEYS = Object.freeze(Object.keys(MODES));
