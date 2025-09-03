import { CELL_SIZE, KOMADAI_WIDTH, KOMADAI_HEIGHT, BOARD_SIZE, KOMADAI_OFFSET_RATIO, BOARD_COLOR, LINE_COLOR, KOMADAI_TIMER_SIZE, KOMADAI_TIMER_LINEWITH, MOVETIME, KOMADAI_TIMER_COLOR, KOMADAI_TIMER_OFFSET_X, KOMADAI_TIMER_OFFSET_Y } from "./const.js";
import { ctx, gameManager, pieceImages } from "./main.js";
import { drawText, drawTextWithDoubleOutline } from "./utils.js";

export class KomadaiUI {
  cellSize = CELL_SIZE;
  constructor(params) {
    this.x = params.x;
    this.y = params.y;
    this.board = params.board;
  }
  types = [
    ['pawn', null, null],
    ['lance', 'knight', 'rook'],
    ['silver', 'gold', 'bishop'],
    ['king', 'king2', null]];

  draw(ctx, scale, draggingPiece, viewteban) {
    this.width = KOMADAI_WIDTH * scale;
    this.height = KOMADAI_HEIGHT * scale;
    this.drawKomadai(ctx, scale, 'sente', draggingPiece, viewteban);
    this.drawKomadai(ctx, scale, 'gote', draggingPiece, viewteban);
  }


  drawKomadai(ctx, scale, teban, draggingPiece, viewteban) {
    const x = BOARD_SIZE * CELL_SIZE * scale / 2 + CELL_SIZE * KOMADAI_OFFSET_RATIO * scale;
    const y = BOARD_SIZE * CELL_SIZE * scale / 2 - KOMADAI_HEIGHT * scale;
    const myteban = viewteban === -1 ? 'gote' : 'sente';
    ctx.fillStyle = BOARD_COLOR; // 駒台の色
    ctx.save();
    if (teban !== myteban) ctx.rotate(Math.PI);
    ctx.strokeStyle = LINE_COLOR;
    ctx.fillRect(x, y, this.width, this.height);
    ctx.strokeRect(x, y, this.width, this.height);

    if (myteban === teban) this.drawKeyText(ctx, scale, x, y);
    // const ptimeDiff = performance.now() - komadaipTime[teban];
    // this.drawKomadaiTimer(ctx, scale, ptimeDiff);
    this.drawKomadaiPieces(x, y, scale, this.board.komadaiPieces[teban], draggingPiece, teban, myteban);
    ctx.restore();
  }

  drawKomadaiPieces(x, y, scale, komadai, draggingPiece, teban, myteban) {
    const komadaiOffsetX = x + CELL_SIZE * KOMADAI_OFFSET_RATIO * scale;
    const komadaiOffsetY = y + CELL_SIZE * KOMADAI_OFFSET_RATIO * scale;
    ctx.translate(komadaiOffsetX, komadaiOffsetY);
    for (let i = 0; i < 4; i++) {
      ctx.save();
      for (let j = 0; j < 3; j++) {
        if (this.types[i][j]) {
          this.drawKomadaiPiece(this.types[i][j], komadai, scale, draggingPiece, teban, myteban);
          ctx.translate(CELL_SIZE * scale, 0);
        };
      }
      ctx.restore();
      ctx.translate(0, CELL_SIZE * scale);
    }
  }

  // 駒台の駒を描画
  drawKomadaiPiece(type, komadai, scale, draggingPiece, teban, myteban) {
    const img = pieceImages[type];
    const pieceSize = CELL_SIZE * 0.8 * scale;
    const padding = CELL_SIZE * KOMADAI_OFFSET_RATIO * scale;
    let drag = 0;
    if (draggingPiece !== null && draggingPiece.x === -1 && draggingPiece.type === type && teban === myteban) {
      drag = 1;
    } else if (gameManager.boardUI.lastsend !== null && gameManager.boardUI.lastsend.type === type && teban === myteban) {
      drag = 1;
    };
    for (let i = 0; i < (komadai[type] - drag); i++) {
      ctx.drawImage(img, (komadai[type] - i - 1) * padding, 0, pieceSize, pieceSize);
    }
  }

  onMouseDown(pos) {
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 3; j++) {
        if (pos.x / 2 > i * this.cellSize && pos.x / 2 < (i + 1) * this.cellSize &&
          pos.y > j * this.cellSize && pos.y < (j + 1) * this.cellSize) {
          if (this.types[i][j]) {
            this.board.draggingPiece = this.board.komadaiPieces[this.board.teban][this.types[i][j]];
          }
        }
      }
    }
  }

  onMouseDownRight(pos) {
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 3; j++) {
        if (pos.x / 2 > i * this.cellSize && pos.x / 2 < (i + 1) * this.cellSize &&
          pos.y > j * this.cellSize && pos.y < (j + 1) * this.cellSize) {
          if (this.types[i][j]) {
            this.board.draggingPiece = this.board.komadaiPieces[this.board.teban][this.types[i][j]];
          }
        }
      }
    }
  }

  drawKomadaiTimer(ctx, scale, ptimeDiff) {
    if (ptimeDiff >= MOVETIME) return;
    const radius = Math.max(0, KOMADAI_TIMER_SIZE * scale);
    const lineWidth = KOMADAI_TIMER_SIZE * KOMADAI_TIMER_LINEWITH * scale;
    const progress = ptimeDiff / MOVETIME;
    // タイマーの進捗（青い円弧）
    ctx.beginPath();
    ctx.arc(
      KOMADAI_TIMER_OFFSET_X * scale,
      KOMADAI_TIMER_OFFSET_Y * scale,
      radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress, false
    );
    ctx.strokeStyle = KOMADAI_TIMER_COLOR;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  drawKeyText(ctx, scale, x, y) {
    const textColor = "rgb(227, 191, 91)"
    const offsetX = x + CELL_SIZE * scale * 0.5;
    const offsetY = y + CELL_SIZE * scale * 0.5;
    const textCell = CELL_SIZE * scale;
    drawText(ctx, "Space", offsetX + textCell * 0.5, offsetY, textCell * 0.5, [textColor], 'middle', 'center');
    drawText(ctx, "Q", offsetX, y + textCell * 1.5, CELL_SIZE * scale * 0.5, [textColor], 'middle', 'center');
    drawText(ctx, "W", offsetX + textCell, y + textCell * 1.5, CELL_SIZE * scale * 0.5, [textColor], 'middle', 'center');
    drawText(ctx, "E", offsetX + textCell * 2, y + textCell * 1.5, CELL_SIZE * scale * 0.5, [textColor], 'middle', 'center');
    drawText(ctx, "A", offsetX, y + textCell * 2.5, CELL_SIZE * scale * 0.5, [textColor], 'middle', 'center');
    drawText(ctx, "S", offsetX + textCell, y + textCell * 2.5, CELL_SIZE * scale * 0.5, [textColor], 'middle', 'center');
    drawText(ctx, "D", offsetX + textCell * 2, y + textCell * 2.5, CELL_SIZE * scale * 0.5, [textColor], 'middle', 'center');
  }
}