import { io, serverState } from './game_server.js';

// 受信イベントの処理で例外が出てもプロセスを落とさない。
// Socket.IO はハンドラの例外（async の reject を含む）を受け止めないため、そのままだと
// 形の違うデータが1つ届くだけでサーバー全体が停止する
function guardSocketHandlers(socket) {
    const on = socket.on.bind(socket);
    socket.on = (event, handler) => on(event, (...args) => {
        try {
            const result = handler(...args);
            if (result && typeof result.catch === 'function') {
                result.catch((error) => console.error(`Error in socket handler "${event}":`, error));
            }
        } catch (error) {
            console.error(`Error in socket handler "${event}":`, error);
        }
    });
}

function isObject(data) {
    return data !== null && typeof data === 'object';
}

function isString(value) {
    return typeof value === 'string';
}

export function ioSetup() {
    io.on("connection", (socket) => {
        guardSocketHandlers(socket);

        // ユーザーIDを受信
        socket.on('joinRatingRoom', async (data) => {
            if (!isObject(data) || !isString(data.player_id) || data.player_id.length > 36) return;
            if (!serverState.canJoinRoom[data.player_id]) return;
            const playerInfo = await serverState.getPlayerInfo(data.player_id);
            const roomId = serverState.canJoinRoom[data.player_id].roomId;
            const teban = serverState.canJoinRoom[data.player_id].teban;
            if (!serverState.rooms[roomId]) {
                socket.emit("roomJoinFailed", { roomId: roomId, text: 'roomNotFound' });
                return;
            }
            const roomType = serverState.rooms[roomId].roomType;

            if (roomType === 'rating') {
                if (serverState.addPlayer(socket, playerInfo)) {
                    serverState.players[socket.id].setInfo(data.name, data.characterName);
                    serverState.rooms[roomId].addPlayer(socket.id, teban, data);
                }
            }
            delete serverState.canJoinRoom[data.player_id];
        });

        socket.on('joinRoom', async (data) => {
            if (!isObject(data) || !isString(data.player_id) || !isString(data.roomId) || data.player_id.length > 36) return;

            const playerInfo = await serverState.getPlayerInfo(data.player_id);
            const roomId = data.roomId;

            if (serverState.addPlayer(socket, playerInfo)) {
                serverState.players[socket.id].setInfo(data.name, data.characterName);
                const res = serverState.joinRoom(socket.id, roomId);
                if (res === "roomJoined") {
                    const room = serverState.rooms[roomId];
                    const senteNames = room.sente.map(id => serverState.players[id].name);
                    const goteNames = room.gote.map(id => serverState.players[id].name);
                    const spectatorsNames = room.spectators.map(id => serverState.players[id].name);
                    const idx = room.spectators.length - 1;
                    const isOwner = serverState.players[socket.id].player_id === room.ownerId;
                    socket.emit("roomJoined", {
                        roomId: roomId, sente: senteNames, gote: goteNames, spectators: spectatorsNames, state: room.gameState,
                        kifu: room.board.kifu,
                        maxplayers: room.maxplayers,
                        moveTime: room.moveTime,
                        roomteban: 'spectators',
                        idx: idx,
                        isOwner: isOwner
                    });
                } else {
                    socket.emit("roomJoinFailed", { roomId: roomId, text: res });
                }
            }
        });

        socket.on("leaveRoom", () => {
            serverState.leaveRoom(socket.id);
        });

        socket.on("moveTeban", (data) => {
            if (!isObject(data)) return;
            serverState.moveTeban(socket.id, data);
        });

        socket.on("startRoomGame", () => {
            serverState.startRoomGame(socket.id);
        });

        socket.on("ready", () => {
            serverState.readyToPlay(socket.id);
        });

        socket.on("cancelReady", () => {
            serverState.cancelReady(socket.id);
        });

        socket.on("chat", (data) => {
            serverState.players[socket.id]?.chat(data);
        })

        // 駒の移動を転送
        socket.on("movePiece", (data) => {
            if (!isObject(data) || !serverState.rooms[data.roomId]) {
                return;
            }
            serverState.rooms[data.roomId].handleMove(socket.id, data);
        });

        socket.on("backToRoom", () => {
            const data = serverState.backToRoom(socket.id);
            socket.emit("backToRoom", data);
        });

        // 部屋設定更新イベント
        socket.on('updateRoomSettings', (data) => {
            if (!isObject(data)) return;
            const roomId = serverState.players[socket.id]?.roomId;
            if (roomId && serverState.rooms[roomId]) {
                serverState.rooms[roomId].updateSetting(socket.id, data);
            } else {
                console.warn(`Settings update received from ${socket.id} but not in a valid room.`);
            }
        });

        // 切断時の処理
        socket.on("resign", () => {
            const roomId = serverState.players[socket.id]?.roomId;
            if (roomId && serverState.rooms[roomId]) {
                serverState.rooms[roomId].resign(socket.id);
            }
        });

        // 切断時の処理
        socket.on("disconnect", () => {
            serverState.deletePlayer(socket.id);
        });
    });
}