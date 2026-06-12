const TRADE_PRICE_MAG = 1.2;
const PIECE_PRICES = {
    pawn: 93,
    lance: 322,
    knight: 416,
    silver: 528,
    gold: 567,
    bishop: 951,
    rook: 1087,
    prom_pawn: 598,
    prom_lance: 567,
    prom_knight: 569,
    prom_silver: 582,
    horse: 1101,
    dragon: 1550,
    king: 99999,
    king2: 99999,
}

const PIECE_MOVES = {
    pawn: [
        { dx: 0, dy: -1 } // 先手の場合、1マス前
    ],
    prom_pawn: [ // 成り駒（と金）
        { dx: 1, dy: -1 },
        { dx: -1, dy: -1 },
        { dx: 0, dy: -1 },
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: 1 }
    ],
    lance: [
        { dx: 0, dy: -1, recursive: true } // 先手の場合、前方に無限
    ],
    prom_lance: [ // 成り駒（成香）
        { dx: 1, dy: -1 },
        { dx: -1, dy: -1 },
        { dx: 0, dy: -1 },
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: 1 }
    ],
    knight: [
        { dx: 1, dy: -2 },
        { dx: -1, dy: -2 }
    ],
    prom_knight: [ // 成り駒（成桂）
        { dx: 1, dy: -1 },
        { dx: -1, dy: -1 },
        { dx: 0, dy: -1 },
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: 1 }
    ],
    silver: [
        { dx: 1, dy: -1 },
        { dx: -1, dy: -1 },
        { dx: 0, dy: -1 },
        { dx: 1, dy: 1 },
        { dx: -1, dy: 1 }
    ],
    prom_silver: [ // 成り駒（成銀）
        { dx: 1, dy: -1 },
        { dx: -1, dy: -1 },
        { dx: 0, dy: -1 },
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: 1 }
    ],
    gold: [
        { dx: 1, dy: -1 },
        { dx: -1, dy: -1 },
        { dx: 0, dy: -1 },
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: 1 }
    ],
    bishop: [
        { dx: 1, dy: -1, recursive: true }, // 右上
        { dx: -1, dy: -1, recursive: true },// 左上
        { dx: 1, dy: 1, recursive: true },  // 右下
        { dx: -1, dy: 1, recursive: true }  // 左下
    ],
    horse: [ // 成り駒（馬）
        { dx: 1, dy: -1, recursive: true }, // 右上
        { dx: -1, dy: -1, recursive: true },// 左上
        { dx: 1, dy: 1, recursive: true },  // 右下
        { dx: -1, dy: 1, recursive: true }, // 左下
        { dx: 0, dy: -1 }, // 上
        { dx: 0, dy: 1 },  // 下
        { dx: 1, dy: 0 },  // 右
        { dx: -1, dy: 0 }  // 左
    ],
    rook: [
        { dx: 0, dy: -1, recursive: true }, // 上
        { dx: 0, dy: 1, recursive: true },  // 下
        { dx: 1, dy: 0, recursive: true },  // 右
        { dx: -1, dy: 0, recursive: true }  // 左
    ],
    dragon: [ // 成り駒（龍）
        { dx: 0, dy: -1, recursive: true }, // 上
        { dx: 0, dy: 1, recursive: true },  // 下
        { dx: 1, dy: 0, recursive: true },  // 右
        { dx: -1, dy: 0, recursive: true }, // 左
        { dx: 1, dy: -1 }, // 右上
        { dx: -1, dy: -1 },// 左上
        { dx: 1, dy: 1 },  // 右下
        { dx: -1, dy: 1 }  // 左下
    ],
    king: [
        { dx: 1, dy: -1 },
        { dx: -1, dy: -1 },
        { dx: 0, dy: -1 },
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: 1, dy: 1 },
        { dx: -1, dy: 1 }
    ],
    king2: [ // 相手の王将
        { dx: 1, dy: -1 },
        { dx: -1, dy: -1 },
        { dx: 0, dy: -1 },
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: 1, dy: 1 },
        { dx: -1, dy: 1 }
    ]
};

const UNPROMODED_TYPES = ['pawn', 'lance', 'knight', 'silver', 'bishop', 'rook'];
const KOMADAI_TYPES = ['pawn', 'lance', 'knight', 'silver', 'gold', 'bishop', 'rook', 'king', 'king2'];
const BOARD_SIZE = 9;
const MOVETIME = 7;

// 攻撃判定用テーブル：方向(dx,dy)→その方向に利きがあるか（O(1)参照）
// idx = (dx+1)*3 + (dy+1)。桂馬の動きは範囲外なので別処理。
const STEP_ATTACK = {};
const RAY_ATTACK = {};
for (const type in PIECE_MOVES) {
    const step = new Uint8Array(9);
    const ray = new Uint8Array(9);
    for (const move of PIECE_MOVES[type]) {
        if (move.dx < -1 || move.dx > 1 || move.dy < -1 || move.dy > 1) continue;
        const idx = (move.dx + 1) * 3 + (move.dy + 1);
        if (move.recursive) ray[idx] = 1;
        else step[idx] = 1;
    }
    STEP_ATTACK[type] = step;
    RAY_ATTACK[type] = ray;
}


const UNPROMOTE_MAP = {
    prom_pawn: 'pawn',
    prom_lance: 'lance',
    prom_knight: 'knight',
    prom_silver: 'silver',
    horse: 'bishop',
    dragon: 'rook'
};
const PROMOTE_MAP = {
    pawn: 'prom_pawn',
    lance: 'prom_lance',
    knight: 'prom_knight',
    silver: 'prom_silver',
    bishop: 'horse',
    rook: 'dragon'
};
function getUnPromotedType(type) {
    return UNPROMOTE_MAP[type] || type;
}
function getPromotedType(type) {
    return PROMOTE_MAP[type] || type;
}

class Board {
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
    // komadaiServerTime = { sente: 0, gote: 0 };
    // komadaipTime = { sente: 0, gote: 0 };
    kifu = [];

    serverstarttime = 0;
    starttime = 0;
    time = 0;
    matched = false;
    started = false;
    finished = false;

    piecePoint = 0;

    // 盤面の初期化
    init(servertime, time) {
        this.serverstarttime = servertime - MOVETIME * 1000 + 5 * 1000;
        // this.komadaiServerTime = { sente: servertime, gote: servertime };
        // this.komadaipTime = { sente: time, gote: time };
        this.starttime = performance.now() - MOVETIME * 1000 + 5 * 1000;
        this.time = time;
        this.matched = true;
        this.komadaiPieces = {
            sente: { 'pawn': 0, 'lance': 0, 'knight': 0, 'silver': 0, 'gold': 0, 'bishop': 0, 'rook': 0, 'king': 0, 'king2': 0 },
            gote: { 'pawn': 0, 'lance': 0, 'knight': 0, 'silver': 0, 'gold': 0, 'bishop': 0, 'rook': 0, 'king': 0, 'king2': 0 }
        };
        this.map = [[null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null]];
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
        this.map[x][y] = { type: type, teban: teban, lastmovetime: this.serverstarttime, lastmoveptime: this.starttime };
    }

    //指定したマスへの移動が合法手か判定
    checkMove(xx, yy, teban, type, nari, nteban) {
        if (this.map[xx][yy] && this.map[xx][yy].teban === nteban) return false;
        if (nari) {
            if (teban === 1 && yy > 2) return false;
            if (teban === -1 && yy < 6) return false;
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
                return this.checkMove(x + move.dx, y + move.dy * nteban, piece.teban, piece.type, nari, nteban);
            }

            // 再帰的に動きを計算
            if (move.recursive) {
                let currentX = x + move.dx;
                let currentY = y + move.dy * nteban;
                while (currentX >= 0 && currentX < BOARD_SIZE && currentY >= 0 && currentY < BOARD_SIZE) {
                    if (this.map[currentX][currentY] && this.map[currentX][currentY].teban === nteban) break;
                    if (currentX === nx && currentY === ny) return this.checkMove(currentX, currentY, piece.teban, piece.type, nari, nteban);
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
        if (this.komadaiPieces[teban === 1 ? 'sente' : 'gote'][type] <= 0) return false
        if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) return false;
        if (this.map[x][y] !== null) return false;
        if (this.isTopCell(x, y, type, teban)) return false;
        if (this.isNihu(x, y, type, teban)) return false;
        return true;
    }

    canPutPlace(x, y, type, teban) {
        if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) return false;
        if (this.map[x][y] !== null) return false;
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

    //二歩判定
    isNihu(x, y, type, teban) {
        if (type === 'pawn') {
            for (let i = 0; i < BOARD_SIZE; i++) {
                if (this.map[x][i] && this.map[x][i].type === 'pawn' && this.map[x][i].teban === teban) return true;
            }
            if (teban === 1 && y < 5) return true;
            if (teban === -1 && y > 3) return true;
        }
        return false;
    }

    //成り可能判定
    canPromote(y, ny, teban, type) {
        if (!UNPROMODED_TYPES.includes(type)) return false;
        if (teban === 1 && y < 3) return true;
        if (teban === 1 && ny < 3) return true;
        if (teban === -1 && y >= 6) return true;
        if (teban === -1 && ny >= 6) return true;
        return false;
    }

    //サーバーから手（打つ）を受け取ったときに起動する関数
    //settime を渡すと data.servertime の代わりに使う（探索用：スプレッド生成を避ける）
    putPieceLocal(data, settime) {
        const { x, y, nx, ny, type, nari, teban, roomId, servertime } = data;
        const st = settime !== undefined ? settime : servertime;
        if (!this.canPut(nx, ny, type, teban, st)) return { res: false, capture: null };
        this.komadaiPieces[teban === 1 ? 'sente' : 'gote'][type]--;

        this.map[nx][ny] = { type: type, teban: teban, lastmovetime: st, lastmoveptime: st };
        this.kifu.push({ x: -1, y: -1, nx: nx, ny: ny, nari: false, type: type, teban: teban });
        return { res: true, capture: null };
    }

    //サーバーから手（移動）を受け取ったときに起動する関数
    movePieceLocal(data) {
        const { x, y, nx, ny, type, nari, teban, roomId, servertime } = data;

        if (x === -1) {
            return this.putPieceLocal(data);
        }
        const lmp = performance.now();

        const result = this.getCanMovePiece(x, y, nx, ny, nari, teban, servertime);
        if (!result.res) return { res: false, capture: null };

        this.movePiece(data, result.capture, lmp);

        return result;
    }

    //settime を渡すと data.servertime の代わりに使う（探索用：スプレッド生成を避ける）
    justMove(data, settime) {
        const { x, nx, ny } = data;

        if (x === -1) {
            return this.putPieceLocal(data, settime);
        }
        const lmp = settime !== undefined ? settime : data.servertime;
        let cap = null;
        if (this.map[nx][ny] !== null) {
            cap = this.map[nx][ny].type
        }

        const result = { res: true, capture: cap };
        this.justMovePiece(data, result.capture, lmp);

        return result;
    }

    justMovePiece(data, capturePiece, lmp) {
        const { x, y, nx, ny, nari, teban } = data;
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
        const oldtime = this.map[x][y].lastmovetime;

        this.map[nx][ny] = { type: pieceType, teban: this.map[x][y].teban, lastmovetime: lmp, lastmoveptime: lmp };
        this.map[x][y] = null;

        //棋譜更新
        this.kifu.push({ x: x, y: y, nx: nx, ny: ny, nari: nari, teban: teban, capturePiece: capturePiece, time: lmp, captime: captime, oldtime: oldtime });
        return true;
    }

    //指定した位置の駒が移動かどうか判定
    getCanMovePiece(x, y, nx, ny, nari, teban, servertime) {
        //盤上の駒を動かす場合
        if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) return { res: false, capture: null };
        const piece = this.map[x][y];
        let capturePiece = null;

        //nullチェック
        if (!piece) return { res: false, capture: null };
        if (teban !== piece.teban) return { res: false, capture: null };
        //時間チェック
        if (servertime - piece.lastmovetime < MOVETIME * 1000) {
            return { res: false, capture: null };
        }
        //成りチェック
        if (nari && !this.canPromote(y, ny, teban, piece.type)) return { res: false, capture: null };
        //駒の移動が可能かどうかを判定  // エラーチェック: ここでreturn
        if (!this.canMove(x, y, nx, ny, nari, teban)) return { res: false, capture: null };

        if (this.map[nx][ny]) capturePiece = this.map[nx][ny].type;
        return { res: true, capture: capturePiece };
    }

    getCanMovePieceIgnoreTime(x, y, nx, ny, nari, teban, servertime) {
        //盤上の駒を動かす場合
        if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) return { res: false, capture: null };
        const piece = this.map[x][y];
        let capturePiece = null;

        //nullチェック
        if (!piece) return { res: false, capture: null };
        if (teban !== piece.teban) return { res: false, capture: null };
        //成りチェック
        if (nari && !this.canPromote(y, ny, teban, piece.type)) return { res: false, capture: null };
        //駒の移動が可能かどうかを判定  // エラーチェック: ここでreturn
        if (!this.canMove(x, y, nx, ny, nari, teban)) return { res: false, capture: null };

        if (this.map[nx][ny]) capturePiece = this.map[nx][ny].type;
        return { res: true, capture: capturePiece };
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
        const oldtime = this.map[x][y].lastmovetime;

        this.map[nx][ny] = { type: pieceType, teban: this.map[x][y].teban, lastmovetime: servertime, lastmoveptime: performance.now() };
        this.map[x][y] = null;

        //棋譜更新
        this.kifu.push({ x: x, y: y, nx: nx, ny: ny, nari: nari, teban: teban, capturePiece: capturePiece, time: servertime, captime: captime, oldtime: oldtime });
        return true;
    }


    checkGameEnd(data) {
        const { nx, ny, teban } = data;

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
        if (lastMove.x === -1) {
            this.komadaiPieces[lastMove.teban === 1 ? 'sente' : 'gote'][lastMove.type] += 1;
            this.map[lastMove.nx][lastMove.ny] = null;
            return true;
        }
        const lastMovePiece = this.map[lastMove.nx][lastMove.ny];
        const piece = {
            type: lastMovePiece.type,
            teban: lastMovePiece.teban,
            lastmovetime: lastMove.oldtime,
            lastmoveptime: this.starttime
        }
        if (lastMove.nari) {
            piece.type = getUnPromotedType(lastMovePiece.type);
        }
        this.map[lastMove.x][lastMove.y] = piece;
        if (lastMove.capturePiece) {
            this.map[lastMove.nx][lastMove.ny] = { type: lastMove.capturePiece, teban: -lastMove.teban, lastmovetime: lastMove.captime, lastmoveptime: this.starttime }
            this.komadaiPieces[lastMove.teban === 1 ? 'sente' : 'gote'][getUnPromotedType(lastMove.capturePiece)]--;
        } else {
            this.map[lastMove.nx][lastMove.ny] = null;
        }
        return true;
    }
}





/**
 * ＊＊＊＊＊＊＊＊＊＊＊＊＊＊
 * ＊＊＊＊＊＊＊＊＊＊＊＊＊＊
 * ＊＊＊＊＊＊＊＊＊＊＊＊＊＊
 * ここからCPUアルゴリズム実装
 * ＊＊＊＊＊＊＊＊＊＊＊＊＊＊
 * ＊＊＊＊＊＊＊＊＊＊＊＊＊＊
 * ＊＊＊＊＊＊＊＊＊＊＊＊＊＊
 */


let startTime = 0;
let board;
let cpuMoves = [];
let playerMoves = [];
let cpuKingPos = { x: 4, y: 0 };
let playerKingPos = { x: 4, y: 8 };


//(x,y)の駒が(nx,ny)へ動いたとき、移動先が敵の利きにあるか（移動元は空きマスとして扱う）
function isDanger(currentBoard, x, y, nx, ny, teban) {
    for (let i = -1; i < 2; i++) {
        for (let j = -1; j < 2; j++) {
            if (i === 0 && j === 0) continue;
            const maskIdx = (i + 1) * 3 + (j * teban + 1);
            let attackerX = nx + i;
            let attackerY = ny + j;
            let adjacent = true;
            while (attackerX >= 0 && attackerX <= 8 && attackerY >= 0 && attackerY <= 8) {
                const attacker = currentBoard.map[attackerX][attackerY];
                if (attacker && !(attackerX === x && attackerY === y)) {
                    if (attacker.teban !== teban) {
                        if (adjacent && STEP_ATTACK[attacker.type][maskIdx]) return true;
                        if (RAY_ATTACK[attacker.type][maskIdx]) return true;
                    }
                    break;
                }
                attackerX += i;
                attackerY += j;
                adjacent = false;
            }
        }
    }
    if (ny - 2 * teban >= 0 && ny - 2 * teban < 9) {
        if (nx > 0) {
            const lpiece = currentBoard.map[nx - 1][ny - 2 * teban];
            if (lpiece && lpiece.type === 'knight' && lpiece.teban !== teban) return true;
        }
        if (nx < 8) {
            const rpiece = currentBoard.map[nx + 1][ny - 2 * teban];
            if (rpiece && rpiece.type === 'knight' && rpiece.teban !== teban) return true;
        }
    }
    return false;
}

//(nx,ny)が敵の利きにあるか
function isDangerPos(currentBoard, nx, ny, teban) {
    for (let i = -1; i < 2; i++) {
        for (let j = -1; j < 2; j++) {
            if (i === 0 && j === 0) continue;
            const maskIdx = (i + 1) * 3 + (j * teban + 1);
            let attackerX = nx + i;
            let attackerY = ny + j;
            let adjacent = true;
            while (attackerX >= 0 && attackerX <= 8 && attackerY >= 0 && attackerY <= 8) {
                const attacker = currentBoard.map[attackerX][attackerY];
                if (attacker) {
                    if (attacker.teban !== teban) {
                        if (adjacent && STEP_ATTACK[attacker.type][maskIdx]) return true;
                        if (RAY_ATTACK[attacker.type][maskIdx]) return true;
                    }
                    break;
                }
                attackerX += i;
                attackerY += j;
                adjacent = false;
            }
        }
    }
    if (ny - 2 * teban >= 0 && ny - 2 * teban < 9) {
        if (nx > 0) {
            const lpiece = currentBoard.map[nx - 1][ny - 2 * teban];
            if (lpiece && lpiece.type === 'knight' && lpiece.teban !== teban) return true;
        }
        if (nx < 8) {
            const rpiece = currentBoard.map[nx + 1][ny - 2 * teban];
            if (rpiece && rpiece.type === 'knight' && rpiece.teban !== teban) return true;
        }
    }
    return false;
}

function getPieceLegalMoves(currentBoard, x, y, teban, servertime, ignoretime) {
    const pieceLegalMoves = [];
    const selectedPiece = currentBoard.map[x][y];
    if (!selectedPiece) return [];
    if (selectedPiece.teban !== teban) return [];
    if (!ignoretime && (selectedPiece.lastmovetime >= (servertime - MOVETIME * 1000))) return [];

    const onCooldown = selectedPiece.lastmovetime >= (servertime - MOVETIME * 1000);
    for (const move of PIECE_MOVES[selectedPiece.type]) {
        let moveX = x;
        let moveY = y;
        while (true) {
            moveX += move.dx * selectedPiece.teban;
            moveY += move.dy * selectedPiece.teban;
            if (moveX < 0 || moveX >= BOARD_SIZE || moveY < 0 || moveY >= BOARD_SIZE) break;
            const piece = currentBoard.map[moveX][moveY];
            if (piece && piece.teban === selectedPiece.teban) break;

            const nari = currentBoard.canPromote(y, moveY, teban, selectedPiece.type);
            if (!nari && currentBoard.isTopCell(moveX, moveY, selectedPiece.type, selectedPiece.teban)) break;
            pieceLegalMoves.push({
                x: x,
                y: y,
                nx: moveX,
                ny: moveY,
                nari: nari,
                type: null,
                teban: teban,
                ignoretime: onCooldown,
                sortScore: 0
            });

            if (!move.recursive) break;
            if (piece) break;
        }
    }
    return pieceLegalMoves;
}

// 合法手を取得する関数 (スケルトン - 要具体的な将棋ロジックの実装)
function getLegalMoves(currentBoard, teban, servertime, ignoretime) {
    const legalMoves = [];
    if (currentBoard === null) return [];
    for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
            if (currentBoard.map[i][j]) {
                legalMoves.push(...getPieceLegalMoves(currentBoard, i, j, teban, servertime, ignoretime));
            }
        }
    }
    return legalMoves;
}

function getAllLegalPuts(currentBoard, teban) {
    const legalPuts = [];
    if (currentBoard === null) return legalPuts;
    // 持っている駒種を先に絞っておく（マス毎に全駒種を調べない）
    const komadai = currentBoard.komadaiPieces[teban === 1 ? 'sente' : 'gote'];
    const availableTypes = [];
    for (const type of KOMADAI_TYPES) {
        if (type === 'king' || type === 'king2') continue;
        if (komadai[type] > 0) availableTypes.push(type);
    }
    if (availableTypes.length === 0) return legalPuts;
    for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
            if (currentBoard.map[i][j] !== null) continue;
            for (const type of availableTypes) {
                if (currentBoard.isNihu(i, j, type, teban)) continue;
                if (currentBoard.isTopCell(i, j, type, teban)) continue;
                legalPuts.push({
                    x: -1,
                    y: -1,
                    nx: i,
                    ny: j,
                    nari: false,
                    type: type,
                    teban: teban,
                    ignoretime: false,
                    sortScore: 0
                });
            }
        }
    }
    return legalPuts;
}



function copyBoard() {
    let boardcopy = new Board();
    boardcopy.serverstarttime = board.serverstarttime;
    boardcopy.starttime = board.starttime;
    for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
            if (!board.map[i][j]) continue;
            boardcopy.map[i][j] = {
                type: board.map[i][j].type,
                teban: board.map[i][j].teban, lastmovetime: board.map[i][j].lastmovetime,
                lastmoveptime: -99999
            };
        }
    }
    for (const type of KOMADAI_TYPES) {
        boardcopy.komadaiPieces['sente'][type] = board.komadaiPieces['sente'][type];
        boardcopy.komadaiPieces['gote'][type] = board.komadaiPieces['gote'][type];
    }
    // Copy kifu length for game phase detection (shallow copy sufficient)
    boardcopy.kifu = board.kifu.slice();
    return boardcopy;
}

function normalAlgolysm(currentBoard, servertime) {
    const cpuLegalMoves = getLegalMoves(currentBoard, -1, servertime, false);
    const playerLegalMoves = getLegalMoves(currentBoard, 1, servertime, true);


    const playerCaptureMoves = [];
    const playerCaptureMovesIgnoreTime = [];

    const collisionMoves = [];
    const collisionMovesIgnoreTime = [];
    const escapeMoves = [];
    const escapeMovesIgnoreTime = [];



    for (const move of cpuLegalMoves) {
        if (move.nx === playerKingPos.x && move.ny === playerKingPos.y) {
            postMessage({ move: move });
            return true;
        }
    }

    //放置すると取られる駒を検索
    for (const move of playerLegalMoves) {
        const res = board.getCanMovePieceIgnoreTime(move.x, move.y, move.nx, move.ny, move.nari, move.teban, servertime);
        if (res.capture !== null) {
            if (move.ignoretime) {
                playerCaptureMovesIgnoreTime.push({
                    x: move.x,
                    y: move.y,
                    nx: move.nx,
                    ny: move.ny,
                    nari: move.nari,
                    teban: move.teban,
                    ignoretime: move.ignoretime
                });
            } else {
                playerCaptureMoves.push({
                    x: move.x,
                    y: move.y,
                    nx: move.nx,
                    ny: move.ny,
                    nari: move.nari,
                    teban: move.teban,
                    ignoretime: move.ignoretime
                });
            }
        }
    }

    //放置すると取られる駒で駒をとれる手を検索
    for (const move of playerCaptureMoves) {
        const targetPieceMoves = getPieceLegalMoves(currentBoard, move.nx, move.ny, -1, servertime, false);
        for (const targetmove of targetPieceMoves) {
            if ((targetmove.nx === move.x) && (targetmove.ny === move.y)) {
                collisionMoves.push({
                    x: targetmove.x,
                    y: targetmove.y,
                    nx: targetmove.nx,
                    ny: targetmove.ny,
                    nari: targetmove.nari,
                    teban: targetmove.teban,
                    ignoretime: targetmove.ignoretime
                });
            };
            //放置すると取られる駒で逃げる手を検索
            if (!isDanger(currentBoard, targetmove.x, targetmove.y, targetmove.nx, targetmove.ny, -1)) {
                escapeMoves.push({
                    x: targetmove.x,
                    y: targetmove.y,
                    nx: targetmove.nx,
                    ny: targetmove.ny,
                    nari: targetmove.nari,
                    teban: targetmove.teban,
                    ignoretime: targetmove.ignoretime
                });
            }
        }
    }

    //放置すると取られる駒で駒をとれる手を検索IgnoreTime
    for (const move of playerCaptureMovesIgnoreTime) {
        const targetPieceMoves = getPieceLegalMoves(currentBoard, move.nx, move.ny, -1, servertime, false);
        for (const targetmove of targetPieceMoves) {
            if ((targetmove.nx === move.x) && (targetmove.ny === move.y)) {
                collisionMovesIgnoreTime.push({
                    x: targetmove.x,
                    y: targetmove.y,
                    nx: targetmove.nx,
                    ny: targetmove.ny,
                    nari: targetmove.nari,
                    teban: targetmove.teban,
                    ignoretime: targetmove.ignoretime
                });
            };
            //放置すると取られる駒で逃げる手を検索
            if (!isDanger(currentBoard, targetmove.x, targetmove.y, targetmove.nx, targetmove.ny, -1)) {
                escapeMovesIgnoreTime.push({
                    x: targetmove.x,
                    y: targetmove.y,
                    nx: targetmove.nx,
                    ny: targetmove.ny,
                    nari: targetmove.nari,
                    teban: targetmove.teban,
                    ignoretime: targetmove.ignoretime
                });
            }
        }
    }

    //自玉と敵駒との衝突を検索
    const kingCollisionMoves = collisionMoves.filter(item => {
        if ((item.x !== cpuKingPos.x) || (item.y !== cpuKingPos.y)) return false;
        if (!isDanger(currentBoard, item.x, item.y, item.nx, item.ny, -1)) {
            return true;
        }
        return false;
    });

    if (kingCollisionMoves.length > 0) {
        const randomIndex = Math.floor(Math.random() * kingCollisionMoves.length);
        const randomMove = kingCollisionMoves[randomIndex];
        postMessage({ move: randomMove });
        return true;
    }

    const kingCollisionMovesIgnoreTime = collisionMovesIgnoreTime.filter(item => {
        if ((item.x !== cpuKingPos.x) || (item.y !== cpuKingPos.y)) return false;
        if (!isDanger(currentBoard, item.x, item.y, item.nx, item.ny, -1)) {
            return true;
        }
        return false;
    });

    if (kingCollisionMovesIgnoreTime.length > 0) {
        const randomIndex = Math.floor(Math.random() * kingCollisionMovesIgnoreTime.length);
        const randomMove = kingCollisionMovesIgnoreTime[randomIndex];
        postMessage({ move: randomMove });
        return true;
    }

    //玉が逃げる手を検索
    const kingEscapeMoves = [];
    for (const move of escapeMoves) {
        if ((move.x === cpuKingPos.x) && (move.y === cpuKingPos.y)) {
            kingEscapeMoves.push(move);
        }
    }
    if (kingEscapeMoves.length > 0) {
        const randomIndex = Math.floor(Math.random() * kingEscapeMoves.length);
        const randomMove = kingEscapeMoves[randomIndex];
        postMessage({ move: randomMove });
        return true;
    }

    const collisionMovesKingfiltered = collisionMoves.filter(item => {
        if ((item.x !== cpuKingPos.x) || (item.y !== cpuKingPos.y)) {
            const piecePrice = PIECE_PRICES[board.map[item.x][item.y].type]
            const capPrice = PIECE_PRICES[board.map[item.nx][item.ny].type]
            if (piecePrice <= capPrice * TRADE_PRICE_MAG) {
                return true;
            }
        } else if (!isDanger(currentBoard, item.x, item.y, item.nx, item.ny, -1)) {
            return true;
        }
        return false;
    });

    //取られそうな駒で逆にとる手があれば価値計算後に指す
    if (collisionMovesKingfiltered.length > 0) {
        const randomIndex = Math.floor(Math.random() * collisionMovesKingfiltered.length);
        const randomMove = collisionMovesKingfiltered[randomIndex];
        postMessage({ move: randomMove });
        return true;
    }

    //玉が逃げる手があれば指すIgnoreTime
    const kingEscapeMovesIgnoreTime = [];
    for (const move of escapeMovesIgnoreTime) {
        if ((move.x === cpuKingPos.x) && (move.y === cpuKingPos.y)) {
            kingEscapeMovesIgnoreTime.push(move);
        }
    }
    if (kingEscapeMovesIgnoreTime.length > 0) {
        const randomIndex = Math.floor(Math.random() * kingEscapeMovesIgnoreTime.length);
        const randomMove = kingEscapeMovesIgnoreTime[randomIndex];
        postMessage({ move: randomMove });
        return true;
    }

    //駒を取れる手を検索
    const cpuCaptureMoves = [];
    for (const move of cpuLegalMoves) {
        const res = board.getCanMovePiece(move.x, move.y, move.nx, move.ny, move.nari, move.teban, servertime);
        if (res.capture !== null) {
            cpuCaptureMoves.push(move);
        }
    }

    //安全に駒をとれる手を検索
    const safetyCapMoves = [];
    for (const move of cpuCaptureMoves) {
        if (!isDanger(currentBoard, move.x, move.y, move.nx, move.ny, -1)) {
            safetyCapMoves.push(move);
        }
    }

    //安全に駒をとれる手があれば指す
    if (safetyCapMoves.length > 0) {
        const randomIndex = Math.floor(Math.random() * safetyCapMoves.length);
        const randomMove = safetyCapMoves[randomIndex];
        postMessage({ move: randomMove });
        return true;
    }

    const collisionMovesIgnoreTimeKingfiltered = collisionMovesIgnoreTime.filter(item => {
        if ((item.x !== cpuKingPos.x) || (item.y !== cpuKingPos.y)) {
            const piecePrice = PIECE_PRICES[board.map[item.x][item.y].type]
            const capPrice = PIECE_PRICES[board.map[item.nx][item.ny].type]
            if (piecePrice <= capPrice * TRADE_PRICE_MAG) {
                return true;
            }
        }
        if (!isDanger(currentBoard, item.x, item.y, item.nx, item.ny, -1)) {
            return true;
        }
        return false;
    });

    //取られそう駒で逆にとる手があれば価値計算後に指すIgnoreTime
    if (collisionMovesIgnoreTimeKingfiltered.length > 0) {
        const randomIndex = Math.floor(Math.random() * collisionMovesIgnoreTimeKingfiltered.length);
        const randomMove = collisionMovesIgnoreTimeKingfiltered[randomIndex];
        postMessage({ move: randomMove });
        return true;
    }

    const escapeMovesRemovePawn = escapeMoves.filter(item => {
        const piece = currentBoard.map[item.x][item.y];
        if (piece && piece.type === 'pawn') return false;
        return true;
    });

    //駒を逃げれる手があれば指す
    if (escapeMovesRemovePawn.length > 0) {
        const randomIndex = Math.floor(Math.random() * escapeMovesRemovePawn.length);
        const randomMove = escapeMovesRemovePawn[randomIndex];
        postMessage({ move: randomMove });
        return true;
    }
}

function getToKing(currentBoard, move) {
    if (move.x >= 0) {
        const piece = currentBoard.map[move.x][move.y];
        if (!piece) return null;
        let val = 1;
        if (piece.type === 'king' || piece.type === 'king2') {
            return val;
        }
        if (piece.type === 'rook' || piece.type === 'dragon') {
            if (move.x === playerKingPos.x || move.y === playerKingPos.y) {
                val += 16;
                return val;
            }
        }
        if (piece.type === 'bishop' || piece.type === 'horse') {
            if (move.x - playerKingPos.x === move.y - playerKingPos.y || move.x - playerKingPos.x === playerKingPos.y - move.y) {
                val += 16;
                return val;
            }
        }
        const dirX = playerKingPos.x - move.x;
        const dirNX = playerKingPos.x - move.nx;
        const dirY = playerKingPos.y - 1 - move.y;
        const dirNY = playerKingPos.y - 1 - move.ny;
        const distance = dirNX * dirNX + dirNY * dirNY;
        if (dirX * dirX > dirNX * dirNX) {
            val += 6;
            if (distance < 10) {
                val += 10 - distance;
            }
        }

        if (dirY * dirY > dirNY * dirNY) {
            val += 6;
            if (distance < 12) {
                val += 12 - distance;
            }
        }
        return val;
    } else {
        const distance = (move.nx - playerKingPos.x) * (move.nx - playerKingPos.x) + (move.ny - playerKingPos.y) * (move.ny - playerKingPos.y);
        if (distance <= 2) {
            return 1;
        }
        if (distance < 16) {
            return 20 - distance;
        }
        return 1;
    }
}

function randomMoveNoBigDanger(currentBoard, servertime) {
    const cpuLegalMoves = getLegalMoves(currentBoard, -1, servertime, false);
    //玉が危険な位置に行く手は消去
    const cpuLegalMovesKingfiltered = cpuLegalMoves.filter(item => {
        if ((item.x !== cpuKingPos.x) || (item.y !== cpuKingPos.y)) return true;
        if (!isDanger(currentBoard, item.x, item.y, item.nx, item.ny, item.teban)) return true;
        return false;
    });
    const noBigDanger = cpuLegalMovesKingfiltered.filter(item => {
        if (isDanger(currentBoard, item.x, item.y, item.nx, item.ny, item.teban)) {
            const pieceType = item.x >= 0 ? currentBoard.map[item.x][item.y].type : item.type;
            if (PIECE_PRICES[pieceType] > 800) return false;
        }
        return true;
    });


    const legalPuts = getAllLegalPuts(currentBoard, -1);
    const noBigDangerPuts = legalPuts.filter(item => {
        if (isDangerPos(currentBoard, item.nx, item.ny, item.teban)) {
            if (PIECE_PRICES[item.type] > 500) return false;
        }
        return true;
    });
    noBigDanger.push(...noBigDangerPuts);

    const toKingMoves = [];
    for (const move of noBigDanger) {
        const toKing = getToKing(currentBoard, move);
        for (let i = 0; i < toKing; i++) {
            toKingMoves.push(move);
        }
    }

    //ここまでの条件に適合する手がなければランダムに選択
    if (toKingMoves.length > 0) {
        const randomIndex = Math.floor(Math.random() * toKingMoves.length);
        const randomMove = toKingMoves[randomIndex];
        postMessage({ move: randomMove });
        return true;
    }
}


function getPosLegalPuts(currentBoard, x, y, teban) {
    let legalPuts = [];
    for (const type of KOMADAI_TYPES) {
        if (currentBoard.isNihu(x, y, type, teban)) continue;
        if (currentBoard.isTopCell(x, y, type, teban)) continue;
        if (currentBoard.komadaiPieces[teban === 1 ? 'sente' : 'gote'][type] > 0) {
            legalPuts.push({
                x: -1,
                y: -1,
                nx: x,
                ny: y,
                nari: false,
                type: type,
                teban: teban,
                ignoretime: false
            });
        }
    }
    return legalPuts;
}


// 探索パラメータ（CPUレベルに応じて setcpu で上書きされる）
let SEARCH_MAX_DEPTH = 5;
let ROOT_MOVE_LIMIT = 24;
let SEARCH_MOVE_LIMIT = 16;
let SEARCH_DEEP_MOVE_LIMIT = 10;
let SEARCH_TIME_LIMIT_MS = 250;
let PERCEPTION_DELAY_MS = 300; // 盤面変化を認識するまでの遅延（人間の知覚に相当）
const WIN_SCORE = 1000000;

function cloneMove(move) {
    return { x: move.x, y: move.y, nx: move.nx, ny: move.ny, nari: move.nari, type: move.type, teban: move.teban };
}

function getMovePieceType(currentBoard, move) {
    if (move.x === -1) return move.type;
    const piece = currentBoard.map[move.x][move.y];
    return piece ? piece.type : null;
}

function findKingPosition(currentBoard, teban) {
    for (let x = 0; x < BOARD_SIZE; x++) {
        for (let y = 0; y < BOARD_SIZE; y++) {
            const piece = currentBoard.map[x][y];
            if (piece && piece.teban === teban && (piece.type === 'king' || piece.type === 'king2')) {
                return { x, y };
            }
        }
    }
    return null;
}

//(nx,ny)に移動/打った駒typeが敵玉に王手をかけるか（O(1)〜射線走査のみ）
function givesCheck(currentBoard, move, type, enemyKing, teban) {
    if (!enemyKing) return false;
    const dx = enemyKing.x - move.nx;
    const dy = enemyKing.y - move.ny;
    if (type === 'knight') {
        return (dx === 1 || dx === -1) && dy === -2 * teban;
    }
    if (dx === 0 && dy === 0) return false;
    if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) return false;
    const sx = Math.sign(dx);
    const sy = Math.sign(dy);
    const idx = (sx * teban + 1) * 3 + (sy * teban + 1);
    const dist = Math.max(Math.abs(dx), Math.abs(dy));
    if (dist === 1) {
        return STEP_ATTACK[type][idx] === 1 || RAY_ATTACK[type][idx] === 1;
    }
    if (RAY_ATTACK[type][idx] !== 1) return false;
    // 途中に駒がないか（移動元のマスは移動後に空くので無視）
    let cx = move.nx + sx;
    let cy = move.ny + sy;
    while (cx !== enemyKing.x || cy !== enemyKing.y) {
        const p = currentBoard.map[cx][cy];
        if (p && !(cx === move.x && cy === move.y)) return false;
        cx += sx;
        cy += sy;
    }
    return true;
}

function evaluateMove(currentBoard, move, enemyKing, dangerCache, defendCache) {
    const type = getMovePieceType(currentBoard, move);
    if (!type) return -Infinity;

    let score = 0;
    const price = PIECE_PRICES[type];
    const target = currentBoard.map[move.nx][move.ny];
    if (target && target.teban !== move.teban) {
        score += PIECE_PRICES[target.type] * 12 - price;
    }
    if (move.nari) score += PIECE_PRICES[getPromotedType(type)] - price + 180;

    let dist = 0;
    if (enemyKing) {
        const dx = move.nx - enemyKing.x;
        const dy = move.ny - enemyKing.y;
        dist = dx * dx + dy * dy;
    }
    score += Math.max(0, 18 - dist) * 16;

    // 王手になる手は読みの候補として優先（詰み筋の発見率を上げる）
    if (givesCheck(currentBoard, move, type, enemyKing, move.teban)) score += 260;

    // 移動先の危険判定（同一局面内なのでマス単位でキャッシュできる）
    let danger;
    const cacheIdx = move.nx * 9 + move.ny;
    if (dangerCache[cacheIdx] !== 0) {
        danger = dangerCache[cacheIdx] === 1;
    } else {
        danger = isDangerPos(currentBoard, move.nx, move.ny, move.teban);
        dangerCache[cacheIdx] = danger ? 1 : 2;
    }
    if (danger) {
        if (move.x === -1) {
            // 打ち込みは味方の利きで支えられていれば取られても取り返せる（敵玉頭の金打ちなど）
            let defended;
            if (defendCache[cacheIdx] !== 0) {
                defended = defendCache[cacheIdx] === 1;
            } else {
                defended = isDangerPos(currentBoard, move.nx, move.ny, -move.teban);
                defendCache[cacheIdx] = defended ? 1 : 2;
            }
            score -= price * (defended ? 0.2 : 0.75);
        } else {
            score -= price * 0.75;
        }
        if (type === 'king' || type === 'king2') score -= 50000;
    }
    if (move.x === -1) {
        // 定額ボーナス：価格比例にすると大駒打ちばかりが候補上位を占め、
        // 玉の退路を抑える金銀打ちなどが読みから漏れる
        score += 80;
    }
    return score;
}

function getSearchMoves(currentBoard, teban, servertime, ignoretime, limit, randomize) {
    const legalMoves = getLegalMoves(currentBoard, teban, servertime, ignoretime);
    legalMoves.push(...getAllLegalPuts(currentBoard, teban));
    // シャッフルは指し手に多様性を持たせるためのものなのでルートだけで十分
    //（探索内部ノードは決定的な並びの方が速く、枝刈りも安定する）
    if (randomize) shuffleArray(legalMoves);
    // 評価値を先に1回だけ計算してからソート（コンパレータ内で評価すると O(n log n) 回呼ばれて重い）
    const enemyKing = findKingPosition(currentBoard, -teban);
    const dangerCache = new Int8Array(81); // 0=未計算 1=危険 2=安全
    const defendCache = new Int8Array(81); // 0=未計算 1=守りあり 2=守りなし
    for (const m of legalMoves) {
        m.sortScore = evaluateMove(currentBoard, m, enemyKing, dangerCache, defendCache);
    }
    legalMoves.sort((a, b) => b.sortScore - a.sortScore);
    if (legalMoves.length > limit) legalMoves.length = limit;
    return legalMoves;
}

//玉の守りの評価（周囲の味方駒ボーナス + 王手ペナルティ + 無闇な前進ペナルティ）
function kingSafetyScore(currentBoard, kingPos, teban) {
    let safety = 0;
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            if (i === 0 && j === 0) continue;
            const x = kingPos.x + i;
            const y = kingPos.y + j;
            if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) continue;
            const piece = currentBoard.map[x][y];
            if (piece && piece.teban === teban) safety += 25;
        }
    }
    const advance = teban === 1 ? (8 - kingPos.y) : kingPos.y;
    safety -= advance * 100;
    if (isDangerPos(currentBoard, kingPos.x, kingPos.y, teban)) safety -= 700;
    return safety;
}

// evaluateBoard用スクラッチ（リーフ毎の配列確保とGCを避ける）
const EVAL_PIECES = new Array(40);
const EVAL_XS = new Int8Array(40);
const EVAL_YS = new Int8Array(40);

function evaluateBoard(currentBoard, servertime, depth) {
    let score = 0;
    let senteKing = null;
    let goteKing = null;
    let pieceCount = 0;

    // 盤上の駒の評価
    for (let x = 0; x < BOARD_SIZE; x++) {
        const col = currentBoard.map[x];
        for (let y = 0; y < BOARD_SIZE; y++) {
            const piece = col[y];
            if (!piece) continue;
            if (piece.type === 'king' || piece.type === 'king2') {
                if (piece.teban === 1) senteKing = { x: x, y: y };
                else goteKing = { x: x, y: y };
                continue;
            }
            EVAL_PIECES[pieceCount] = piece;
            EVAL_XS[pieceCount] = x;
            EVAL_YS[pieceCount] = y;
            pieceCount++;
            const value = PIECE_PRICES[piece.type];
            const advance = piece.teban === 1 ? (8 - y) : y;
            const center = 8 - (Math.abs(4 - x) + Math.abs(4 - y));
            score += (value + advance * 9 + center * 5) * piece.teban;
        }
    }

    // 持ち駒（盤上よりわずかに高く評価：打ち込みの自由度）
    for (const type of KOMADAI_TYPES) {
        score += PIECE_PRICES[type] * 1.05 * currentBoard.komadaiPieces['sente'][type];
        score -= PIECE_PRICES[type] * 1.05 * currentBoard.komadaiPieces['gote'][type];
    }

    // 勝敗は深さで補正し、早い勝ちを優先させる
    if (!senteKing || currentBoard.komadaiPieces['gote']['king'] > 0) return -WIN_SCORE + depth;
    if (!goteKing || currentBoard.komadaiPieces['sente']['king2'] > 0) return WIN_SCORE - depth;
    // トライルール：敵陣の玉初期位置に到達したら勝ち
    if (senteKing.x === 4 && senteKing.y === 0) return WIN_SCORE - depth;
    if (goteKing.x === 4 && goteKing.y === 8) return -WIN_SCORE + depth;

    // 取られそうな駒のペナルティ
    // クールダウン中（動かした直後）の駒は逃げられないため重く見る
    for (let i = 0; i < pieceCount; i++) {
        const piece = EVAL_PIECES[i];
        const value = PIECE_PRICES[piece.type];
        const px = EVAL_XS[i];
        const py = EVAL_YS[i];
        if (!isDangerPos(currentBoard, px, py, piece.teban)) continue;
        const defended = isDangerPos(currentBoard, px, py, -piece.teban);
        const stuck = servertime - piece.lastmovetime < MOVETIME * 1000;
        let loss = 0;
        if (!defended) loss = value * 0.8;
        else if (stuck) loss = value * 0.4;
        score -= loss * piece.teban;
    }

    score += kingSafetyScore(currentBoard, senteKing, 1);
    score -= kingSafetyScore(currentBoard, goteKing, -1);
    return score;
}

//senteDouble: リアルタイム性の考慮。連続2手は基本的に割り込めない：
//相手が反応するには知覚＋判断＋入力（500ms超）が必要で、連続着手の間隔より遅い。
//割り込めるのは1手目を「一点読み」していた場合のみで、その場合の保険は
//PAIR_A_SAFETY（1手目単体でも成立する手だけをコンボにする）が担う。
//  1 = 次のsente（プレイヤー）ノードで連続手を許可（このノードの後、フラグ2を子に渡す）
//  2 = このsenteノードは連続2手目：全種の手を指せる。指さない選択も可
function alphaBeta(boardcopy, servertime, depth, maxDepth, teban, alpha, beta, deadline, senteDouble) {
    if (performance.now() > deadline || depth >= maxDepth) {
        return evaluateBoard(boardcopy, servertime, depth);
    }
    if (boardcopy.komadaiPieces['sente']['king2'] > 0) return WIN_SCORE - depth;
    if (boardcopy.komadaiPieces['gote']['king'] > 0) return -WIN_SCORE + depth;
    // トライルール
    const senteTry = boardcopy.map[4][0];
    if (senteTry && senteTry.type === 'king') return WIN_SCORE - depth;
    const goteTry = boardcopy.map[4][8];
    if (goteTry && goteTry.type === 'king2') return -WIN_SCORE + depth;

    const moveLimit = depth >= 3 ? SEARCH_DEEP_MOVE_LIMIT : SEARCH_MOVE_LIMIT;

    // 連続2手目ノード：全種の手＋「指さない」選択（depthは消費しない）
    // クールダウンを尊重するので1手目に使った駒は自動的に除外される
    if (teban === 1 && senteDouble === 2) {
        let value = alphaBeta(boardcopy, servertime, depth, maxDepth, -1, alpha, beta, deadline, 0);
        alpha = Math.max(alpha, value);
        if (alpha < beta) {
            const seconds = getSearchMoves(boardcopy, 1, servertime, false, moveLimit, false);
            for (const move of seconds) {
                const result = boardcopy.justMove(move, servertime);
                if (!result.res) continue;
                value = Math.max(value, alphaBeta(boardcopy, servertime, depth + 1, maxDepth, -1, alpha, beta, deadline, 0));
                boardcopy.undoMove();
                alpha = Math.max(alpha, value);
                if (alpha >= beta) break;
            }
        }
        return value;
    }

    // ignoretime=false: 探索内でもクールダウンを尊重する。探索の読み幅（1〜2秒）は
    // クールダウン（7秒）より短いため「木の中で一度動かした駒はもう動けない」が正確なモデル。
    // これにより「玉が王手駒を取ってそのまま逃げる」ような現実には不可能な受けを読まなくなる。
    const legalMoves = getSearchMoves(boardcopy, teban, servertime, false, moveLimit, false);
    if (legalMoves.length === 0) return evaluateBoard(boardcopy, servertime, depth);

    if (teban === 1) {
        // senteDouble=1なら次も手番を渡さず連続2手目（打ちのみ）ノードへ
        const nextTeban = senteDouble === 1 ? 1 : -1;
        const nextFlag = senteDouble === 1 ? 2 : 0;
        let value = -Infinity;
        for (const move of legalMoves) {
            const result = boardcopy.justMove(move, servertime);
            if (!result.res) continue;
            value = Math.max(value, alphaBeta(boardcopy, servertime, depth + 1, maxDepth, nextTeban, alpha, beta, deadline, nextFlag));
            boardcopy.undoMove();
            alpha = Math.max(alpha, value);
            if (alpha >= beta) break;
        }
        return value;
    }

    let value = Infinity;
    for (const move of legalMoves) {
        const result = boardcopy.justMove(move, servertime);
        if (!result.res) continue;
        value = Math.min(value, alphaBeta(boardcopy, servertime, depth + 1, maxDepth, -teban, alpha, beta, deadline, senteDouble));
        boardcopy.undoMove();
        beta = Math.min(beta, value);
        if (alpha >= beta) break;
    }
    return value;
}

// 玉の自発的な移動はこの差以上の改善があるときだけ（リアルタイムでは玉のクールダウン温存が最優先。
// 詰み回避などはWIN_SCOREスケールの差になるので必ずこの閾値を超える）
const KING_MOVE_MARGIN = 400;
// 静観（パス）判定の許容値：パスよりこの値以上悪い手しかないときだけ待つ。
// パスの木は指し手の木より総手数が1手少なく、地平線効果で±数百点の非対称が出るため、
// その範囲では「指す」側に倒す（待つのは明確に悪化する手しかない場合のみ）。
// ただし許容帯内で指せるのは「安全な手」だけ（isRootMoveSafe）。
// 歩の突き捨てのような小さな損は許容帯に紛れ込むため、値だけでは弾けない。
const WAIT_TOLERANCE = 250;

//許容帯内で指してよい「安全な手」か判定する
//・同等以上の駒を取る手は安全（交換が成立）
//・移動先に敵の利きがなければ安全
//・利きがあっても味方の守りがあり、駒が安ければ安全（歩の交換など）
//・それ以外（タダ捨てになる手）は不可
function isRootMoveSafe(currentBoard, move) {
    const moverType = move.x === -1 ? move.type : currentBoard.map[move.x][move.y].type;
    const moverPrice = PIECE_PRICES[moverType];
    const target = currentBoard.map[move.nx][move.ny];
    if (target && PIECE_PRICES[target.type] * TRADE_PRICE_MAG >= moverPrice) return true;
    const attacked = move.x === -1
        ? isDangerPos(currentBoard, move.nx, move.ny, move.teban)
        : isDanger(currentBoard, move.x, move.y, move.nx, move.ny, move.teban);
    if (!attacked) return true;
    // 移動元を除いた味方の守りがあるか
    const defended = move.x === -1
        ? isDangerPos(currentBoard, move.nx, move.ny, -move.teban)
        : isDanger(currentBoard, move.x, move.y, move.nx, move.ny, -move.teban);
    if (defended && moverPrice <= 200) return true;
    return false;
}

// ===== 連続2手プラン（コンボ）の設計 =====
// 事前に決めた2手を続けて入力する場合、間隔は入力速度だけで決まり
// （打ち＝ショートカットで速い、盤上手＝通常入力）、相手の反応
// （知覚＋判断＋入力で500ms超）より速い。よって一点読みされていない限り
// 連続2手は手の種類を問わず割り込まれない。相手側の連続2手も同条件でsenteDoubleとして常に読む。
const PAIR_MARGIN = 120;       // 連続2手プランが単手より明確に良いと判断する閾値
const PAIR_A_CANDIDATES = 4;   // 連続手の1手目に試すルート候補数
const PAIR_B_LIMIT = 6;        // 連続手の2手目候補数
const PAIR_TIME_RATIO = 0.35;  // 思考時間のうち連続手探索に確保する割合
// 「相手がこちらの1手目を読んでいた場合」だけコンボは割り込まれる。その場合でも
// 1手目単体が成立している（パスと比べて大損しない）プランだけを採用する＝読まれた時の保険。
// 読まれていなければコンボの上振れ、読まれていれば単手として成立、のどちらでも損しない。
const PAIR_A_SAFETY = 150;

//反復深化探索：時間いっぱいまで徐々に深く読む
//玉を動かす手は「パス（何もしない）」より明確に良いときだけ採用する。
//玉のクールダウンを温存しておかないと、王手された瞬間に逃げられず負けるため。
function findBestMove(servertime) {
    const boardcopy = copyBoard();
    const rootMoves = getSearchMoves(boardcopy, -1, servertime, false, ROOT_MOVE_LIMIT, true);
    if (rootMoves.length === 0) return null;

    const kingPos = findKingPosition(boardcopy, -1);
    const isKingMove = (move) => kingPos !== null && move.x === kingPos.x && move.y === kingPos.y;

    // 思考時間を単手探索（反復深化）と連続2手プラン探索に分割
    const startNow = performance.now();
    const fullDeadline = startNow + SEARCH_TIME_LIMIT_MS;
    const idDeadline = startNow + SEARCH_TIME_LIMIT_MS * (1 - PAIR_TIME_RATIO);

    let bestAny = null;
    let bestAnyValue = Infinity;
    let bestNonKing = null;
    let bestNonKingValue = Infinity;
    let passValueFinal = Infinity;
    let lastDepth = 0;
    let lastValues = null; // 完了した最終深さでの全ルート手の値（連続手プランの候補選びに使う）

    for (let depth = 2; depth <= SEARCH_MAX_DEPTH; depth++) {
        let curBest = null;
        let curBestValue = Infinity;
        let curNonKing = null;
        let curNonKingValue = Infinity;
        let aborted = false;
        const curValues = [];

        // パス基準値：CPUが指さず相手だけが動いた場合の評価（連続手モデルも同一条件）
        const passValue = alphaBeta(boardcopy, servertime, 1, depth, 1, -Infinity, Infinity, idDeadline, 1);
        const passComplete = performance.now() <= idDeadline;

        for (const move of rootMoves) {
            if (performance.now() > idDeadline) {
                aborted = true;
                break;
            }
            const result = boardcopy.justMove(move, servertime);
            if (!result.res) continue;

            // CPU is gote, so lower board scores are better.
            // senteDouble=1: プレイヤーはCPUの応手を待たず連続2手で咎めてくる可能性を読む
            const boardValue = alphaBeta(boardcopy, servertime, 1, depth, 1, -Infinity, curBestValue, idDeadline, 1);
            boardcopy.undoMove();
            curValues.push({ move: move, value: boardValue });
            if (boardValue < curBestValue || !curBest) {
                curBestValue = boardValue;
                curBest = move;
            }
            if (!isKingMove(move) && (boardValue < curNonKingValue || !curNonKing)) {
                curNonKingValue = boardValue;
                curNonKing = move;
            }
        }

        if (aborted || !curBest) {
            // 反復が中断しても、前回最善手を先頭に並べて深く再探索済みなので
            // 完了したルート手までの部分結果は有効（深い反復に使った時間を無駄にしない）
            if (curBest && passComplete) {
                bestAny = curBest;
                bestAnyValue = curBestValue;
                bestNonKing = curNonKing;
                bestNonKingValue = curNonKingValue;
                passValueFinal = passValue;
            }
            break;
        }

        bestAny = curBest;
        bestAnyValue = curBestValue;
        bestNonKing = curNonKing;
        bestNonKingValue = curNonKingValue;
        passValueFinal = passValue;
        lastDepth = depth;
        lastValues = curValues;
        // 前回の最善手を先頭に置くと次の反復で枝刈りが効きやすい
        const idx = rootMoves.indexOf(curBest);
        if (idx > 0) {
            rootMoves.splice(idx, 1);
            rootMoves.unshift(curBest);
        }
        if (performance.now() > idDeadline) break;
    }

    if (!bestAny) return null;
    // 勝ち筋（トライ・王取り）が見えていれば必ず指す
    if (bestAnyValue < -WIN_SCORE / 2) return { bestMove: cloneMove(bestAny), bestNext: null };

    // ===== 連続2手プラン探索 =====
    // 前提：相手が反応するには知覚＋判断＋入力（500ms超）が必要なため、
    // 連続2手は手の種類を問わず基本的に割り込まれない。
    // 例外は相手が1手目を「一点読み」していた場合のみ。その保険として、
    // 1手目単体でも成立する（パスと比べて大損しない）プランだけを候補にする。
    let pair = null;
    if (lastValues && lastDepth >= 2) {
        const sorted = lastValues.slice().sort((a, b) => a.value - b.value);
        let pairBestValue = Infinity;
        let tried = 0;
        for (const cand of sorted) {
            if (tried >= PAIR_A_CANDIDATES) break;
            if (performance.now() > fullDeadline) break;
            if (isKingMove(cand.move)) continue;            // 玉はコンボに使わない（温存）
            if (cand.value > passValueFinal + PAIR_A_SAFETY) continue; // 読まれた場合の保険
            tried++;
            const resA = boardcopy.justMove(cand.move, servertime);
            if (!resA.res) continue;
            // 2手目候補（クールダウン尊重：1手目に使った駒は除外。取った駒の即打ちも含む）
            const bMoves = getSearchMoves(boardcopy, -1, servertime, false, PAIR_B_LIMIT, false);
            for (const b of bMoves) {
                if (performance.now() > fullDeadline) break;
                if (kingPos && b.x === kingPos.x && b.y === kingPos.y) continue; // 玉は温存
                const resB = boardcopy.justMove(b, servertime);
                if (!resB.res) continue;
                // A+Bで2手消費する分、単手探索と同じ地平線になるよう1段深く読む
                const v = alphaBeta(boardcopy, servertime, 2, lastDepth + 1, 1, -Infinity, pairBestValue, fullDeadline, 1);
                boardcopy.undoMove();
                if (v < pairBestValue) {
                    pairBestValue = v;
                    pair = { a: cand.move, b: b, value: v };
                }
            }
            boardcopy.undoMove();
        }
    }

    // 連続2手が単手・パスより明確に良ければ2手セットで指す
    if (pair && pair.value < Math.min(bestAnyValue, passValueFinal) - PAIR_MARGIN) {
        return { bestMove: cloneMove(pair.a), bestNext: cloneMove(pair.b) };
    }
    // 値の良い順に「指してよい手」を探す：
    //  ・パスより明確に良い手はそのまま指す
    //  ・許容帯（地平線ノイズの範囲）の手は安全な手だけ指す（歩の突き捨て等を除外）
    //  ・玉の手は別ゲート（王手時は逃げ優先、平時は大きな改善があるときだけ）
    const kingInDanger = kingPos !== null && isDangerPos(boardcopy, kingPos.x, kingPos.y, -1);
    const candidates = (lastValues && lastValues.length > 0)
        ? lastValues.slice().sort((a, b) => a.value - b.value)
        : [{ move: bestAny, value: bestAnyValue }];
    for (const cand of candidates) {
        if (cand.value >= passValueFinal + WAIT_TOLERANCE) break; // 以降はさらに悪い手のみ
        if (isKingMove(cand.move)) {
            if (kingInDanger ? cand.value < passValueFinal + WAIT_TOLERANCE
                : cand.value < passValueFinal - KING_MOVE_MARGIN) {
                return { bestMove: cloneMove(cand.move), bestNext: null };
            }
            continue;
        }
        if (cand.value < passValueFinal || isRootMoveSafe(boardcopy, cand.move)) {
            return { bestMove: cloneMove(cand.move), bestNext: null };
        }
    }
    return { bestMove: null, wait: true };
}
function shuffleArray(array) {
    // 元の配列を直接変更する場合
    for (let i = array.length - 1; i > 0; i--) {
        // 0からiまでのランダムなインデックスを選択
        const j = Math.floor(Math.random() * (i + 1));

        // array[i] と array[j] を交換（分割代入は一時配列を生成して遅いので使わない）
        const tmp = array[i];
        array[i] = array[j];
        array[j] = tmp;
    }
}
function setcpu(lev) {
    if (lev === '0' || lev === '1') {
        level1cpu();
    } else if (lev === '2') {
        level2cpu();
    } else if (lev === '4') {
        level4cpu();
    } else if (lev === '5') {
        level5cpu();
    } else {
        level3cpu(); // 不明な値は中間レベルにフォールバック
    }
}

//反応層＋探索層をまとめて起動する共通関数
//連続2手プランの2手目の着手間隔(ms)：
//  comboDropDelay: 駒打ち（ショートカット入力なので速い）
//  comboMoveDelay: 盤上の駒を動かす手（通常の入力速度）
//どちらも事前に決めてある手なので、相手の「知覚＋判断＋入力」（500ms超）より速く着手できる。
function startSearchCpu(reactiveInterval, searchInterval, searchDelayRand, comboDropDelay, comboMoveDelay) {
    setInterval(() => {
        const servertime = startTime + performance.now();
        normalAlgolysm(board, servertime);
    }, reactiveInterval);
    setInterval(() => {
        const rand = searchDelayRand * Math.random();
        setTimeout(() => {
            const servertime = startTime + performance.now();
            const best = findBestMove(servertime);
            if (best && best.bestMove !== null) {
                postMessage({ move: best.bestMove });
                if (best.bestNext) {
                    const next = best.bestNext;
                    const delay = next.x === -1 ? comboDropDelay : comboMoveDelay;
                    setTimeout(() => {
                        postMessage({ move: next });
                    }, delay);
                }
            } else if (best === null) {
                randomMoveNoBigDanger(board, servertime);
            }
            // best.wait === true のときは指さずに静観（クールダウンを温存して反応に備える）
        }, rand);
    }, searchInterval);
}

//レベル1：反応が遅く、読みなし（入門向け）
function level1cpu() {
    setInterval(() => {
        const servertime = startTime + performance.now();
        if (!normalAlgolysm(board, servertime)) {
            randomMoveNoBigDanger(board, servertime);
        }
    }, 2000);
}

//レベル2：反応は速いが読みなし
function level2cpu() {
    setInterval(() => {
        const servertime = startTime + performance.now();
        normalAlgolysm(board, servertime);
    }, 400);
    setInterval(() => {
        const rand = 1000 * Math.random();
        setTimeout(() => {
            const servertime = startTime + performance.now();
            randomMoveNoBigDanger(board, servertime);
        }, rand);
    }, 1000);
}

// ===== 反応速度の設計 =====
// CPUの反応・連続手の速度は基本的に人間と同等にする（超人的な反応はさせない）。
//   実効反応速度 ≈ 知覚遅延(PERCEPTION_DELAY_MS) + 反応間隔
//   レベル5でも合計 ≈ 250ms（反応の速い人間相当）
// 連続2手は「事前に決めた手を続けて入力するだけ」なので反応とは別物：
//   打ち＝ショートカット入力（速い）、盤上手＝通常入力。どちらも相手の
//   知覚＋判断＋入力（500ms超）より速く、一点読みされない限り割り込まれない。

//レベル3：浅い読み（2手）＋ゆっくりした反応（約500ms）
function level3cpu() {
    SEARCH_MAX_DEPTH = 2;
    SEARCH_TIME_LIMIT_MS = 100;
    ROOT_MOVE_LIMIT = 16;
    SEARCH_MOVE_LIMIT = 12;
    SEARCH_DEEP_MOVE_LIMIT = 8;
    PERCEPTION_DELAY_MS = 300;
    startSearchCpu(200, 900, 200, 220, 500);
}

//レベル4：中程度の読み（反復深化・最大4手）＋平均的な人間の反応（約400ms）
function level4cpu() {
    SEARCH_MAX_DEPTH = 4;
    SEARCH_TIME_LIMIT_MS = 200;
    ROOT_MOVE_LIMIT = 22;
    SEARCH_MOVE_LIMIT = 14;
    SEARCH_DEEP_MOVE_LIMIT = 10;
    PERCEPTION_DELAY_MS = 280;
    startSearchCpu(120, 550, 100, 180, 380);
}

//レベル5：深い読み（最大6手）＋速い人間相当の反応・速いサイクル
//思考時間を増やしすぎるとワーカーがブロックされて実効反応がかえって落ちるため、
//思考は250msに抑えつつ、読みの深さ・思考サイクル・反応・知覚・連続着手すべてでL4を上回る設計
function level5cpu() {
    SEARCH_MAX_DEPTH = 6;
    SEARCH_TIME_LIMIT_MS = 250;
    ROOT_MOVE_LIMIT = 24;
    SEARCH_MOVE_LIMIT = 16;
    SEARCH_DEEP_MOVE_LIMIT = 10;
    PERCEPTION_DELAY_MS = 200;
    startSearchCpu(50, 450, 0, 130, 280);
}

// メインスレッドからのメッセージを受信
onmessage = function (e) {
    if (e.data[0] === "gameStart") {
        const data = e.data[1];
        board = new Board();
        startTime = data.servertime;
        board.init(data.servertime, performance.now());
        setcpu(data.level);
    }

    if (e.data[0] === "move") {
        const move = e.data[1];
        setTimeout(() => {
            board.justMove(move);
            if (move.x === cpuKingPos.x && move.y === cpuKingPos.y) {
                cpuKingPos = { x: move.nx, y: move.ny };
            } else if (move.x === playerKingPos.x && move.y === playerKingPos.y) {
                playerKingPos = { x: move.nx, y: move.ny };
            }
        }, PERCEPTION_DELAY_MS);

    }
};


