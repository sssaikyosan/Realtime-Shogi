// A 180-degree rotation is its own inverse. Keep drop sentinels off the board.
export function mirrorMove(move) {
  const mirrored = { ...move, nx: 8 - move.nx, ny: 8 - move.ny, teban: -move.teban };
  if (move.x !== -1) {
    mirrored.x = 8 - move.x;
    mirrored.y = 8 - move.y;
  }
  if (move.type === 'king') mirrored.type = 'king2';
  else if (move.type === 'king2') mirrored.type = 'king';
  return mirrored;
}

export function inPerspective(move, side) {
  return side === 1 ? mirrorMove(move) : { ...move };
}
