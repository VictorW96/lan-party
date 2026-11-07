import assert from 'node:assert/strict';
import { test } from 'node:test';
import { voteLimitError, type VoteLimits } from './votes.ts';

const limits: VoteLimits = { maxVotes: 8, maxVotesPerGame: 1, maxClassicVotes: 5 };
const classic = { category: 'classic' as const };
const newcomer = { category: 'newcomer' as const };

test('allows votes within all budgets', () => {
  assert.equal(voteLimitError(limits, classic, 1, 4, 4), null);
  assert.equal(voteLimitError(limits, newcomer, 1, 7, 5), null);
});

test('caps classic votes, leaving the rest for newcomers', () => {
  assert.match(voteLimitError(limits, classic, 1, 5, 5)!, /Klassiker/);
  assert.equal(voteLimitError(limits, newcomer, 1, 5, 5), null);
});

test('caps the total budget', () => {
  assert.match(voteLimitError(limits, newcomer, 1, 8, 3)!, /nur 8 Votes/);
});

test('removing a vote is always allowed, even over budget', () => {
  assert.equal(voteLimitError(limits, classic, 0, 9, 6), null);
});

test('rejects invalid counts', () => {
  assert.notEqual(voteLimitError(limits, classic, 2, 0, 0), null);
  assert.notEqual(voteLimitError(limits, classic, -1, 0, 0), null);
  assert.notEqual(voteLimitError(limits, classic, 0.5, 0, 0), null);
});
