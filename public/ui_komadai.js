import { MOUSE_HIGHLIGHT_COLOR, CELL_SIZE, KOMADAI_WIDTH, KOMADAI_HEIGHT, BOARD_SIZE, KOMADAI_OFFSET_RATIO, BOARD_COLOR, LINE_COLOR, KOMADAI_TIMER_SIZE, KOMADAI_TIMER_LINEWITH, MOVETIME, KOMADAI_TIMER_COLOR, KOMADAI_TIMER_OFFSET_X, KOMADAI_TIMER_OFFSET_Y } from "./const.js";
import { ctx, gameManager, pieceImages } from "./main.js";
import { drawText, drawTextWithDoubleOutline } from "./utils.js";

// 縦画面用の駒台（PC版と同じ並びの駒台を、盤の右下＝自分・左上＝相手に置く）
// 寸法は盤の中心からのゲーム内座標。portraitScale で駒台だけ縮小できる
export const KOMADAI_PORTRAIT_GAP = CELL_SIZE * 0.15;

export class KomadaiUI {
  cellSize = CELL_SIZE;
  // 'side': 盤の横に置く（横画面） / 'portrait': 盤の右下（自分）・左上（相手）に置く（縦画面）
  layout = 'side';
  // 縦画面で駒台だけを縮小する倍率（画面の高さが足りないとき用）
  portraitScale = 1;
  // 自分の駒台に持ち駒を打つキー（Space, Q など）を表示するか（リプレイでは出さない）
  showKeys = true;
  constructor(params) {
    this.x = params.x;
    this.y = params.y;
    this.board = params.board;
    this.owner = params.owner ?? null; // この駒台を持つ盤（BoardUI）
  }
  types = [
    ['pawn', null, null],
    ['lance', 'knight', 'rook'],
    ['silver', 'gold', 'bishop'],
    ['king', 'king2', null]];

  draw(ctx, scale, draggingPiece, viewteban, selectedType = null) {
    if (this.layout === 'portrait') {
      this.drawPortraitKomadai(ctx, scale, 'sente', draggingPiece, viewteban, selectedType);
      this.drawPortraitKomadai(ctx, scale, 'gote', draggingPiece, viewteban, selectedType);
      return;
    }
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

    if (myteban === teban && this.showKeys) this.drawKeyText(ctx, scale, x, y);
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
    } else if ((this.owner ?? gameManager.boardUI).lastsend?.type === type && teban === myteban) {
      drag = 1;
    };
    for (let i = 0; i < (komadai[type] - drag); i++) {
      ctx.drawImage(img, (komadai[type] - i - 1) * padding, 0, pieceSize, pieceSize);
    }
  }

  getPortraitRect(mine) {
    const width = KOMADAI_WIDTH * this.portraitScale;
    const height = KOMADAI_HEIGHT * this.portraitScale;
    const boardHalf = BOARD_SIZE * CELL_SIZE / 2;
    return {
      x: mine ? boardHalf - width : -boardHalf,
      y: mine ? boardHalf + KOMADAI_PORTRAIT_GAP : -boardHalf - KOMADAI_PORTRAIT_GAP - height,
      width: width,
      height: height
    };
  }

  // 自分側の駒台で pos にある駒の種類を返す（並びはPC版と同じ）
  getPortraitPieceAt(pos, komadai) {
    const rect = this.getPortraitRect(true);
    if (pos.x < rect.x || pos.x > rect.x + rect.width || pos.y < rect.y || pos.y > rect.y + rect.height) return null;
    const padding = CELL_SIZE * KOMADAI_OFFSET_RATIO;
    const localX = (pos.x - rect.x) / this.portraitScale - padding;
    const localY = (pos.y - rect.y) / this.portraitScale - padding;
    const row = Math.min(this.types.length - 1, Math.max(0, Math.floor(localY / CELL_SIZE)));
    // 歩は1段目に横へ重ねて並ぶので、1段目ならどこを触っても歩
    const col = row === 0 ? 0 : Math.min(2, Math.max(0, Math.floor(localX / CELL_SIZE)));
    const type = this.types[row][col];
    if (!type || komadai[type] <= 0) return null;
    return type;
  }

  drawPortraitKomadai(ctx, scale, teban, draggingPiece, viewteban, selectedType) {
    const myteban = viewteban === -1 ? 'gote' : 'sente';
    const mine = teban === myteban;
    const rect = this.getPortraitRect(mine);
    const s = scale * this.portraitScale;
    const width = KOMADAI_WIDTH * s;
    const height = KOMADAI_HEIGHT * s;
    ctx.save();
    // 駒台の中心で回転させ、相手の駒台はPC版と同じく逆さまに表示する
    ctx.translate((rect.x + rect.width / 2) * scale, (rect.y + rect.height / 2) * scale);
    if (!mine) ctx.rotate(Math.PI);
    const x = -width / 2;
    const y = -height / 2;
    ctx.fillStyle = BOARD_COLOR;
    ctx.strokeStyle = LINE_COLOR;
    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);
    if (mine && selectedType) {
      // タップで選択中の持ち駒のマスを強調
      const padding = CELL_SIZE * KOMADAI_OFFSET_RATIO * s;
      this.types.forEach((row, i) => row.forEach((type, j) => {
        if (type !== selectedType) return;
        ctx.fillStyle = MOUSE_HIGHLIGHT_COLOR;
        ctx.fillRect(x + padding + j * CELL_SIZE * s, y + padding + i * CELL_SIZE * s, CELL_SIZE * s * 0.8, CELL_SIZE * s * 0.8);
      }));
    }
    this.drawKomadaiPieces(x, y, s, this.board.komadaiPieces[teban], draggingPiece, teban, myteban);
    ctx.restore();
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