// Rewinding: actions that arrive late (a frame, a second, longer than the snapshots reach) end in
// exactly the state of having had them all along, through erasers, splits, switches and closing
// walls. Four fixed games, picked because those powerups get taken in them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../shared/engine.mjs';
import { Timeline } from '../shared/timeline.mjs';
import { CLASSIC } from '../shared/feel.mjs';

const GAMES = [[25, 6], [25, 7], [29, 6], [30, 5]]; // [round seed, actions seed]
const FRAMES = 1400;

function start(seed) {
  const players = Array.from({ length: 4 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, colour: '#fff' }));
  // a roomy field, thin heads and big discs, so the curves live long and take the powerups
  const feel = { ...CLASSIC, freeTime: 0.5, fieldBase: 700, hit: 1, powerupRadius: 40 };
  const powerups = ['eraser', 'greenEraser', 'split', 'switch', 'greenSpeed', 'closingWalls', 'movingPowerups'];
  return new Match({ players, feel, mode: { rate: 6, powerups }, seed }).nextRound();
}

/** A made-up game's actions: each player changes direction now and then, mid-frame. */
function actions(seed) {
  let x = seed;
  const rand = () => (x = (Math.imul(x, 1103515245) + 12345) >>> 0) / 4294967296;
  const out = [];
  const num = [0, 0, 0, 0];
  for (let f = 0; f < FRAMES; f++) {
    for (let p = 0; p < 4; p++) {
      if (rand() < 0.06) out.push({ player: p, num: ++num[p], frame: f, sub: Math.floor(rand() * 1000), dir: [-1, 0, 1][Math.floor(rand() * 3)], press: rand() < 0.3 ? (rand() < 0.5 ? -1 : 1) : 0 });
    }
  }
  return out;
}

function known([seed, aseed]) {
  const t = new Timeline(start(seed));
  for (const a of actions(aseed)) t.add(a);
  t.advanceTo(FRAMES);
  return t;
}

/** Each action arrives up to `maxDelay` frames after its own frame. */
function late([seed, aseed], maxDelay, rewind) {
  const t = new Timeline(start(seed), { rewind });
  let x = seed * 31 + aseed;
  const rand = () => (x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296;
  const due = new Map();
  for (const a of actions(aseed)) {
    const at = a.frame + Math.floor(rand() * maxDelay);
    if (!due.has(at)) due.set(at, []);
    due.get(at).push(a);
  }
  for (let k = 0; k <= FRAMES + maxDelay; k++) {
    for (const a of due.get(k) ?? []) t.add(a);
    t.advanceTo(Math.min(k, FRAMES));
  }
  t.advanceTo(FRAMES);
  return t;
}

test('the same start and actions give the same game', () => {
  for (const g of GAMES) assert.equal(known(g).round.hash(), known(g).round.hash());
});

test('the games take the powerups that are hardest to rewind through', () => {
  const kinds = new Set(GAMES.flatMap((g) => known(g).takeEvents().filter((e) => e.e === 'pu-').map((e) => e.kind)));
  for (const kind of ['eraser', 'split', 'switch', 'closingWalls']) assert.ok(kinds.has(kind), `${kind} in ${[...kinds]}`);
});

test('late actions rewind and end in the same state', () => {
  for (const g of GAMES) {
    const t = late(g, 12, 240);
    assert.ok(t.rewinds > 20, `rewound ${t.rewinds} times`);
    assert.equal(t.round.hash(), known(g).round.hash(), `game ${g}`);
  }
});

test('actions later than the snapshots reach replay the round from its start', () => {
  for (const g of GAMES) assert.equal(late(g, 90, 20).round.hash(), known(g).round.hash(), `game ${g}`);
});

test('an action taken back is as if it never was', () => {
  const g = GAMES[0];
  const t = new Timeline(start(g[0]));
  for (const a of actions(g[1])) t.add(a);
  t.add({ player: 1, num: 9999, frame: 400, sub: 10, dir: 1, press: 0 });
  t.advanceTo(900);
  t.remove(1, 9999);
  t.advanceTo(FRAMES);
  assert.equal(t.round.hash(), known(g).round.hash());
});

test('the server taking a player out rewinds like an action', () => {
  const g = GAMES[1];
  const a = new Timeline(start(g[0]));
  const b = new Timeline(start(g[0]));
  for (const x of actions(g[1])) (a.add(x), b.add(x));
  a.kill(300, 2);
  a.advanceTo(FRAMES);
  b.advanceTo(500);
  b.kill(300, 2);
  b.advanceTo(FRAMES);
  assert.equal(b.round.hash(), a.round.hash());
  assert.equal(a.round.s.deadAt[2] <= 300, true);
});

test('a duplicate action is ignored', () => {
  const t = new Timeline(start(1));
  assert.equal(t.add({ player: 0, num: 1, frame: 5, sub: 0, dir: 1 }), true);
  assert.equal(t.add({ player: 0, num: 1, frame: 5, sub: 0, dir: 1 }), false);
});
