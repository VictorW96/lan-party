import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rankGames, type Category, type Rankable } from './ranking.ts';
import { playerCountFromText } from './steam.ts';

test('reads player counts from store copy', () => {
  assert.equal(playerCountFromText('Deep Rock Galactic ist ein Koop-FPS für 1-4 Spieler mit Zwergen'), 4);
  assert.equal(playerCountFromText('ein actionreiches Kampfspiel mit bis zu 60 Spielern'), 60);
  assert.equal(playerCountFromText('Hunt alone or with up to 10 players'), 10);
  assert.equal(playerCountFromText('with up to 10 friends'), null);
});

const g = (name: string, category: Category, votes: number, questionable = false): Rankable => ({
  name,
  category,
  votes,
  questionable,
});
const names = (games: Rankable[]) => games.map((x) => x.name);

test('alternates categories, starting with the category of the overall top game', () => {
  const ranked = rankGames([
    g('C1', 'classic', 5),
    g('C2', 'classic', 4),
    g('C3', 'classic', 3),
    g('N1', 'newcomer', 7),
    g('N2', 'newcomer', 1),
    g('N3', 'newcomer', 2),
  ]);
  assert.deepEqual(names(ranked), ['N1', 'C1', 'N3', 'C2', 'N2', 'C3']);
});

test('once a category runs out of voted games, the rest follows by votes', () => {
  const ranked = rankGames([
    g('C1', 'classic', 6),
    g('C2', 'classic', 5),
    g('C3', 'classic', 4),
    g('C4', 'classic', 0),
    g('N1', 'newcomer', 2),
    g('N2', 'newcomer', 0),
  ]);
  // C1, N1 alternate; newcomers have no voted game left, so C2, C3 follow by votes, then the zero-vote games.
  assert.deepEqual(names(ranked), ['C1', 'N1', 'C2', 'C3', 'C4', 'N2']);
});

test('without any votes everything is sorted by name, questionable games last', () => {
  const ranked = rankGames([g('Zeta', 'newcomer', 0), g('Alpha', 'classic', 0, true), g('Beta', 'classic', 0)]);
  assert.deepEqual(names(ranked), ['Beta', 'Zeta', 'Alpha']);
});

test('keeps every game exactly once', () => {
  const games = Array.from({ length: 20 }, (_, i) => g(`G${i}`, i % 3 ? 'classic' : 'newcomer', (i * 7) % 5));
  const ranked = rankGames(games);
  assert.equal(ranked.length, games.length);
  assert.deepEqual(new Set(ranked), new Set(games));
});
