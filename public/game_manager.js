// public/game_manager.js
import { BoardUI } from './ui_board.js';
import { audioManager } from './main.js'; // audio_manager.jsからインポート
import { Board } from './board.js';
import { CPU } from './cpu.js'; // CPUクラスをインポート
import { endGame } from './scene_game.js';
import { MOVETIME } from './const.js';

export class GameManager {
    roomId;
    teban = null;
    cpu = null; // CPUインスタンスを保持するプロパティ

    board;
    boardUI;
    state = 'waiting';

    constructor() {
        const board = new Board();
        this.board = board;
        this.boardUI = new BoardUI({ gameManager: this, board: board, x: 0.0, y: 0.0 })
    }

    setRoom(roomId, teban, servertime, moveTime, pawnLimit4thRank, cpulevel = null) {
        const now = performance.now();
        this.roomId = roomId;
        this.teban = teban;

        const board = new Board();
        this.board = board;
        this.boardUI = new BoardUI({ gameManager: this, board: board, x: 0.0, y: 0.0 });
        this.board.init(servertime, now, moveTime, pawnLimit4thRank);
        this.boardUI.init(teban);

        if (cpulevel !== null) {
            this.cpu = new CPU(this, cpulevel); // GameManager自身をCPUに渡す
            this.cpu.gameStart(servertime, now);
        }
    }

    setRoomBoard(roomId, board) {
        this.roomId = roomId;
        this.teban = 0;

        this.board = board;
        this.boardUI = new BoardUI({ gameManager: this, board: board, x: 0.0, y: 0.0 })
        this.boardUI.init(0);
        this.cpu = null;
    }

    resetRoom() {
        this.roomId = null;
        this.teban = 0;
        if (this.cpu) {
            this.cpu.worker.terminate();
        }
        this.cpu = null;
    }


    receiveMove(move) {
        this.boardUI.lastsend = null;
        const result = this.board.movePieceLocal(move);
        if (result.res) {
            if (this.boardUI.draggingPiece) {
                if (move.nx === this.boardUI.draggingPiece.x && move.ny === this.boardUI.draggingPiece.y) {
                    this.boardUI.draggingPiece = null;
                    this.boardUI.draggingPiecePos = null;
                } else if (move.type && move.teban === this.teban && this.board.komadaiPieces[move.teban === 1 ? 'sente' : 'gote'][move.type] === 0 && this.boardUI.draggingPiece.type === move.type) {
                    this.boardUI.draggingPiece = null;
                }
            }
            audioManager.playSound("sound");

            const gameEnd = this.board.checkGameEnd(move);

            if (gameEnd.player !== 0 && this.cpu !== null) {
                endGame({ winPlayer: gameEnd.player, text: gameEnd.text });
            }

            // リアルタイム将棋では手番に関係なく思考が必要になる可能性があるため、
            // プレイヤーの手が適用されたら常にCPUに盤面変化を通知
            if (this.cpu !== null) {
                this.cpu.boardChanged(move); // 盤面情報をワーカーに送信
            }

            return true;
        } else if (result.reserve) {
            const now = performance.now();
            const piece = this.board.map[move.x][move.y];
            let tebanMoveTime = this.board.moveTime.sente;
            if (piece.teban === -1) tebanMoveTime = this.board.moveTime.gote;
            const servertime = piece.lastmovetime + tebanMoveTime;
            setTimeout(() => {
                const reserveResult = this.board.movePieceLocal({ ...move, servertime });
                if (reserveResult && reserveResult.res) {
                    if (this.boardUI.draggingPiece) {
                        if (move.nx === this.boardUI.draggingPiece.x && move.ny === this.boardUI.draggingPiece.y) {
                            this.boardUI.draggingPiece = null;
                            this.boardUI.draggingPiecePos = null;
                        } else if (move.type && move.teban === this.teban && this.board.komadaiPieces[move.teban === 1 ? 'sente' : 'gote'][move.type] === 0 && this.boardUI.draggingPiece.type === move.type) {
                            this.boardUI.draggingPiece = null;
                        }
                    }
                    audioManager.playSound("sound");
                    this.boardUI.removeReserved(move);
                    const gameEnd = this.board.checkGameEnd(move);
                    if (gameEnd.player !== 0 && this.cpu !== null) {
                        endGame({ winPlayer: gameEnd.player, text: gameEnd.text });
                        this.cpu = null;
                    }
                    if (this.cpu !== null) {
                        this.cpu.boardChanged({ ...move, servertime }); // 盤面情報をワーカーに送信
                    }
                } else {
                    this.boardUI.removeSameReserved(move);
                }
            }, servertime - now);
            this.boardUI.moveReserved(move);
        }
        return false;
    }

    // Web WorkerからCPUの手を受け取るメソッド
    handleCpuMove(move) {
        const now = performance.now();
        const serverMove = { ...move, servertime: now }
        const result = this.board.movePieceLocal(serverMove);
        if (result.res) {
            audioManager.playSound("sound"); // 効果音

            if (this.boardUI.draggingPiece) {
                if ((move.nx === this.boardUI.draggingPiece.x) && (move.ny === this.boardUI.draggingPiece.y)) {
                    this.boardUI.draggingPiece = null;
                    this.boardUI.draggingPiecePos = null;
                }
            }
            const gameEnd = this.board.checkGameEnd(serverMove);
            if (gameEnd.player !== 0 && this.cpu !== null) {
                endGame({ winPlayer: gameEnd.player, text: gameEnd.text });
            } else {
                this.cpu.boardChanged(serverMove);
            }
        } else {
            console.error("GameManager: CPUの手の適用に失敗しました。", serverMove);
            // エラーハンドリング
        }
    }


    update() {
        const time = performance.now();
        if (!this.board.finished) {
            this.board.time = time;
        }
        if (this.board.matched && !this.board.started && !this.board.finished && this.board.time - this.board.starttime > 5000) {
            this.board.started = true;
        }
    }
}