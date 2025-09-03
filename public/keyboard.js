import { sendPutPiece } from "./emit.js";
import { gameManager } from "./main.js";

export class Keyboard {
  keys = {
    ' ': 'pawn',
    'q': 'lance',
    'w': 'knight',
    'a': 'silver',
    's': 'gold',
    'e': 'rook',
    'd': 'bishop',
    'z': 'king',
    'x': 'king2',
  }

  init(canvas) {
    canvas.focus();
    canvas.addEventListener('keydown', (e) => {
      this.onKeyDown(e);
    });
  }

  onKeyDown(e) {
    const piecetype = this.keys[e.key];
    if (piecetype) {
      const pos = gameManager.boardUI.hoveredCell;
      if (!pos) return false;
      if (!gameManager.board.canPutPlace(pos.x, pos.y, piecetype, gameManager.teban)) return false;
      sendPutPiece(pos.x, pos.y, piecetype);
      return true;
    };
  }
}