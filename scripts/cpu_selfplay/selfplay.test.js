import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Worker } from 'node:worker_threads';
import { Board } from '../../game_server/board.js';
import { mirrorMove } from './mirror.js';
import { summarize, wilsonInterval } from './summary.js';
import { playGame } from './run.js';

const adapter = new URL('./worker_adapter.js', import.meta.url);
const newBoard = () => {
  const board = new Board();
  board.init(0, 0, { sente: 7, gote: 7 }, false);
  return board;
};

test('rotation is reversible, swaps kings, and preserves drop sentinels and timestamps', () => {
  for (const move of [
    { x: 4, y: 0, nx: 3, ny: 1, teban: -1, type: 'king2', nari: false, servertime: 9123 },
    { x: -1, y: -1, nx: 2, ny: 4, teban: -1, type: 'rook', servertime: 1234 },
    { x: -1, y: 0, nx: 2, ny: 4, teban: 1, type: 'king', servertime: 5678 },
  ]) {
    const copy = { ...move };
    const mirrored = mirrorMove(move);
    assert.deepEqual(mirrorMove(mirrored), move);
    assert.deepEqual(move, copy);
    assert.equal(mirrored.servertime, move.servertime);
    if (move.x === -1) { assert.equal(mirrored.x, -1); assert.equal(mirrored.y, move.y); }
  }
  assert.equal(mirrorMove({ x: 4, y: 0, nx: 4, ny: 1, teban: -1, type: 'king2' }).type, 'king');
});

test('all initial legal gote moves rotate into legal sente moves on the authoritative board', () => {
  const board = newBoard();
  let legal = 0;
  for (let x = 0; x < 9; x++) for (let y = 0; y < 9; y++) {
    if (board.map[x][y]?.teban !== -1) continue;
    for (let nx = 0; nx < 9; nx++) for (let ny = 0; ny < 9; ny++) {
      for (const nari of [false, true]) {
        const move = { x, y, nx, ny, nari, teban: -1, servertime: 6000 };
        const result = board.getCanMovePiece(x, y, nx, ny, nari, -1, move.servertime);
        if (!result.res) continue;
        const mirrored = mirrorMove(move);
        assert.equal(board.getCanMovePiece(mirrored.x, mirrored.y, mirrored.nx, mirrored.ny,
          mirrored.nari, mirrored.teban, mirrored.servertime).res, true);
        legal++;
      }
    }
  }
  assert.ok(legal > 20, `Only ${legal} opening moves found`);
});

test('mirrored drops and king try remain legal', () => {
  const board = newBoard();
  board.komadaiPieces.sente.rook = 1;
  const drop = mirrorMove({ x: -1, y: -1, nx: 2, ny: 4, teban: -1, type: 'rook', nari: false, servertime: 6000 });
  assert.equal(board.movePieceLocal(drop).res, true);
  board.map = Array.from({ length: 9 }, () => Array(9).fill(null));
  board.map[4][1] = { type: 'king', teban: 1, lastmovetime: -2000 };
  const king = mirrorMove({ x: 4, y: 7, nx: 4, ny: 8, teban: -1, type: 'king2', nari: false, servertime: 6000 });
  assert.equal(board.movePieceLocal(king).res, true);
  assert.deepEqual(board.checkGameEnd(king), { player: 1, text: 'try' });
});

test('summary includes draws in A win rate and uses aggregate game minutes', () => {
  const base = { rejectedCountA: 1, rejectedCountB: 0, quietMoveCountA: 2, quietMoveCountB: 3 };
  const summary = summarize([
    { ...base, winner: 'A', seconds: 60, moveCountA: 12, moveCountB: 6 },
    { ...base, winner: 'draw', seconds: 120, moveCountA: 18, moveCountB: 9 },
  ], true);
  assert.equal(summary.aWinRate, 0.5);
  assert.equal(summary.draws, 1);
  assert.equal(summary.averageSeconds, 90);
  assert.equal(summary.movesPerMinuteA, 10);
  assert.equal(summary.movesPerMinuteB, 5);
  assert.equal(summary.quietMoveCountA, 4);
  assert.equal(summary.quietMoveCountB, 6);
  const [low, high] = wilsonInterval(0, 4);
  assert.ok(Math.abs(low) < 1e-10 && Math.abs(high - 0.489890836) < 1e-8);
});

test('classic worker uses the shared epoch clock and receives browser-shaped events', { timeout: 5000 }, async () => {
  const t0 = Date.now() - 1000;
  const worker = new Worker(adapter, { workerData: {
    t0, filename: 'clock-fixture.js',
    source: 'onmessage = function(e) { postMessage({ received: e.data, now: performance.now() }); };',
  } });
  try {
    await new Promise((resolve, reject) => {
      worker.on('error', reject);
      worker.on('message', (data) => {
        if (data.harness === 'ready') worker.postMessage(['probe', { servertime: 123 }]);
        else {
          try {
            assert.deepEqual(data.received, ['probe', { servertime: 123 }]);
            assert.ok(data.now >= 1000 && data.now <= Date.now() - t0);
            resolve();
          } catch (error) { reject(error); }
        }
      });
    });
  } finally { await worker.terminate(); }
});

test('first live mirrored CPU move is legal for sente', { timeout: 12000 }, async () => {
  const t0 = Date.now() - 6000; // Skip the opening wait in this test only.
  const source = await readFile(new URL('../../public/worker.js', import.meta.url), 'utf8');
  const worker = new Worker(adapter, { workerData: { t0, source, filename: 'public/worker.js' } });
  try {
    await new Promise((resolve, reject) => {
      worker.on('error', reject);
      worker.on('message', (data) => {
        if (data.harness === 'ready') worker.postMessage(['gameStart', { servertime: 0, time: 0, level: '1', pawnLimit4thRank: false }]);
        else {
          try {
            assert.equal(data.move.teban, -1);
            const move = { ...mirrorMove(data.move), servertime: Date.now() - t0 };
            assert.equal(move.teban, 1);
            const board = newBoard();
            assert.equal(board.map[move.x][move.y].teban, 1);
            assert.equal(board.movePieceLocal(move).res, true);
            resolve();
          } catch (error) { reject(error); }
        }
      });
    });
  } finally { await worker.terminate(); }
});

test('worker errors propagate and both threads are terminated', { timeout: 5000 }, async () => {
  const sources = {
    A: { source: 'throw new Error("expected fixture error")', filename: 'broken.js' },
    B: { source: 'onmessage = function() {}; setInterval(function() {}, 100);', filename: 'idle.js' },
  };
  await assert.rejects(playGame(0, { levelA: '1', levelB: '1', maxSeconds: 10 }, sources,
    new AbortController().signal), /expected fixture error/);
});

test('timeout ends idle games as draws and terminates both threads', { timeout: 5000 }, async () => {
  const fixture = { source: 'onmessage = function() {}; setInterval(function() {}, 10);', filename: 'idle.js' };
  const game = await playGame(1, { levelA: '1', levelB: '1', maxSeconds: 0.1, stats: true },
    { A: fixture, B: fixture }, new AbortController().signal);
  assert.equal(game.aSide, 'gote');
  assert.equal(game.winner, 'draw');
  assert.equal(game.reason, 'timeout');
  assert.equal(game.seconds, 0.1);
  assert.equal(game.moveCountA, 0);
  assert.equal(game.moveCountB, 0);
  assert.equal(game.quietMoveCountA, 0);
});

test('abort cancels an active game and terminates both threads', { timeout: 5000 }, async () => {
  const fixture = { source: 'onmessage = function() {}; setInterval(function() {}, 10);', filename: 'idle.js' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('expected cancellation')), 50);
  try {
    await assert.rejects(playGame(0, { levelA: '1', levelB: '1', maxSeconds: 10 },
      { A: fixture, B: fixture }, controller.signal), /expected cancellation/);
  } finally { clearTimeout(timer); }
});
