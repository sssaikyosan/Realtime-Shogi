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


function getUnPromotedType(type) {
    const promotedTypes = {
        prom_pawn: 'pawn',
        prom_lance: 'lance',
        prom_knight: 'prom_knight',
        prom_silver: 'silver',
        horse: 'bishop',
        dragon: 'rook'
    };
    return promotedTypes[type] || type;
}
function getPromotedType(type) {
    const promotedTypes = {
        pawn: 'prom_pawn',
        lance: 'prom_lance',
        knight: 'prom_knight',
        silver: 'prom_silver',
        bishop: 'horse',
        rook: 'dragon'
    };
    return promotedTypes[type] || type;
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
    putPieceLocal(data) {
        const { x, y, nx, ny, type, nari, teban, roomId, servertime } = data;
        const lmp = performance.now();
        if (!this.canPut(nx, ny, type, teban, servertime)) return { res: false, capture: null };
        this.komadaiPieces[teban === 1 ? 'sente' : 'gote'][type]--;

        this.map[nx][ny] = { type: type, teban: teban, lastmovetime: servertime, lastmoveptime: performance.now() };
        this.kifu.push({ x: -1, y: -1, nx: nx, ny: ny, nari: false, type: type });
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

    justMove(data, settime) {
        const { x, y, nx, ny, type, nari, teban, roomId, servertime } = data;

        if (x === -1) {
            return this.putPieceLocal(data);
        }
        const lmp = servertime;
        let cap = null;
        if (this.map[nx][ny] !== null) {
            cap = this.map[nx][ny].type
        }

        const result = { res: true, capture: cap };
        this.justMovePiece(data, result.capture, lmp);

        return result;
    }

    justMovePiece(data, capturePiece, lmp) {
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

        this.map[nx][ny] = { type: pieceType, teban: this.map[x][y].teban, lastmovetime: lmp, lastmoveptime: performance.now() };
        this.map[x][y] = null;

        //棋譜更新
        this.kifu.push({ x: x, y: y, nx: nx, ny: ny, nari: nari, teban: teban, capturePiece: capturePiece, time: servertime, captime: captime, oldtime: oldtime });
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


function isDanger(currentBoard, x, y, nx, ny, teban) {
    for (let i = -1; i < 2; i++) {
        for (let j = -1; j < 2; j++) {
            if (i === 0 && j === 0) continue;
            let attackerX = nx;
            let attackerY = ny;
            let recursive = false;
            while (true) {
                attackerX += i;
                attackerY += j;
                if (attackerX < 0 || attackerX > 8 || attackerY < 0 || attackerY > 8) break;
                const attacker = currentBoard.map[attackerX][attackerY];
                if (!attacker) {
                    recursive = true;
                    continue;
                }
                if ((attackerX === x) && (attackerY === y)) {
                    recursive = true;
                    continue;
                }

                if (attacker.teban === teban) break;
                for (const move of PIECE_MOVES[attacker.type]) {
                    if (move.dx === i && (move.dy === (j * teban))) {
                        if (recursive) {
                            if (move.recursive) return true;
                        } else {
                            return true;
                        }
                    }
                }
                break;
            }
        }
    }
    if (ny - 2 * teban >= 0 && ny - 2 * teban < 9) {
        if (nx > 0) {
            const lpiece = currentBoard.map[nx - 1][ny - 2 * teban];
            if (lpiece && lpiece.type === 'knight') return true;
        }
        if (nx < 8) {
            const rpiece = currentBoard.map[nx + 1][ny - 2 * teban];
            if (rpiece && rpiece.type === 'knight') return true;
        }
    }
    return false;
}

function isDangerPos(currentBoard, nx, ny, teban) {
    for (let i = -1; i < 2; i++) {
        for (let j = -1; j < 2; j++) {
            if (i === 0 && j === 0) continue;
            let attackerX = nx;
            let attackerY = ny;
            let recursive = false;
            while (true) {
                attackerX += i;
                attackerY += j;
                if (attackerX < 0 || attackerX > 8 || attackerY < 0 || attackerY > 8) break;
                const attacker = currentBoard.map[attackerX][attackerY];
                if (!attacker) {
                    recursive = true;
                    continue;
                }

                if (attacker.teban === teban) break;
                for (const move of PIECE_MOVES[attacker.type]) {
                    if (move.dx === i && (move.dy === (j * teban))) {
                        if (recursive) {
                            if (move.recursive) return true;
                        } else {
                            return true;
                        }
                    }
                }
                break;
            }
        }
    }
    if (ny - 2 * teban >= 0 && ny - 2 * teban < 9) {
        if (nx > 0) {
            const lpiece = currentBoard.map[nx - 1][ny - 2 * teban];
            if (lpiece && lpiece.type === 'knight') return true;
        } else if (nx < 8) {
            const rpiece = currentBoard.map[nx + 1][ny - 2 * teban];
            if (rpiece && rpiece.type === 'knight') return true;
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

    for (const move of PIECE_MOVES[selectedPiece.type]) {
        let moveX = x;
        let moveY = y;
        while (true) {
            moveX += move.dx * selectedPiece.teban;
            moveY += move.dy * selectedPiece.teban;
            if (moveX < 0 || moveX >= BOARD_SIZE || moveY < 0 || moveY >= BOARD_SIZE) break;
            const piece = currentBoard.map[moveX][moveY];
            if (piece && piece.teban === selectedPiece.teban) break;

            if (currentBoard.canPromote(y, moveY, teban, selectedPiece.type)) {
                if (selectedPiece.lastmovetime >= (servertime - MOVETIME * 1000)) {
                    pieceLegalMoves.push({
                        x: x,
                        y: y,
                        nx: moveX,
                        ny: moveY,
                        nari: true,
                        type: null,
                        teban: teban,
                        ignoretime: true
                    });
                } else {
                    pieceLegalMoves.push({
                        x: x,
                        y: y,
                        nx: moveX,
                        ny: moveY,
                        nari: true,
                        type: null,
                        teban: teban,
                        ignoretime: false
                    });
                }
            } else {
                if (currentBoard.isTopCell(moveX, moveY, selectedPiece.type, selectedPiece.teban)) break;
                if (selectedPiece.lastmovetime >= (servertime - MOVETIME * 1000)) {
                    pieceLegalMoves.push({
                        x: x,
                        y: y,
                        nx: moveX,
                        ny: moveY,
                        nari: false,
                        type: null,
                        teban: teban,
                        ignoretime: true
                    });
                } else {
                    pieceLegalMoves.push({
                        x: x,
                        y: y,
                        nx: moveX,
                        ny: moveY,
                        nari: false,
                        type: null,
                        teban: teban,
                        ignoretime: false
                    });
                }
            }

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
    if (currentBoard === null) return;
    for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
            if (currentBoard.map[i][j] === null) {
                legalPuts.push(...getPosLegalPuts(currentBoard, i, j, teban));
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
        if (currentBoard.map[item.x][item.y] === 'pawn') return false;
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
            if (PIECE_PRICES[item.type] > 800) return false;
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


function randomMove(currentBoard, servertime) {
    const cpuLegalMoves = getLegalMoves(currentBoard, -1, servertime, false);
    cpuLegalMoves.push(...getAllLegalPuts(currentBoard, -1));
    if (cpuLegalMoves.length > 0) {
        const randomIndex = Math.floor(Math.random() * cpuLegalMoves.length);
        const randomMove = cpuLegalMoves[randomIndex];
        postMessage({ move: randomMove });
    } else {
        return null;
    }
}

function evaluateMove(move) {
    for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {

        }
    }
    return 0;
}

function evaluateBoard(teban) {
    let score = 0;
    // 盤上の駒の評価
    for (let x = 0; x < BOARD_SIZE; x++) {
        for (let y = 0; y < BOARD_SIZE; y++) {
            const piece = board.map[x][y];
            if (piece) {
                const value = PIECE_PRICES[piece.type];
                if (piece.teban === 1) { // 先手の駒
                    score += value;
                } else { // 後手の駒
                    score -= value;
                }
            }
        }
    }

    // 先手の持ち駒
    for (const type of KOMADAI_TYPES) {
        score += PIECE_PRICES[type] * board.komadaiPieces['sente'][type];
    }
    score += board.komadaiPieces['sente']['king2'] * PIECE_PRICES['king2']
    // 後手の持ち駒
    for (const type of KOMADAI_TYPES) {
        score -= PIECE_PRICES[type] * board.komadaiPieces['gote'][type];
    }
    score -= board.komadaiPieces['gote']['king'] * PIECE_PRICES['king']
    return score;
}


function minimax(boardcopy, servertime, depth, isMaximizingPlayer, newMove = null) {
    // 深さが0になったか、ゲームが終了したら盤面を評価
    if (depth >= 3) {
        let val = evaluateBoard(boardcopy);
        if (newMove && isDangerPos(boardcopy, newMove.nx, newMove.ny, newMove.teban)) {
            const piece = boardcopy.map[newMove.nx][newMove.ny]
            if (piece) {
                val -= 2 * PIECE_PRICES[piece.type] * newMove.teban;
            }
        }
        return { val: val, newMove };
    }

    const legalMoves = [];
    if (depth === 1) {
        legalMoves.push(...getLegalMoves(boardcopy, isMaximizingPlayer ? 1 : -1, servertime, false));
    } else {
        legalMoves.push(...getLegalMoves(boardcopy, isMaximizingPlayer ? 1 : -1, servertime, true));
    }

    legalMoves.push(...getAllLegalPuts(boardcopy, isMaximizingPlayer ? 1 : -1))

    if (isMaximizingPlayer) { // 先手 (最大化) のターン
        let maxEval = -Infinity;
        let maxMove = null;
        for (const move of legalMoves) {
            const result = boardcopy.justMove({ ...move, servertime: servertime }); // 手を指す
            const evalpoint = minimax(boardcopy, servertime, depth + 1, false, move); // 相手のターンへ
            boardcopy.undoMove(); // 手を戻す
            if (evalpoint.val > maxEval) {
                maxMove = { x: move.x, y: move.y, nx: move.nx, ny: move.ny, nari: move.nari, type: move.type, teban: move.teban };
            }
            maxEval = Math.max(maxEval, evalpoint.val);
        }
        return { val: maxEval, move: maxMove };
    } else { // 後手 (最小化) のターン
        let minEval = Infinity;
        let minMove = null;
        for (const move of legalMoves) {
            const result = boardcopy.justMove({ ...move, servertime: servertime }); // 手を指す
            const evalpoint = minimax(boardcopy, servertime, depth + 1, true, move); // 相手のターンへ
            boardcopy.undoMove(); // 手を戻す
            minEval = Math.min(minEval, evalpoint.val);
            if (evalpoint.val < minEval) {
                minMove = { x: move.x, y: move.y, nx: move.nx, ny: move.ny, nari: move.nari, type: move.type, teban: move.teban };
            }
        }
        return { val: minEval, move: minMove };
    }
}

function findBestMove(depth, servertime) {
    let bestMove = null;
    let bestNext = null;
    const isMaximizingPlayer = false;
    let bestValue = isMaximizingPlayer ? -Infinity : Infinity;

    const boardcopy = copyBoard();
    const legalMoves = getLegalMoves(boardcopy, isMaximizingPlayer ? 1 : -1, servertime, false);
    legalMoves.push(...getAllLegalPuts(boardcopy, isMaximizingPlayer ? 1 : -1));
    if (legalMoves.length === 0) return null;

    let moveValues = [];

    for (const move of legalMoves) {
        const result = boardcopy.movePieceLocal({ ...move, servertime: servertime });

        // isMaximizingPlayerを反転させて次の手番の評価を求める
        const boardValue = minimax(boardcopy, servertime, depth + 1, isMaximizingPlayer);
        moveValues.push({ move: move, val: boardValue.val, next: boardValue.move });
        boardcopy.undoMove();
    }

    shuffleArray(moveValues);

    if (isMaximizingPlayer) { // 先手は評価値が最大のものを探す
        moveValues.sort((a, b) => b.val - a.val);
        bestValue = moveValues[0].val;
        bestMove = moveValues[0].move;
        bestNext = moveValues[0].next;
    } else {
        moveValues.sort((a, b) => a.val - b.val);
        bestValue = moveValues[0].val;
        bestMove = moveValues[0].move;
        bestNext = moveValues[0].next;

    }
    return { bestMove: bestMove, bestNext: bestNext };
}
function shuffleArray(array) {
    // 元の配列を直接変更する場合
    for (let i = array.length - 1; i > 0; i--) {
        // 0からiまでのランダムなインデックスを選択
        const j = Math.floor(Math.random() * (i + 1));

        // array[i] と array[j] を交換
        [array[i], array[j]] = [array[j], array[i]];
    }
}
function setcpu(lev) {
    //レベル０アルゴリズム（ランダムムーブ）
    if (lev === '0') {
        level0cpu();
    } else if (lev === '1') {
        level1cpu();
    } else if (lev === '2') {
        level2cpu();
    } else if (lev === '3') {
        level3cpu();
    }
}

function level0cpu() {
    setInterval(() => {
        const servertime = startTime + performance.now();
        randomMove(board, servertime);
    }, 3000);
}

function level1cpu() {
    setInterval(() => {
        const servertime = startTime + performance.now();
        if (!normalAlgolysm(board, servertime)) {
            randomMoveNoBigDanger(board, servertime);
        }
    }, 2000);
}

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

let count = 0;

function level3cpu() {
    setInterval(() => {
        const servertime = startTime + performance.now();
        normalAlgolysm(board, servertime);
    }, 100);
    setInterval(() => {
        const rand = 300 * Math.random();
        setTimeout(() => {
            const servertime = startTime + performance.now();
            // if (count === 2) {
            //     const best = findBestMove(0, servertime);
            //     if (best && best.bestMove !== null) {
            //         postMessage({ move: best.bestMove });
            //     }
            //     if (best && best.bestNext !== null) {
            //         setTimeout(() => {
            //             postMessage({ move: { ...best.bestNext, second: true } });
            //         }, 128);
            //     }
            // } else {
            randomMoveNoBigDanger(board, servertime);
            // }
            // count++;
            // if (count >= 3) count = 0;
        }, rand);
    }, 500);
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
        }, 300);

    }
};


