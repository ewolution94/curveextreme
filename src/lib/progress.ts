// XP, levels and stats, on this device only (no accounts). XP is what you score plus a bonus for
// winning the game; levels unlock colours (shared/colours.mjs). Games in a room count; the shared
// keyboard is for fun and counts nothing.

import { BASE, UNLOCKS } from '../../shared/colours.mjs';
import { load, save } from './store';

export const WIN_BONUS = 10;

export type Stats = {
  games: number;
  wins: number;
  rounds: number;
  roundsSurvived: number; // you were the last one standing (or your team was)
  points: number;
  kills: number; // opponents who crashed into your line
  deaths: number;
  powerups: number;
  gaps: number;
  turnsLeft: number;
  turnsRight: number;
  distance: number; // units driven
  longestRound: number; // seconds alive in one round
};

export type Progress = { xp: number; stats: Stats };

const EMPTY: Progress = {
  xp: 0,
  stats: { games: 0, wins: 0, rounds: 0, roundsSurvived: 0, points: 0, kills: 0, deaths: 0, powerups: 0, gaps: 0, turnsLeft: 0, turnsRight: 0, distance: 0, longestRound: 0 },
};

export function progress(): Progress {
  const p = load<Progress>('cx-progress', EMPTY);
  return { xp: p.xp ?? 0, stats: { ...EMPTY.stats, ...(p.stats ?? {}) } };
}

/** The XP a level starts at: 0, 50, 150, 300, 500, … (25 × n × (n − 1)). */
export const levelStart = (level: number) => 25 * level * (level - 1);

export function levelOf(xp: number) {
  let level = 1;
  while (levelStart(level + 1) <= xp) level++;
  return { level, from: levelStart(level), to: levelStart(level + 1) };
}

/** The colours this device may use. */
export function unlockedColours(xp: number) {
  const { level } = levelOf(xp);
  return [...BASE, ...UNLOCKS.filter((c) => c.level <= level)];
}

/** Adds a finished game (and the round stats gathered during it). Returns the XP gained. */
export function recordGame(points: number, won: boolean, add: Partial<Stats>) {
  const p = progress();
  const gained = points + (won ? WIN_BONUS : 0);
  p.xp += gained;
  const s = p.stats;
  s.games++;
  if (won) s.wins++;
  s.points += points;
  for (const [key, value] of Object.entries(add) as [keyof Stats, number][]) {
    if (key === 'longestRound') s.longestRound = Math.max(s.longestRound, value);
    else s[key] += value;
  }
  save('cx-progress', p);
  return gained;
}
