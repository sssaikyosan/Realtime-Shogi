import { BOARD_SIZE, MOVETIME, PIECE_MOVES, UNPROMODED_TYPES } from "./const.js";
import { getPromotedType, getUnPromotedType } from "./utils.js";

export class Board {
  map = [[null, null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null, null]];
  komadaiPieces = {
    sente: { 'pawn': 0, 'lance': 0, 'knight': 0, 'silver': 0, 'gold': 0, 'bishop': 0, 'rook': 0, 'king': 0, 'king2': 0 },
    gote: { 'pawn': 0, 'lance': 0, 'knight': 0, 'silver': 0, 'gold': 0, 'bishop': 0, 'rook': 0, 'king': 0, 'king2': 0 }
  };
  kifu = [];
  reserveMoves = [];

  serverstarttime = 0;
  starttime = 0;
  time = 0;
  moveTime = { sente: MOVETIME, gote: MOVETIME }
  pawnLimit4thRank = false;

  // 盤面の初期化
  init(servertime, time, moveTime = { sente: MOVETIME, gote: MOVETIME }, pawnLimit4thRank = false) {
    this.serverstarttime = servertime;
    // this.komadaiServerTime = { sente: servertime, gote: servertime };
    // this.komadaipTime = { sente: time, gote: time };
    this.starttime = time;
    this.time = time;
    this.moveTime = { sente: moveTime.sente * 1000, gote: moveTime.gote * 1000 };
    this.pawnLimit4thRank = pawnLimit4thRank;
    this.map = [[null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null]];
    this.komadaiPieces = {
      sente: { 'pawn': 0, 'lance': 0, 'knight': 0, 'silver': 0, 'gold': 0, 'bishop': 0, 'rook': 0, 'king': 0, 'king2': 0 },
      gote: { 'pawn': 0, 'lance': 0, 'knight': 0, 'silver': 0, 'gold': 0, 'bishop': 0, 'rook': 0, 'king': 0, 'king2': 0 }
    };
    this.kifu = [];
    this.initPieces(1);
    this.initPieces(-1);
  }

  //初期配置作成用関数（歩）
  initPawnPiece(teban) {
    let y = 4 + teban * 2;
    for (let x = 0; x < 9; x++) this.setPiece(x, y, 'pawn', teban);
  }

  //初期配置作成関数
  initPieces(teban) {
    this.initPawnPiece(teban);
    let y = 4 + teban * 4;
    this.setPiece(0, y, 'lance', teban);
    this.setPiece(1, y, 'knight', teban);
    this.setPiece(2, y, 'silver', teban);
    this.setPiece(3, y, 'gold', teban);
    if (teban === 1) {
      this.setPiece(4, y, 'king', teban);
    } else {
      this.setPiece(4, y, 'king2', teban);
    }
    this.setPiece(5, y, 'gold', teban);
    this.setPiece(6, y, 'silver', teban);
    this.setPiece(7, y, 'knight', teban);
    this.setPiece(8, y, 'lance', teban);
    this.setPiece(4 + teban * 3, y - teban, 'rook', teban);
    this.setPiece(4 - teban * 3, y - teban, 'bishop', teban);
  }

  //無から駒を配置する関数
  setPiece(x, y, type, teban) {
    let tebanMoveTime = this.moveTime.sente;
    if (teban === -1) tebanMoveTime = this.moveTime.gote;
    const pieceStartTime = this.serverstarttime + 5000 - tebanMoveTime;
    const pieceStartpTime = this.starttime + 5000 - tebanMoveTime;
    this.map[x][y] = { type: type, teban: teban, lastmovetime: pieceStartTime, lastmoveptime: pieceStartpTime, reserved: false };
  }

  //駒を駒台へ移動させる関数
  returnToKomadai(type, teban) {
    this.komadaiPieces[teban === 1 ? 'sente' : 'gote'][type]++;
    return;
  }

  //指定したマスへの移動が合法手か判定
  checkMove(y, xx, yy, teban, type, nari, nteban) {
    if (this.map[xx][yy] && this.map[xx][yy].teban === nteban) return false;
    if (nari) {
      if (teban === 1 && yy > 2 && y > 2) return false;
      if (teban === -1 && yy < 6 && y < 6) return false;
    } else {
      if (this.isTopCell(xx, yy, type, teban)) return false;
    }
    return true;
  }

  //移動可能かどうか判定
  canMove(x, y, nx, ny, nari, nteban) {
    const dx = nx - x;
    const dy = ny - y;

    const piece = this.map[x][y];

    const moves = PIECE_MOVES[piece.type];
    if (!moves) return false;

    for (const move of moves) {
      if (move.dx === dx && move.dy === dy * nteban) {
        return this.checkMove(y, x + move.dx, y + move.dy * nteban, piece.teban, piece.type, nari, nteban);
      }

      // 再帰的に動きを計算
      if (move.recursive) {
        let currentX = x + move.dx;
        let currentY = y + move.dy * nteban;
        while (currentX >= 0 && currentX < BOARD_SIZE && currentY >= 0 && currentY < BOARD_SIZE) {
          if (this.map[currentX][currentY] && this.map[currentX][currentY].teban === nteban) break;
          if (currentX === nx && currentY === ny) return this.checkMove(y, currentX, currentY, piece.teban, piece.type, nari, nteban);
          if (this.map[currentX][currentY] && this.map[currentX][currentY].teban !== nteban) break;
          currentX += move.dx;
          currentY += move.dy * nteban;
          if (currentX < 0 || currentX >= BOARD_SIZE || currentY < 0 || currentY >= BOARD_SIZE) break;
        }
      }
    }

    return false;
  }

  //指定した位置に駒を打てるか判定
  canPut(x, y, type, teban, servertime) {
    // if (servertime - (teban === 1 ? this.komadaiServerTime.sente : this.komadaiServerTime.gote) < MOVETIME) return false;
    if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE || this.map[x][y]) return false;
    if (this.isTopCell(x, y, type, teban)) return false;
    if (this.isNihu(x, y, type, teban)) return false;
    return true;
  }

  //歩、香、桂は最上段（２段目）に移動できないためこの関数で判定
  isTopCell(x, y, type, teban) {
    if (type === 'pawn' || type === 'lance') {
      if (teban === 1 && y === 0 || teban === -1 && y === 8) return true;
    }
    if (type === 'knight') {
      if (teban === 1 && y <= 1 || teban === -1 && y >= 7) return true;
    }
    return false;
  }

  //二歩判定,特殊ルール判定（歩は自陣にしか打てない）
  isNihu(x, y, type, teban) {
    if (type === 'pawn') {
      for (let i = 0; i < BOARD_SIZE; i++) {
        if (this.map[x][i] && this.map[x][i].type === 'pawn' && this.map[x][i].teban === teban) return true;
      }
      if (this.pawnLimit4thRank && teban === 1 && y < 5) return true;
      if (this.pawnLimit4thRank && teban === -1 && y > 3) return true;
    }
    return false;
  }

  //成り可能判定
  canPromote(y, ny, teban, type) {
    if (!UNPROMODED_TYPES.includes(type)) return false;
    if (teban === 1 && y < 3) return true;
    if (teban === 1 && ny < 3) return true;
    if (teban === -1 && y > 5) return true;
    if (teban === -1 && ny > 5) return true;
    return false;
  }

  //サーバーから手（打つ）を受け取ったときに起動する関数
  putPieceLocal(data) {
    const { x, y, nx, ny, type, nari, teban, roomId, servertime } = data;
    const lmp = performance.now();
    if (this.komadaiPieces[teban === 1 ? 'sente' : 'gote'][type] <= 0) return { res: false, capture: null, reserve: false };
    if (!this.canPut(nx, ny, type, teban, servertime)) return { res: false, capture: null, reserve: false };
    this.komadaiPieces[teban === 1 ? 'sente' : 'gote'][type]--;

    this.map[nx][ny] = { type: type, teban: teban, lastmovetime: servertime, lastmoveptime: lmp, reserved: false };
    // this.komadaiServerTime[teban === 1 ? 'sente' : 'gote'] = servertime;
    // this.komadaipTime[teban === 1 ? 'sente' : 'gote'] = lmp;
    this.kifu.push({ x: -2 + teban, y: -2 + teban, nx: nx, ny: ny });
    return { res: true, capture: null, reserve: false };
  }

  //サーバーから手（移動）を受け取ったときに起動する関数
  movePieceLocal(data) {
    const { x, y, nx, ny, type, nari, teban, roomId, servertime } = data;

    if (x === -1) {
      return this.putPieceLocal(data);
    }
    const lmp = performance.now();

    const result = this.getCanMovePiece(x, y, nx, ny, nari, teban, servertime);
    if (result.reserve) {
      this.map[x][y].reserve = true;
      return { res: false, capture: null, reserve: true };
    }
    if (!result.res) return { res: false, capture: null, reserve: false };

    this.movePiece(data, result.capture, lmp);

    return result;
  }

  //指定した位置の駒が移動かどうか判定
  getCanMovePiece(x, y, nx, ny, nari, teban, servertime) {
    //盤上の駒を動かす場合
    if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) return { res: false, capture: null, reserve: false };
    const piece = this.map[x][y];
    let capturePiece = null;

    //nullチェック
    if (!piece) return { res: false, capture: null, reserve: false };
    if (teban !== piece.teban) return { res: false, capture: null, reserve: false };

    //成りチェック
    if (nari && !this.canPromote(y, ny, teban, piece.type)) return { res: false, capture: null, reserve: false };
    //駒の移動が可能かどうかを判定  // エラーチェック: ここでreturn
    if (!this.canMove(x, y, nx, ny, nari, teban)) return { res: false, capture: null, reserve: false };

    //時間チェック
    let tebanMoveTime = this.moveTime.sente;
    if (teban === -1) tebanMoveTime = this.moveTime.gote;
    if (servertime - piece.lastmovetime < tebanMoveTime) {
      if ((piece.lastmovetime + tebanMoveTime - servertime) < (tebanMoveTime / 5) && !piece.reserve) {
        return { res: false, capture: null, reserve: true }
      } else {
        return { res: false, capture: null, reserve: false };
      }
    }

    if (this.map[nx][ny]) capturePiece = this.map[nx][ny].type;
    return { res: true, capture: capturePiece, reserve: false };
  }

  // 駒が相手陣に入ったかどうかを判定
  isInEnemyTerritory(piece, y) {
    if (piece.teban === 1) {
      // 先手の場合、後手陣（y <= 2）に入ったか
      return y <= 2;
    } else if (piece.teban === -1) {
      // 後手の場合、先手陣（y >= 6）に入ったか
      return y >= 6;
    }
    return false;
  }

  //駒を移動させる時の処理
  movePiece(data, capturePiece, lmp) {
    const { x, y, nx, ny, type, nari, teban, roomId, servertime } = data;
    let captime = -1;
    if (capturePiece) {
      captime = this.map[nx][ny].lastmovetime;
      const unPromotedType = getUnPromotedType(capturePiece);
      this.komadaiPieces[teban === 1 ? 'sente' : 'gote'][unPromotedType]++
    }

    let pieceType = this.map[x][y].type;
    if (nari) {
      pieceType = getPromotedType(this.map[x][y].type);
    }

    this.map[nx][ny] = { type: pieceType, teban: this.map[x][y].teban, lastmovetime: servertime, lastmoveptime: lmp, reserved: false };
    this.map[x][y] = null;

    //棋譜更新
    this.kifu.push({ x, y, nx, ny, nari, teban, capturePiece, time: servertime, captime: captime });
    return true;
  }

  //勝敗判定
  checkGameEnd(data) {
    const { x, y, nx, ny, type, nari, teban, roomId, servertime } = data;

    if (this.komadaiPieces["sente"]["king2"] > 0) {
      return { player: 1, text: "game-end" };
    }
    if (this.komadaiPieces["gote"]["king"] > 0) {
      return { player: -1, text: "game-end" };
    }
    if (this.map[nx][ny].type === "king" && teban === 1 && nx === 4 && ny === 0) {
      return { player: teban, text: "try" };
    } else if (this.map[nx][ny].type === "king2" && teban === -1 && nx === 4 && ny === 8) {
      return { player: teban, text: "try" };
    }
    return { player: 0, text: "" };
  }

  undoMove() {
    if (this.kifu.length <= 0) return false;
    const lastMove = this.kifu.pop();
    this.map[lastMove.x][lastMove.y] = this.map[lastMove.nx][lastMove.ny];
    if (lastMove.capturePiece) {
      this.map[lastMove.nx][lastMove.ny] = { type: lastMove.capturePiece, teban: -lastMove.teban, lastMovetime: lastMove.captime, lastMoveptime: this.starttime, reserved: false }
    }
  }
}