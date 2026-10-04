import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { Worker } from 'node:worker_threads';
import { Board } from '../../game_server/board.js';
import { inPerspective } from './mirror.js';
import { summarize, formatSummary } from './summary.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
const adapter = new URL('./worker_adapter.js', import.meta.url);
const help = `Usage: node scripts/cpu_selfplay/run.js [options]
  --a PATH           Worker A (default: public/worker.js)
  --b PATH           Worker B (default: public/worker.js)
  --levelA 0..5      A level (default: 5)
  --levelB 0..5      B level (default: 5)
  --games N          Number of games (default: 40)
  --parallel N       Concurrent games (default: 6)
  --maxSeconds N     Real-time limit per game, including startup (default: 300)
  --out PATH         Write JSON under scripts/cpu_selfplay/ (bare names go here)
  --stats            Count applied quiet moves
  --help             Show this help
Paths are relative to the current working directory. A starts as sente in game 1.
`;

function optionsFromArgs(args) {
  const { values } = parseArgs({ args, options: {
    a: { type: 'string', default: 'public/worker.js' },
    b: { type: 'string', default: 'public/worker.js' },
    levelA: { type: 'string', default: '5' },
    levelB: { type: 'string', default: '5' },
    games: { type: 'string', default: '40' },
    parallel: { type: 'string', default: '6' },
    maxSeconds: { type: 'string', default: '300' },
    out: { type: 'string' },
    stats: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  } });
  if (values.help) return values;
  for (const key of ['levelA', 'levelB']) {
    if (!/^[0-5]$/.test(values[key])) throw new Error(`--${key} must be 0..5`);
  }
  for (const key of ['games', 'parallel', 'maxSeconds']) {
    const number = Number(values[key]);
    if (!Number.isFinite(number) || number <= 0 ||
        (key !== 'maxSeconds' && !Number.isSafeInteger(number))) {
      throw new Error(`--${key} must be a positive ${key === 'maxSeconds' ? 'number' : 'integer'}`);
    }
    values[key] = number;
  }
  if (values.maxSeconds * 1000 > 2 ** 31 - 1) throw new Error('--maxSeconds exceeds the Node timer limit');
  if (values.out) {
    values.out = path.dirname(values.out) === '.' && !path.isAbsolute(values.out)
      ? path.resolve(directory, values.out) : path.resolve(values.out);
  }
  return values;
}

function validMove(move, side) {
  const coordinate = (value) => Number.isInteger(value) && value >= 0 && value < 9;
  return move && typeof move === 'object' && move.teban === side &&
    coordinate(move.nx) && coordinate(move.ny) &&
    (move.x === -1 ? typeof move.type === 'string' : coordinate(move.x) && coordinate(move.y));
}

export async function playGame(index, options, sources, signal) {
  const t0 = Date.now();
  const now = () => Date.now() - t0;
  const board = new Board();
  // Workers calculate startTime + performance.now(). Giving startTime=0
  // means every server timestamp is exactly Date.now()-t0, without double offset.
  board.init(0, 0, { sente: 7, gote: 7 }, false);
  const aSide = index % 2 === 0 ? 1 : -1;
  const result = {
    aSide: aSide === 1 ? 'sente' : 'gote',
    winner: 'draw', reason: 'timeout', seconds: 0,
    moveCountA: 0, moveCountB: 0, rejectedCountA: 0, rejectedCountB: 0,
  };
  if (options.stats) Object.assign(result, { quietMoveCountA: 0, quietMoveCountB: 0 });
  const workers = [];
  let finished = false;
  let timer;
  let onAbort;
  try {
    return await new Promise((resolve, reject) => {
      const finish = (error, winner = 0, reason = 'timeout') => {
        if (finished) return;
        finished = true;
        result.seconds = Math.min(now(), options.maxSeconds * 1000) / 1000;
        if (error) reject(error);
        else {
          result.winner = winner === 0 ? 'draw' : winner === aSide ? 'A' : 'B';
          result.reason = reason;
          resolve(result);
        }
      };
      onAbort = () => finish(signal.reason ?? new Error('Run aborted'));
      signal.addEventListener('abort', onAbort, { once: true });
      if (signal.aborted) { onAbort(); return; }
      timer = setTimeout(() => finish(), options.maxSeconds * 1000);
      for (const label of ['A', 'B']) {
        const side = label === 'A' ? aSide : -aSide;
        const worker = new Worker(adapter, { workerData: { ...sources[label], t0 } });
        const entry = { worker, side, label, ready: false };
        workers.push(entry);
        worker.on('error', (error) => finish(new Error(`Game ${index + 1}, ${label}: ${error.message}`, { cause: error })));
        worker.on('exit', (code) => {
          if (!finished) finish(new Error(`Game ${index + 1}, ${label}: unexpected worker exit ${code}`));
        });
        worker.on('message', (message) => {
          if (finished) return;
          if (now() >= options.maxSeconds * 1000) { finish(); return; }
          try {
            if (message?.harness === 'ready') {
              entry.ready = true;
              if (workers.length === 2 && workers.every((cpu) => cpu.ready)) {
                for (const cpu of workers) {
                  cpu.worker.postMessage(['gameStart', {
                    servertime: 0, time: 0, level: options[`level${cpu.label}`], pawnLimit4thRank: false,
                  }]);
                }
              }
              return;
            }
            if (!entry.ready || !message?.move) throw new Error(`${label} sent an invalid worker message`);
            const move = { ...inPerspective(message.move, side), servertime: now() };
            if (!validMove(move, side)) throw new Error(`${label} sent an invalid move: ${JSON.stringify(move)}`);
            // Compute quiet status before application, including the pre-promotion piece type.
            const piece = move.x === -1 ? null : board.map[move.x][move.y];
            const quiet = piece && piece.type !== 'king' && piece.type !== 'king2' && !board.map[move.nx][move.ny];
            const applied = board.movePieceLocal(move);
            if (applied.res !== true) {
              result[`rejectedCount${label}`]++;
              // A reserve is rejected, never scheduled, just like handleCpuMove.
              worker.postMessage(['moveRejected', inPerspective(move, side)]);
              return;
            }
            result[`moveCount${label}`]++;
            if (options.stats && quiet) result[`quietMoveCount${label}`]++;
            for (const cpu of workers) {
              cpu.worker.postMessage(['move', inPerspective(move, cpu.side)]);
            }
            const end = board.checkGameEnd(move);
            if (end.player !== 0) finish(null, end.player, end.text === 'game-end' ? 'king-capture' : end.text);
          } catch (error) {
            finish(new Error(`Game ${index + 1}: ${error.message}`, { cause: error }));
          }
        });
      }
    });
  } finally {
    finished = true;
    clearTimeout(timer);
    if (onAbort) signal.removeEventListener('abort', onAbort);
    await Promise.all(workers.map(({ worker }) => worker.terminate()));
  }
}

export async function main(args = process.argv.slice(2)) {
  const options = optionsFromArgs(args);
  if (options.help) { console.log(help); return; }
  const filenames = { A: path.resolve(options.a), B: path.resolve(options.b) };
  const [sourceA, sourceB] = await Promise.all([
    readFile(filenames.A, 'utf8'), readFile(filenames.B, 'utf8'),
  ]);
  const sources = { A: { filename: filenames.A, source: sourceA }, B: { filename: filenames.B, source: sourceB } };
  const controller = new AbortController();
  const interrupt = () => controller.abort(new Error('Interrupted; all CPU threads terminated'));
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  const games = new Array(options.games);
  let nextIndex = 0;
  try {
    const pools = Array.from({ length: Math.min(options.parallel, options.games) }, async () => {
      try {
        while (nextIndex < options.games && !controller.signal.aborted) {
          const index = nextIndex++;
          games[index] = await playGame(index, options, sources, controller.signal);
          const game = games[index];
          console.error(`Game ${index + 1}/${options.games}: A=${game.aSide}, ${game.winner} (${game.reason}), ${game.seconds.toFixed(3)}s, moves A/B=${game.moveCountA}/${game.moveCountB}`);
        }
      } catch (error) {
        controller.abort(error);
        throw error;
      }
    });
    const settled = await Promise.allSettled(pools);
    const failed = settled.find((pool) => pool.status === 'rejected');
    if (failed) throw controller.signal.reason ?? failed.reason;
    if (controller.signal.aborted) throw controller.signal.reason;
    const summary = summarize(games, options.stats);
    const output = {
      configuration: { ...options, a: filenames.A, b: filenames.B, clock: 'Date.now() - shared per-game t0; gameStart.servertime=0' },
      games, summary,
    };
    console.log(formatSummary(summary));
    if (options.out) {
      await writeFile(options.out, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
      console.log(`JSON written to ${options.out}`);
    }
    return output;
  } finally {
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.stack ?? error); process.exitCode = 1; });
}
