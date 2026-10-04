# Headless real-time CPU self-play

Run from the repository root with Node 22. No packages, servers, browser, database,
or frontend build are needed. Worker inputs are trusted classic JavaScript scripts;
the VM supplies browser globals for compatibility, not security isolation.

```powershell
node scripts/cpu_selfplay/run.js --a public/worker.js --levelA 5 --b public/worker.js --levelB 5 --games 40 --parallel 6 --maxSeconds 300 --stats --out scripts/cpu_selfplay/result.json
node scripts/cpu_selfplay/run.js --a public/worker.js --levelA 3 --b public/worker.js --levelB 3 --games 4 --parallel 4 --maxSeconds 120
node scripts/cpu_selfplay/run.js --a public/worker.js --levelA 5 --b public/worker.js --levelB 1 --games 4
node --test scripts/cpu_selfplay/selfplay.test.js
```

Use `--help` for defaults. Paths are relative to the current directory, except a
bare output filename: `--out result.json` writes `scripts/cpu_selfplay/result.json`.
Other `--out` paths must also be under `scripts/cpu_selfplay/`, matching this task's
write scope; the command may replace an existing result file. Levels are sent as strings because `worker.js`
selects them with strict string comparisons. A plays sente in the first game,
then sides alternate. Games use actual elapsed time, with the existing five-second
opening wait and seven-second piece cooldown. The time limit includes worker startup.

Each game starts two independent Node worker threads. `worker_adapter.js` runs the
source as a classic script, forwards browser-shaped messages, and supplies timers
and `performance.now() = Date.now() - t0`. The same per-game `t0` is supplied to
both threads and used by the arbiter. `gameStart.servertime` and initial board time
are zero, so the AI's `startTime + performance.now()` equals the arbiter clock.
The authoritative board's separate `lastmoveptime` is bookkeeping; validation uses
the shared `servertime` and `lastmovetime`. No time acceleration is used.

Since each AI assumes it is gote, sente sees a 180-degree rotation: board
coordinates become `(8-x, 8-y)`, `teban` changes sign, and `king`/`king2` swap.
The transform works in both directions, preserves timestamps and other move
fields, and leaves drop source sentinels (`x = -1`, including their `y`) alone.
The initial board is symmetric under this transform. Tests check every legal
opening gote move, drops, king try, and a live CPU's first mirrored move.

`game_server/board.js` arbitrates every move. Only `res === true` counts. Applied
moves are echoed to both AIs in their own perspectives, including their own moves.
Rejections (including reserves) return `moveRejected` only to the sender; reserves
are never scheduled. Games finish on king capture, try, or timeout. Errors abort
the run and terminate all active threads; Ctrl+C does the same. There are no
silent error-forfeit results. The arbiter enforces the sending side and checks
coordinate shape before calling the board.

Progress goes to stderr; the summary goes to stdout. JSON includes configuration,
ordered per-game results, and the summary. Winners are `A`, `B`, or `draw`;
reasons are `king-capture`, `try`, or `timeout`. Counts include applied moves only;
separate rejected counts help diagnose stale-board races. With `--stats`, quiet
moves are applied board moves onto an empty square by a non-king piece (including
promotions); captures, drops, and king moves are excluded.

A win rate is **A wins / all games**: draws count as non-wins. The 95% interval is
the Wilson binomial interval. Moves per minute are total applied moves divided by
total game minutes, separately for A and B, rather than averaging per-game rates.
Games are stochastic and performance depends on CPU load; small samples are
sanity checks, not reliable strength estimates. Both sides retain the worker's
opponent-perception delay, so occasional stale-board rejections are expected.
The board allows a drop without a prior hand cooldown, but the newly dropped
piece receives `lastmovetime` and therefore has a cooldown before moving again.

The recorded sanity runs are in `sanity-l3.json` and `sanity-l5-v-l1.json`.
