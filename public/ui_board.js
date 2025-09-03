import { KomadaiUI } from "./ui_komadai.js";
import { UI } from "./ui.js";
import { gameManager, pieceImages } from "./main.js";
import { CELL_SIZE, BOARD_SIZE, BOARD_COLOR, LINE_COLOR, LINEWIDTH, MOUSE_HIGHLIGHT_COLOR, KOMADAI_OFFSET_RATIO, KOMADAI_HEIGHT, MOVETIME, TIMER_RADIUS, TIMER_LINEWIDTH, TIMER_BORDER_WIDTH, TIMER_OFFSET_X, TIMER_OFFSET_Y, TIMER_BGCOLOR, TIMER_COLOR, ARROW_COLOR, MOVE_COLOR, PIECE_MOVES, UNPROMODED_TYPES, TIMER_RESERVE_COLOR } from "./const.js";
import { sendPutPiece, sendMovePiece } from "./emit.js";

export class BoardUI extends UI {
  teban;
  board;
  komadai;

  cellSize = CELL_SIZE;
  boardSize = BOARD_SIZE;
  draggingPiece = null;
  draggingPiecePos = null;
  hoveredCell = null;
  started = false;
  lastsend = null;
  touchable = true;
  rightClicked = false;

  reserved = [];

  constructor(params) {
    super(params);
    this.width = 10000;
    this.height = 10000;
    this.board = params.board;
    let komadai = new KomadaiUI({
      x: this.x,
      y: this.y,
      board: params.board
    });
    this.komadai = komadai;
    this.teban = params.teban;

  }

  init(teban) {
    this.teban = teban;
  }

  renderSelf(ctx, scale) {
    ctx.save();
    this.drawBoard(ctx, scale);
    ctx.restore();
  }

  drawBoard(ctx, scale) {
    ctx.fillStyle = BOARD_COLOR;
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = LINEWIDTH;

    const cellSize = this.cellSize * scale;
    ctx.save()
    ctx.translate(-cellSize * this.boardSize / 2, -cellSize * this.boardSize / 2);
    ctx.fillRect(0, 0, this.boardSize * cellSize, this.boardSize * cellSize);

    // 縦線
    for (let i = 0; i <= this.boardSize; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, cellSize * 9);
      ctx.stroke();
    }

    for (let i = 0; i <= this.boardSize; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(cellSize * 9, i * cellSize);
      ctx.stroke();
    }

    ctx.restore()

    ctx.save();
    this.komadai.draw(ctx, scale, this.draggingPiece, this.teban);
    ctx.restore();

    ctx.save();

    if (this.draggingPiece) {
      this.drawMove(ctx, scale);
    }

    ctx.restore();
    ctx.save();

    if (this.teban == -1) {
      ctx.rotate(Math.PI);
    }

    // マウスオーバー中のセルをハイライト
    if (gameManager.teban !== 0 && this.hoveredCell) {
      ctx.fillStyle = MOUSE_HIGHLIGHT_COLOR;
      ctx.fillRect(
        this.hoveredCell.x * CELL_SIZE * scale + LINEWIDTH / 2 - CELL_SIZE * scale * 9 / 2,
        this.hoveredCell.y * CELL_SIZE * scale + LINEWIDTH / 2 - CELL_SIZE * scale * 9 / 2,
        CELL_SIZE * scale - LINEWIDTH,
        CELL_SIZE * scale - LINEWIDTH
      );
    }

    ctx.restore();

    ctx.save();
    if (this.teban == -1) {
      ctx.rotate(Math.PI);
    }


    // 駒を描画
    this.drawPieces(ctx, scale);

    // 矢印を描画
    this.drawArrows(ctx, scale);

    ctx.restore();

    if (this.draggingPiece) {
      this.drawDragging(ctx, scale);
    }
  }

  // マウスの位置から盤面の位置を取得
  getBoardPosition(pos) {
    const x = Math.floor(pos.x / CELL_SIZE + BOARD_SIZE / 2);
    const y = Math.floor(pos.y / CELL_SIZE + BOARD_SIZE / 2);
    let resX = 0;
    let resY = 0;

    if (x >= 0 && x < this.boardSize && y >= 0 && y < this.boardSize) {
      resX = 4 + this.teban * (x - 4);
      resY = 4 + this.teban * (y - 4);
      return { x: resX, y: resY };
    }
    return { x: -1, y: -1 };
  }

  getKomadaiPieceAt(pos) {
    const komadaiX = BOARD_SIZE * CELL_SIZE / 2 + CELL_SIZE * KOMADAI_OFFSET_RATIO;
    const komadaiY = BOARD_SIZE * CELL_SIZE / 2 - KOMADAI_HEIGHT;

    // クリック位置がどの駒の範囲内かをチェック
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 4; j++) {
        const type = this.komadai.types[i][j];
        if (!type) continue;
        if (this.board.komadaiPieces[this.teban === -1 ? 'gote' : 'sente'][type] <= 0) continue;
        if (
          pos.x >= komadaiX + j * CELL_SIZE &&
          pos.x <= komadaiX + j * CELL_SIZE + CELL_SIZE &&
          pos.y >= komadaiY + i * CELL_SIZE &&
          pos.y <= komadaiY + i * CELL_SIZE + CELL_SIZE
        ) {
          return type;
        }
      }
    }
    return null;
  }

  moveReserved(data) {
    for (const move of this.reserved) {
      if (move.x === data.x && move.y === data.y) return false;
    }
    this.reserved.push(data);
    return true;
  }

  removeSameReserved(data) {
    for (let i = 0; i < this.reserved.length; i++) {
      if (this.reserved[i].x === data.x && this.reserved[i].y === data.y && this.reserved[i].nx === data.nx && this.reserved[i].ny === data.ny) {
        this.reserved.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  removeReserved(data) {
    for (let i = 0; i < this.reserved.length; i++) {
      if (this.reserved[i].x === data.x && this.reserved[i].y === data.y) {
        this.reserved.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  onMouseDown(pos) {
    const { x, y } = this.getBoardPosition(pos);
    if (x == -1 || y == -1) {
      const komadaiPiece = this.getKomadaiPieceAt(pos);
      if (komadaiPiece) {
        this.draggingPiecePos = pos;
        this.draggingPiece = { x: -1, y: -1, type: komadaiPiece, teban: this.teban, lastmoveptime: -5000 };
        // this.board.komadaiPieces[this.board.teban === -1 ? 'gote' : 'sente'][komadaiPiece]--;
      }
    } else if (this.board.map[x][y]) {
      if (this.board.map[x][y].teban == this.teban) {
        const piece = this.board.map[x][y];
        this.draggingPiece = { x: x, y: y, type: piece.type, teban: this.teban, lastmoveptime: piece.lastmoveptime };
        this.draggingPiecePos = pos;
      }
    }
  }

  onMouseDownRight(pos) {
    this.rightClicked = true;
    const { x, y } = this.getBoardPosition(pos);
    if (x == -1 || y == -1) {
      const komadaiPiece = this.getKomadaiPieceAt(pos);
      if (komadaiPiece) {
        this.draggingPiecePos = pos;
        this.draggingPiece = { x: -1, y: -1, type: komadaiPiece, teban: this.teban, lastmoveptime: -5000 };
        // this.board.komadaiPieces[this.board.teban === -1 ? 'gote' : 'sente'][komadaiPiece]--;
      }
    } else if (this.board.map[x][y]) {
      if (this.board.map[x][y].teban == this.teban) {
        const piece = this.board.map[x][y];
        this.draggingPiece = { x: x, y: y, type: piece.type, teban: this.teban, lastmoveptime: piece.lastmoveptime };
        this.draggingPiecePos = pos;
      }
    }
  }

  onMouseMove(pos) {
    if (this.draggingPiece) {
      this.draggingPiecePos = pos;
    }
    const cell = this.getBoardPosition(pos);
    if (cell.x == -1 && cell.y == -1) {
      this.hoveredCell = null; // 盤面外ならリセット
    } else {
      this.hoveredCell = cell; // マウスオーバー中のセルを更新
    }
  }

  onMouseUp(pos) {
    if (!this.draggingPiece) return;
    const { x, y } = this.getBoardPosition(pos);
    if (this.draggingPiece.x === -1) {
      sendPutPiece(x, y, this.draggingPiece.type);
      if (gameManager.cpu === null) {
        const time = this.board.serverstarttime + performance.now() - this.board.starttime;
        const result = this.board.canPut(x, y, this.draggingPiece.type, gameManager.teban, time);
        if (result.res) {
          this.lastsend = { x: null, y: null, type: this.draggingPiece.type };
        }
      }
    } else {
      let nari = false;
      if (this.board.canPromote(this.draggingPiece.y, y, gameManager.teban, this.draggingPiece.type)) {
        nari = true;
      } this.onMouseUpRight
      sendMovePiece(this.draggingPiece.x, this.draggingPiece.y, x, y, nari);
      if (gameManager.cpu === null) {
        const time = this.board.serverstarttime + performance.now() - this.board.starttime;
        const result = this.board.getCanMovePiece(this.draggingPiece.x, this.draggingPiece.y, x, y, nari, gameManager.teban, time);
        if (result.res) {
          this.lastsend = { x: this.draggingPiece.x, y: this.draggingPiece.y, type: null };
        }
      }
    }
    this.draggingPiece = null;
    this.draggingPiecePos = null;
  }

  onMouseUpRight(pos) {
    this.rightClicked = false;
    if (!this.draggingPiece) return;
    const { x, y } = this.getBoardPosition(pos);
    if (this.draggingPiece.x === -1) {
      sendPutPiece(x, y, this.draggingPiece.type);
      if (gameManager.cpu === null) {
        const time = this.board.serverstarttime + performance.now() - this.board.starttime;
        const result = this.board.canPut(x, y, this.draggingPiece.type, gameManager.teban, time);
        if (result.res) {
          this.lastsend = { x: null, y: null, type: this.draggingPiece.type };
        }
      }
    } else {
      sendMovePiece(this.draggingPiece.x, this.draggingPiece.y, x, y, false);
      if (gameManager.cpu === null) {
        const time = this.board.serverstarttime + performance.now() - this.board.starttime;
        const result = this.board.getCanMovePiece(this.draggingPiece.x, this.draggingPiece.y, x, y, false, gameManager.teban, time);
        if (result.res) {
          this.lastsend = { x: this.draggingPiece.x, y: this.draggingPiece.y, type: null };
        }
      }
    }
    this.draggingPiece = null;
    this.draggingPiecePos = null;
  }


  drawPieceSelf(ctx, scale, piece) {
    let img = pieceImages[piece.type];
    if (img) {
      ctx.drawImage(img, -CELL_SIZE * scale / 2, -CELL_SIZE * scale / 2, CELL_SIZE * scale, CELL_SIZE * scale);
    }

    const timeDiff = performance.now() - piece.lastmoveptime;
    let tebanMoveTime = this.board.moveTime.sente;
    if (piece.teban === -1) tebanMoveTime = this.board.moveTime.gote;
    if (timeDiff < tebanMoveTime) {
      this.drawTimer(ctx, scale, timeDiff, tebanMoveTime);
    }
  };

  drawPiece(ctx, scale, x, y) {
    if (this.lastsend && x === this.lastsend.x && y === this.lastsend.y) {
      return;
    }
    const piece = this.board.map[x][y];
    if (!piece) return
    ctx.save();
    ctx.translate(CELL_SIZE * (x - 4) * scale, CELL_SIZE * (y - 4) * scale);
    if (piece.teban == -1) {
      ctx.rotate(Math.PI);
    }
    this.drawPieceSelf(ctx, scale, piece);
    ctx.restore();
  }

  drawPieces(ctx, scale) {
    for (let i = 0; i < BOARD_SIZE; i++) {
      for (let j = 0; j < BOARD_SIZE; j++) {
        if (this.draggingPiece && i === this.draggingPiece.x && j === this.draggingPiece.y) continue;
        this.drawPiece(ctx, scale, i, j);
      }
    }
  }

  drawDragging(ctx, scale) {
    ctx.save();
    ctx.translate(this.draggingPiecePos.x * scale, this.draggingPiecePos.y * scale);
    this.drawPieceSelf(ctx, scale, this.draggingPiece);
    ctx.restore();
  }

  drawTimer(ctx, scale, ptimeDiff, tebanMoveTime) {
    const radius = Math.max(0, CELL_SIZE * TIMER_RADIUS * scale);
    const lineWidth = CELL_SIZE * TIMER_LINEWIDTH * scale;
    const borderWidth = CELL_SIZE * TIMER_BORDER_WIDTH * scale;
    const progress = ptimeDiff / tebanMoveTime;

    // タイマーの背景（灰色の円）
    ctx.beginPath();
    ctx.arc(
      TIMER_OFFSET_X * CELL_SIZE * scale,
      TIMER_OFFSET_Y * CELL_SIZE * scale,
      radius, 0, Math.PI * 2, false
    );
    ctx.strokeStyle = TIMER_BGCOLOR;
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(
      TIMER_OFFSET_X * CELL_SIZE * scale,
      TIMER_OFFSET_Y * CELL_SIZE * scale,
      radius, -Math.PI / 2 - -Math.PI * 2 * (tebanMoveTime - tebanMoveTime / 5) / tebanMoveTime, -Math.PI / 2, false
    );
    ctx.strokeStyle = TIMER_RESERVE_COLOR;
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    // タイマーの進捗（青い円弧）
    ctx.beginPath();
    ctx.arc(
      TIMER_OFFSET_X * CELL_SIZE * scale,
      TIMER_OFFSET_Y * CELL_SIZE * scale,
      radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress, false
    );
    ctx.strokeStyle = TIMER_COLOR;
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    // 縁取りを描画
    ctx.beginPath();
    ctx.arc(
      TIMER_OFFSET_X * CELL_SIZE * scale,
      TIMER_OFFSET_Y * CELL_SIZE * scale,
      radius + lineWidth / 2, 0, Math.PI * 2, false
    );
    ctx.strokeStyle = TIMER_COLOR;
    ctx.lineWidth = borderWidth;
    ctx.stroke();

  }


  drawMove(ctx, scale) {
    ctx.fillStyle = MOVE_COLOR;

    function drawSquare(moveX, moveY, teban) {
      ctx.save();
      if (teban === -1) {
        ctx.rotate(Math.PI);
      }
      ctx.fillRect(
        moveX * CELL_SIZE * scale - CELL_SIZE * scale * 9 / 2 + LINEWIDTH / 2,
        moveY * CELL_SIZE * scale - CELL_SIZE * scale * 9 / 2 + LINEWIDTH / 2,
        CELL_SIZE * scale - LINEWIDTH,
        CELL_SIZE * scale - LINEWIDTH
      );
      ctx.restore();
      return false;
    }

    if (this.draggingPiece.x < 0) {
      for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
          if (this.board.map[i][j] === null) {
            if (this.board.isNihu(i, j, this.draggingPiece.type, gameManager.teban)) continue;
            if (this.board.isTopCell(i, j, this.draggingPiece.type, gameManager.teban)) continue;
            drawSquare(i, j, this.teban);
          }
        }
      }
    } else {
      for (const move of PIECE_MOVES[this.draggingPiece.type]) {
        let moveX = this.draggingPiece.x + move.dx * this.teban;
        let moveY = this.draggingPiece.y + move.dy * this.teban;
        while (moveX >= 0 && moveX < BOARD_SIZE && moveY >= 0 && moveY < BOARD_SIZE) {
          const piece = this.board.map[moveX][moveY];
          if (piece && piece.teban === this.teban) break;
          if (this.rightClicked && this.board.isTopCell(moveX, moveY, this.draggingPiece.type, gameManager.teban)) break;
          if (drawSquare(moveX, moveY, this.teban)) return true;
          if (!move.recursive) break;
          if (piece) break;
          moveX += move.dx * this.teban;
          moveY += move.dy * this.teban;
        }
      }
    }
  }

  drawArrows(ctx, scale) {
    const cellSize = CELL_SIZE * scale;
    const arrowHeadSize = cellSize * 0.4; // 矢印の先端のサイズを大きくしました

    ctx.save();
    ctx.strokeStyle = ARROW_COLOR; // 矢印の色
    ctx.lineWidth = cellSize * 0.2; // 矢印の太さ (適当に調整)
    ctx.lineCap = 'round'; // 線の端を丸くする
    // 盤面の中心を原点に移動
    ctx.translate(-cellSize * this.boardSize / 2, -cellSize * this.boardSize / 2);

    for (const move of this.reserved) {
      const startX = (move.x + 0.5) * cellSize;
      const startY = (move.y + 0.5) * cellSize;
      const endX = (move.nx + 0.5) * cellSize;
      const endY = (move.ny + 0.5) * cellSize;

      // 矢印の方向ベクトル
      const dx = endX - startX;
      const dy = endY - startY;
      const angle = Math.atan2(dy, dx);

      // 矢印の長さを計算
      const length = Math.sqrt(dx * dx + dy * dy);
      // 線の終点を三角形の手前に調整
      const adjustedEndX = endX - (dx / length) * (arrowHeadSize * 0.6); // 0.6は調整値
      const adjustedEndY = endY - (dy / length) * (arrowHeadSize * 0.6); // 0.6は調整値

      // 矢印の線を描画
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(adjustedEndX, adjustedEndY); // 調整した終点を使用
      ctx.stroke();

      // 矢印の先端（三角形）を描画
      ctx.save();
      ctx.translate(endX, endY); // 三角形は元の終点に描画
      ctx.rotate(angle);

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-arrowHeadSize, -arrowHeadSize * 2 / 3);
      ctx.lineTo(-arrowHeadSize, arrowHeadSize * 2 / 3);
      ctx.closePath();
      ctx.fillStyle = ARROW_COLOR; // 矢印の先端の色
      ctx.fill();

      ctx.restore();
    }

    ctx.restore();
  }
}
