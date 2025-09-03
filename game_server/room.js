// server/room.js
import { Board } from './board.js';
import { MOVETIME } from './const.js';
import { io, serverState } from './game_server.js';

export class Room {
    constructor(roomId, roomType, ownerId = null) { // ownerIdをコンストラクタに追加
        this.roomId = roomId;
        this.sente = [];
        this.gote = [];
        this.spectators = []; // 観戦者を格納する配列
        this.board = new Board(); // ゲームの盤面
        this.gameState = 'waiting'; // ゲームの状態 ('waiting', 'playing', 'finished')
        this.roomType = roomType; // 部屋の種類('rating', 'private', kento)
        this.ownerId = ownerId; // オーナーのplayer_idを保持
        this.maxplayers = 12; // 最大プレイヤー数のデフォルト値
        this.moveTime = { // 持ち時間のデフォルト値
            sente: MOVETIME,
            gote: MOVETIME
        };
        this.pawnLimit4thRank = false;
    }

    addPlayer(id, teban) {
        switch (teban) {
            case 'sente':
                if (this.roomType === 'rating' && this.sente.length >= 1) return false;
                this.sente.push(id);
                break;
            case 'gote':
                if (this.roomType === 'rating' && this.gote.length >= 1) return false;
                this.gote.push(id);
                break;
            case 'spectators':
                if (this.roomType === 'rating') return false;
                this.spectators.push(id);
                break;
            default:
                break;
        }
        if (this.roomType === 'rating' && this.sente.length === 1 && this.gote.length === 1) {
            const names = this.getPlayerNames();
            let senteRating = -999999;
            let goteRating = -999999;
            if (serverState.players[this.sente[0]].total_games >= 10) {
                senteRating = serverState.players[this.sente[0]].rating;
            }
            if (serverState.players[this.gote[0]].total_games >= 10) {
                goteRating = serverState.players[this.gote[0]].rating;
            }
            const now = performance.now();
            this.startGame(now);

            const data = {
                senteName: names.sente,
                senteRating: senteRating,
                senteCharacter: serverState.players[this.sente[0]].characterName,
                goteName: names.gote,
                goteRating: goteRating,
                goteCharacter: serverState.players[this.gote[0]].characterName,
                roomId: this.roomId,
                roomType: this.roomType,
                servertime: now,
                moveTime: this.moveTime,
                pawnLimit4thRank: this.pawnLimit4thRank
            };
            console.log("startGame", names.sente[0], senteRating, names.gote[0], goteRating);
            console.log("data", data);
            this.emitToRoom("startGame", data);
            for (const id of this.sente) {
                serverState.players[id].goToPlay(this.roomId);
            }
            for (const id of this.gote) {
                serverState.players[id].goToPlay(this.roomId);
            }
        } else if (this.roomType === 'private') {
            const names = this.getPlayerNames();
            const readys = this.getReadys();

            this.emitToRoom("roomUpdate", {
                roomId: this.roomId,
                sente: names.sente,
                gote: names.gote,
                spectators: names.spectators,
                state: this.gameState,
                readys: readys,
                maxplayers: this.maxplayers, // 設定値をブロードキャスト
                moveTime: this.moveTime,
                pawnLimit4thRank: this.pawnLimit4thRank
            });
        }
    }

    startGame(time) {
        this.board.init(time, time, this.moveTime, this.pawnLimit4thRank); // 持ち時間を設定して初期化
        this.gameState = 'playing';
    }

    handleMove(id, data) {
        let servertime = performance.now();
        let validPlayer = false;
        let result = null;
        if (this.sente.includes(id) && data.teban === 1) validPlayer = true;
        if (this.gote.includes(id) && data.teban === -1) validPlayer = true;
        if (validPlayer) result = this.board.movePieceLocal({ ...data, servertime });
        if (result && result.res) {
            this.emitToRoom("newMove", { ...data, servertime });
            let endGame = this.board.checkGameEnd(data);
            if (this.gameState === 'playing') {
                if (endGame.player !== 0) {
                    this.gameState = 'finished';
                    this.gameFinished(endGame.player, endGame.text);
                }
            }
        } else if (result && result.reserve) {
            const now = performance.now();
            const piece = this.board.map[data.x][data.y];
            let tebanMoveTime = this.board.moveTime.sente;
            if (piece.teban === -1) tebanMoveTime = this.board.moveTime.gote;
            servertime = piece.lastmovetime + tebanMoveTime;
            setTimeout(() => {
                if (this.gameState !== 'playing') {
                    io.to(id).emit("reservedMoveFailed", { ...data, servertime });
                    return
                }
                const reserveResult = this.board.movePieceLocal({ ...data, servertime });
                if (reserveResult && reserveResult.res) {
                    this.emitToRoom("newMove", { ...data, servertime });
                    let endGame = this.board.checkGameEnd(data);
                    if (this.gameState === 'playing') {
                        if (endGame.player !== 0) {
                            this.gameState = 'finished';
                            console.log('gameend', this.roomType);
                            this.gameFinished(endGame.player, endGame.text);
                        }
                    }
                } else {
                    io.to(id).emit("reservedMoveFailed", { ...data, servertime });
                }
            }, servertime - now);
            io.to(id).emit("moveReserved", { ...data, servertime });
        } else {
            io.to(id).emit("moveFailed", { ...data, servertime });
        }
    }

    //部屋への通知
    emitToRoom(type, data) {
        for (let i = 0; i < this.sente.length; i++) {
            if (!serverState.players[this.sente[i]]) continue;
            io.to(this.sente[i]).emit(type, { ...data, roomteban: 'sente', idx: i, isOwner: serverState.players[this.sente[i]].player_id === this.ownerId });
        }
        for (let i = 0; i < this.gote.length; i++) {
            if (!serverState.players[this.gote[i]]) continue;
            io.to(this.gote[i]).emit(type, { ...data, roomteban: 'gote', idx: i, isOwner: serverState.players[this.gote[i]].player_id === this.ownerId });
        }
        for (let i = 0; i < this.spectators.length; i++) {
            if (!serverState.players[this.spectators[i]]) continue;
            io.to(this.spectators[i]).emit(type, { ...data, roomteban: 'spectators', idx: i, isOwner: serverState.players[this.spectators[i]].player_id === this.ownerId });
        }
    }

    async gameFinished(win, text, playerId = null) {
        if (this.roomType === 'rating') {
            if (this.sente.length !== 1 || this.gote.length !== 1) {
                console.log('プレイ人数に不正');
                return;
            }
            const data = await serverState.ratingProcess(win, this.sente[0], this.gote[0], text);
            this.emitToRoom("endGame", data);

            if (serverState.players[this.sente[0]]) {
                serverState.players[this.sente[0]].state = 'waiting';
            }
            if (serverState.players[this.gote[0]]) {
                serverState.players[this.gote[0]].state = 'waiting';
            }

            serverState.deleteRoom(this.roomId);
        } else {
            for (const id of this.sente) {
                if (!serverState.players[id]) continue;
                serverState.players[id].state = 'waiting';
                this.spectators.push(id);
            }
            for (const id of this.gote) {
                if (!serverState.players[id]) continue;
                serverState.players[id].state = 'waiting';
                this.spectators.push(id);
            }
            this.sente = [];
            this.gote = [];

            const names = this.getPlayerNames();
            const readys = this.getReadys();

            this.emitToRoom("endRoomGame", {
                roomId: this.roomId,
                sente: names.sente,
                gote: names.gote,
                spectators: names.spectators,
                state: this.gameState,
                readys: readys,
                maxplayers: this.maxplayers,
                moveTime: this.moveTime,
                winPlayer: win,
                text: text
            });
            this.gameState = "waiting";
        }
    }

    leaveRoom(playerId) {
        let currentList = null;
        let currentIndex = -1;

        // プレイヤーがどのリストにいるかを探す
        currentIndex = this.sente.indexOf(playerId);
        if (currentIndex !== -1) {
            currentList = this.sente;
        } else {
            currentIndex = this.gote.indexOf(playerId);
            if (currentIndex !== -1) {
                currentList = this.gote;
            } else {
                currentIndex = this.spectators.indexOf(playerId);
                if (currentIndex !== -1) {
                    currentList = this.spectators;
                }
            }
        }

        // プレイヤーが見つからない場合は false を返す
        if (currentList === null) {
            return false;
        }


        if (currentList === this.sente && currentList.length === 1 && this.gameState === 'playing') {
            this.gameFinished(-1, "disconnected", playerId);
        } else if (currentList === this.gote && currentList.length === 1 && this.gameState === 'playing') {
            this.gameFinished(1, "disconnected", playerId);
        } else {
            currentList.splice(currentIndex, 1);
        }

        if (playerId === this.ownerId) {
            this.changeOwner();
        }

        if (this.gameState === "waiting") {
            this.roomUpdate();
        }

        if (this.sente.length === 0 && this.gote.length === 0 && this.spectators.length === 0) {
            serverState.deleteRoom(this.roomId);
        }
    }

    moveTeban(playerId, data) {
        if (this.gameState !== 'waiting') return false;

        let currentList = null;
        let currentIndex = -1;

        // プレイヤーがどのリストにいるかを探す
        currentIndex = this.sente.indexOf(playerId);
        if (currentIndex !== -1) {
            currentList = this.sente;
        } else {
            currentIndex = this.gote.indexOf(playerId);
            if (currentIndex !== -1) {
                currentList = this.gote;
            } else {
                currentIndex = this.spectators.indexOf(playerId);
                if (currentIndex !== -1) {
                    currentList = this.spectators;
                }
            }
        }

        // プレイヤーが見つからない場合は false を返す
        if (currentList === null) {
            return;
        }

        const newTeban = data.teban;
        let targetList = null;

        // 移動先の手番に対応するリストを決定
        switch (newTeban) {
            case 'sente':
                targetList = this.sente;
                break;
            case 'gote':
                targetList = this.gote;
                break;
            case 'spectators':
                targetList = this.spectators;
                serverState.players[playerId].state = 'waiting';
                break;
            default:
                return;
        }
        currentList.splice(currentIndex, 1);
        targetList.push(playerId);
        this.roomUpdate();
    }

    startRoomGame(id) {
        if (serverState.players[id].player_id !== this.ownerId) return false;
        const names = this.getPlayerNames();
        const now = performance.now();

        this.startGame(now);
        const data = {
            senteName: names.sente,
            senteCharacter: serverState.players[this.sente[0]].characterName,
            goteName: names.gote,
            goteCharacter: serverState.players[this.gote[0]].characterName,
            spectators: names.spectators,
            roomId: this.roomId,
            roomType: this.roomType,
            servertime: now,
            state: this.gameState,
            maxplayers: this.maxplayers,
            moveTime: this.moveTime,
            pawnLimit4thRank: this.pawnLimit4thRank
        };
        this.emitToRoom("startRoomGame", data);
        for (const id of this.sente) {
            serverState.players[id].goToPlay(this.roomId);
        }
        for (const id of this.gote) {
            serverState.players[id].goToPlay(this.roomId);
        }
        return true;
    }

    joinRoom(id) {
        // 最大プレイヤー数を超えていないかチェック
        if (this.sente.length + this.gote.length + this.spectators.length >= this.maxplayers) {
            return 'roomIsFull';
        }
        this.spectators.push(id);
        return "roomJoined"
    }

    chat(id, text) { // idを追加
        const playerName = serverState.players[id]?.name || 'Unknown'; // プレイヤー名を取得
        this.emitToRoom("chatMessage", { name: playerName, text: text });
    }

    updateSetting(id, data) {
        // オーナーであるかを確認
        if (this.ownerId === serverState.players[id].player_id) {
            // 設定を更新
            if (data.maxplayers < 2) {
                this.maxplayers = 2;
            } else if (data.maxplayers > 12) {
                this.maxplayers = 12;
            } else {
                this.maxplayers = data.maxplayers;
            }

            if (data.moveTime.sente < 0) {
                this.moveTime.sente = 0;
            } else if (data.moveTime.sente > 30) {
                this.moveTime.sente = 30;
            } else {
                this.moveTime.sente = data.moveTime.sente;
            }

            if (data.moveTime.gote < 0) {
                this.moveTime.gote = 0;
            } else if (data.moveTime.gote > 30) {
                this.moveTime.gote = 30;
            } else {
                this.moveTime.gote = data.moveTime.gote;
            }

            this.pawnLimit4thRank = data.pawnLimit4thRank;

            // 部屋の状態を部屋のメンバーにブロードキャスト（必要に応じて）
            this.cancelReady();
            this.roomUpdate(); // RoomクラスにbroadcastRoomStateメソッドがあると仮定
        } else {
            console.warn(`User ${id} is not the owner of room ${this.roomId}. Settings update denied.`);
            // オーナーでない場合はエラーをクライアントに通知することも検討
        }

    }

    roomUpdate() {
        let stayOwner = false;
        this.sente = this.sente.filter(item => {
            if (serverState.players[item]) {
                if (this.ownerId === serverState.players[item].player_id) stayOwner = true;
                return true;
            }
            return false;
        });
        this.gote = this.gote.filter(item => {
            if (serverState.players[item]) {
                if (this.ownerId === serverState.players[item].player_id) stayOwner = true;
                return true;
            }
            return false;
        });
        this.spectators = this.spectators.filter(item => {
            if (serverState.players[item]) {
                if (this.ownerId === serverState.players[item].player_id) stayOwner = true;
                return true;
            }
            return false;
        });
        if (this.sente.length === 0 && this.gote.length === 0 && this.spectators.length === 0) {
            serverState.deleteRoom(this.roomId);
        }

        if (!stayOwner) this.changeOwner();
        const names = this.getPlayerNames();
        const readys = this.getReadys();
        // 部屋設定情報も含めてブロードキャスト
        this.emitToRoom("roomUpdate", {
            roomId: this.roomId,
            sente: names.sente,
            gote: names.gote,
            spectators: names.spectators,
            state: this.gameState,
            readys: readys,
            maxplayers: this.maxplayers, // 設定値をブロードキャスト
            moveTime: this.moveTime,
            pawnLimit4thRank: this.pawnLimit4thRank
        });
    }

    changeOwner() {
        for (const id of this.spectators) {
            if (!serverState.players[id]) continue;
            if (id) this.ownerId = serverState.players[id].player_id;
        }
        for (const id of this.gote) {
            if (!serverState.players[id]) continue;
            if (id) this.ownerId = serverState.players[id].player_id;
        }
        for (const id of this.sente) {
            if (!serverState.players[id]) continue;
            if (id) this.ownerId = serverState.players[id].player_id;
        }
    }

    getReadys() {
        const readys = { sente: [], gote: [] }
        for (const id of this.sente) {
            readys.sente.push(serverState.players[id].state === 'ready');
        }

        for (const id of this.gote) {
            readys.gote.push(serverState.players[id].state === 'ready');
        }
        return readys;
    }


    backToRoom(id) {
        let roomTeban = null;
        let roomIdx = null;
        for (let i = 0; i < this.sente.length; i++) {
            if (id === this.sente[i]) {
                roomTeban = 'sente';
                roomIdx = i;
            }
        }
        for (let i = 0; i < this.gote.length; i++) {
            if (id === this.gote[i]) {
                roomTeban = 'gote';
                roomIdx = i;
            }
        }
        for (let i = 0; i < this.spectators.length; i++) {
            if (id === this.spectators[i]) {
                roomTeban = 'spectators';
                roomIdx = i;
            }
        }
        const names = this.getPlayerNames();
        const readys = this.getReadys();
        // 部屋設定情報も含めて返す
        const data = {
            roomId: this.roomId,
            sente: names.sente,
            gote: names.gote,
            spectators: names.spectators,
            state: this.gameState,
            readys: readys,
            maxplayers: this.maxplayers,
            moveTime: this.moveTime,
            roomteban: roomTeban,
            idx: roomIdx,
            isOwner: this.ownerId === serverState.players[id].player_id
        }
        return data;
    }

    getPlayerNames() {
        const senteNames = [];
        const goteNames = [];
        const spectatorsNames = [];

        for (const id of this.sente) {
            if (!serverState.players[id]) {
                continue;
            }
            senteNames.push(serverState.players[id].name);
        }
        for (const id of this.gote) {
            if (!serverState.players[id]) {
                continue;
            }
            goteNames.push(serverState.players[id].name);
        }
        for (const id of this.spectators) {
            if (!serverState.players[id]) {
                continue;
            }
            spectatorsNames.push(serverState.players[id].name);
        }
        return { sente: senteNames, gote: goteNames, spectators: spectatorsNames };
    }

    cancelReady() {
        for (const id of this.sente) {
            serverState.players[id].cancelReady();
        }
        for (const id of this.gote) {
            serverState.players[id].cancelReady();
        }
    }

    cleanup() {
        this.sente = this.sente.filter(id => serverState.players[id]);
        this.gote = this.gote.filter(id => serverState.players[id]);
        this.spectators = this.spectators.filter(id => serverState.players[id]);

        const finalPlayerCount = this.sente.length + this.gote.length + this.spectators.length;

        if (finalPlayerCount === 0) {
            serverState.deleteRoom(this.roomId);
            return;
        }
    }

    changeMode(id, roomType) {
        if (serverState.players[id].player_id !== this.ownerId) return false; // ownerをownerIdに修正
        if (roomType === 'private' || roomType === 'kento') {
            this.roomType = roomType; // roomtypeをthis.roomTypeに修正
            return true;
        } else {
            return false;
        }
    }

    resign(id) {

        if (this.sente.includes(id) && this.gameState === "playing") {
            this.gameState = 'finished';
            console.log('gameend', this.roomType);
            this.gameFinished(-1, "resign");
        } else if (this.gote.includes(id) && this.gameState === "playing") {
            this.gameState = 'finished';
            console.log('gameend', this.roomType);
            this.gameFinished(1, "resign");
        }
    }
}