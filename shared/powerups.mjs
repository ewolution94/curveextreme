// The reference's 25 powerups as data: change a number here (or switch one off in a room's custom
// settings) and the game follows. Durations and spawn weights are the reference's published table;
// the colours are its icons' discs: green hits you, red hits your opponents, blue hits everyone.
//
//   mods    multiply a curve's numbers while the effect runs (stacking multiplies again):
//           speed, radius (turn radius), size (line width and hit size), gap (gap length),
//           gapRate (how often gaps come); gapAdd adds units to a gap's length
//   flags   corner (90° turns), reverse (left is right), finger (one direction only, picked per
//           curve), fly (no line, no collisions), wrap (the walls let you through to the other side)
//   action  happens once, on pickup: eraseAll, eraseOwn, switch, split, noDraw, closeWalls,
//           moving (powerups drift), darkness

export const POWERUPS = Object.freeze({
  greenSpeed: { name: 'Green Speed', colour: 'green', dur: 3, weight: 2, mods: { speed: 2, radius: 1.2 } },
  redSpeed: { name: 'Red Speed', colour: 'red', dur: 3, weight: 1, mods: { speed: 2, radius: 1.2 } },
  thin: { name: 'Thin', colour: 'green', dur: 15, weight: 2, mods: { size: 0.5 } },
  fat: { name: 'Fat', colour: 'red', dur: 7, weight: 2, mods: { size: 2, gap: 2 } },
  greenTurtle: { name: 'Green Turtle', colour: 'green', dur: 10, weight: 2, mods: { speed: 0.5, radius: 0.66 } },
  redTurtle: { name: 'Red Turtle', colour: 'red', dur: 5, weight: 2, mods: { speed: 0.5 } },
  eraser: { name: 'Eraser', colour: 'blue', dur: 0, weight: 1, action: 'eraseAll' },
  greenEraser: { name: 'Green Eraser', colour: 'green', dur: 0, weight: 1, action: 'eraseOwn' },
  bubbles: { name: 'Bubbles', colour: 'blue', dur: 3, weight: 2, mods: { gapRate: 3 } },
  reverse: { name: 'Reverse', colour: 'red', dur: 5, weight: 1, flags: { reverse: true } },
  fly: { name: 'Fly', colour: 'green', dur: 6, weight: 1, flags: { fly: true } },
  openWalls: { name: 'Open Walls', colour: 'blue', dur: 10, weight: 2, flags: { wrap: true } },
  greenOpenWalls: { name: 'Green Open Walls', colour: 'green', dur: 15, weight: 2, flags: { wrap: true } },
  switch: { name: 'Switch', colour: 'blue', dur: 0, weight: 1, action: 'switch' },
  split: { name: 'Split', colour: 'green', dur: 0, weight: 2, action: 'split' },
  greenCorner: { name: 'Green Corner', colour: 'green', dur: 15, weight: 2, flags: { corner: true } },
  redCorner: { name: 'Red Corner', colour: 'red', dur: 7, weight: 1, flags: { corner: true } },
  smallTurn: { name: 'Small Turn', colour: 'green', dur: 15, weight: 2, mods: { radius: 0.66 } },
  movingPowerups: { name: 'Moving Powerups', colour: 'blue', dur: 10, weight: 2, action: 'moving' },
  finger: { name: 'Finger', colour: 'red', dur: 5, weight: 1, flags: { finger: true } },
  darkness: { name: 'Darkness', colour: 'blue', dur: 10, weight: 1, action: 'darkness' },
  noDraw: { name: 'No Draw', colour: 'blue', dur: 7, weight: 2, action: 'noDraw' },
  closingWalls: { name: 'Closing Walls', colour: 'blue', dur: 0, weight: 2, action: 'closeWalls' },
  bigTurn: { name: 'Big Turn', colour: 'red', dur: 5, weight: 1, mods: { radius: 1.5 } },
  // "Hole size: +4" in the reference; read as four line widths. A guess: change it here.
  cheese: { name: 'Cheese', colour: 'red', dur: 10, weight: 2, mods: { gapAdd: 27.6 } },
});

export const POWERUP_KINDS = Object.freeze(Object.keys(POWERUPS));

/** The actions' own numbers (also guesses where the reference says only what happens). */
export const ACTIONS = Object.freeze({
  split: { spread: 0.45 }, // radians between the three curves
  splitImmune: 0.4, // seconds the three ignore each other's lines
  noDraw: { radius: 70 }, // the safe zone's radius
  closeWalls: { to: 0.3, seconds: 12 }, // shrinks to 30 % of its size over 12 s
  moving: { speed: 45 }, // units per second
  darkness: { radius: 55 }, // the light around each head
});
