export function wilsonInterval(wins, games) {
  if (!games) return [0, 1];
  const z = 1.959963984540054;
  const p = wins / games;
  const denominator = 1 + z * z / games;
  const center = (p + z * z / (2 * games)) / denominator;
  const margin = z * Math.sqrt(p * (1 - p) / games + z * z / (4 * games * games)) / denominator;
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
}

export function summarize(games, stats = false) {
  const sum = (field) => games.reduce((total, game) => total + game[field], 0);
  const aWins = games.filter((game) => game.winner === 'A').length;
  const bWins = games.filter((game) => game.winner === 'B').length;
  const totalSeconds = sum('seconds');
  const summary = {
    games: games.length,
    aWins,
    bWins,
    draws: games.length - aWins - bWins,
    aWinRate: games.length ? aWins / games.length : 0,
    aWinRate95CI: wilsonInterval(aWins, games.length),
    aWinRateDefinition: 'A wins / all games (draws are non-wins); Wilson 95% interval',
    averageSeconds: games.length ? totalSeconds / games.length : 0,
    moveCountA: sum('moveCountA'),
    moveCountB: sum('moveCountB'),
    movesPerMinuteA: totalSeconds ? sum('moveCountA') * 60 / totalSeconds : 0,
    movesPerMinuteB: totalSeconds ? sum('moveCountB') * 60 / totalSeconds : 0,
    rejectedCountA: sum('rejectedCountA'),
    rejectedCountB: sum('rejectedCountB'),
  };
  if (stats) {
    summary.quietMoveCountA = sum('quietMoveCountA');
    summary.quietMoveCountB = sum('quietMoveCountB');
  }
  return summary;
}

export function formatSummary(summary) {
  const percent = (value) => `${(value * 100).toFixed(2)}%`;
  const [low, high] = summary.aWinRate95CI;
  const lines = [
    `Games: ${summary.games}; A wins: ${summary.aWins}; B wins: ${summary.bWins}; draws: ${summary.draws}`,
    `A win rate (all games): ${percent(summary.aWinRate)}; Wilson 95% CI: [${percent(low)}, ${percent(high)}]`,
    `Average game length: ${summary.averageSeconds.toFixed(3)} s`,
    `Applied moves: A ${summary.moveCountA}; B ${summary.moveCountB}`,
    `Average moves/minute: A ${summary.movesPerMinuteA.toFixed(2)}; B ${summary.movesPerMinuteB.toFixed(2)}`,
    `Rejected moves: A ${summary.rejectedCountA}; B ${summary.rejectedCountB}`,
  ];
  if ('quietMoveCountA' in summary) {
    lines.push(`Quiet moves: A ${summary.quietMoveCountA}; B ${summary.quietMoveCountB}`);
  }
  return lines.join('\n');
}
