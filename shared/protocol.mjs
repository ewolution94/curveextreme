// How the page and the server talk, and the timings that make the shared clock work. Every message
// on the socket is [type, payload] in shared/wire.mjs's binary format: the steering action, the only
// message during a round that matters for speed, is a positional array of integers; the rare ones
// (settings, a colour, a kick) are plain objects, where clarity beats bytes.
//
// The model (development/plans/curveextreme.md, "Netcode"): nobody sends positions. Every page and
// the server run the same simulation (engine.mjs) on one clock; only steering changes travel, each
// stamped with the frame and the moment within the frame it happened. A page shows its own steering
// at once and rewinds when another player's arrives late (timeline.mjs). The server is the referee:
// it runs the round a little behind, takes or rejects each action, and owns who's in, the scores
// and the rounds.

/** Page → server. */
export const UP = Object.freeze({
  PING: 1, // [pageTime]
  ACTION: 2, // [round, frame, player, actionNum, sub, dir, press]
  ME: 10, // { name?, colour?, avatar?, team? }
  SETTINGS: 11, // the host's patch
  START: 12,
  STOP: 13,
  LEAVE: 14,
  KICK: 15, // { id }
  SAVE_PROFILE: 16, // a feel
});

/** Server → page. */
export const DOWN = Object.freeze({
  PONG: 1, // [pageTime, serverTime]
  INIT: 20, // everything on joining: the room, and the round so far (its start and every action)
  UPDATE: 21, // the room's structure: { view?, points?, teamWins?, deaths?, results?, profiles? }
  COUNTDOWN_START: 22, // { no, at }: the next round starts at server time `at`
  COUNTDOWN_STOP: 23,
  ROUND_START: 24, // { start, at }: the round's start (engine.mjs) and the server time of frame 0
  ACTION_ADD: 25, // another player's action (the action's array)
  ACTION_REMOVE: 26, // [round, player, actionNum]: take back an action (yours, when it was moved)
  ACTION_REJECT: 27, // [round, player, actionNum]: your action was wrong (malformed, another round)
  ERROR: 29, // { code }
  KICKED: 30,
});

/** The action's fields, in order. `sub`: where in the frame it happened, in thousandths. */
export const ACTION_FIELDS = Object.freeze(['round', 'frame', 'player', 'num', 'sub', 'dir', 'press']);
export const SUBS = 1000;

export const toAction = (a) => ({ round: a[0], frame: a[1], player: a[2], num: a[3], sub: a[4], dir: a[5], press: a[6] });
export const fromAction = (a) => [a.round, a.frame, a.player, a.num, a.sub, a.dir, a.press];

/**
 * The clock's timings, in milliseconds (data, like the feel: change them here).
 *  authority   the server simulates this far behind the shared clock, so actions reach it before
 *              it simulates their frame; one that arrives later moves to the earliest frame still
 *              open (the sender's page swaps it), unless it's later than retimeLimit
 *  lead        a round's frame 0 is this far after the server sends its start, so every page has
 *              the start in hand before the round begins
 *  between     from a round's end to the next one's start (the countdown)
 *  watch       watchers see the game this far behind: late actions are in by then, so it never jumps
 *  inputShift  your actions are stamped this far ahead (+) or behind (−) of the moment you press:
 *              ahead means fewer rewinds on the other pages and a slightly later turn on yours
 *  ahead       an action stamped further than this many frames ahead of the server is refused
 *  retimeLimit an action later than this (ms) is refused rather than moved
 *  ping        how often a page measures the clock
 *  rewind      snapshots kept for rewinding, in frames; an older action replays the round from 0
 */
export const NET = Object.freeze({
  authority: 150,
  lead: 450,
  between: 400,
  watch: 200,
  inputShift: 0,
  ahead: 30,
  retimeLimit: 2000,
  ping: 2000,
  rewind: 240,
});
