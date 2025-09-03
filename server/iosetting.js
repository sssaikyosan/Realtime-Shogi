import { io, serverState } from './server.js';

export function ioSetup() {
    io.on("connection", (socket) => {

        // プレイヤーがマッチングを要求（ユーザー登録も兼ねる）
        socket.on("requestMatch", async (data) => {
            console.log("requestMatch received:", data);
            if (!data.name || !data.characterName || !data.player_id) {
                console.error('Invalid data for requestMatch');
                return;
            }
            if (data.name.length > 30 || data.characterName.length > 50 || data.player_id.length > 50) {
                console.error('Data length validation failed for requestMatch');
                return;
            }

            try {
                // 1. プレイヤー情報を取得
                const playerInfo = await serverState.getPlayerInfo(data.player_id);
                if (!playerInfo) {
                    console.error(`Player info not found for id: ${data.player_id}`);
                    return;
                }

                // 2. プレイヤーをサーバー状態に追加
                serverState.addPlayer(socket, playerInfo);

                // 3. マッチングを要求
                if (serverState.players[socket.id]) {
                    if (serverState.players[socket.id].roomId !== null) {
                        console.warn(`Player ${playerInfo.player_id} is already in a room.`);
                        return; // 既になんらかのルームにいる場合は何もしない
                    }
                    serverState.players[socket.id].requestMatch(data);
                    console.log(`Player ${playerInfo.player_id} is now matching.`);
                } else {
                    console.error('Failed to add player to server state.');
                }
            } catch (error) {
                console.error('Error processing requestMatch:', error);
            }
        });

        socket.on("cancelMatch", () => {
            console.log("cancelMatch");
            if (!serverState.players[socket.id]) return
            serverState.players[socket.id].cancelMatch();
            socket.emit("cancelMatch");
        });

        socket.on("createRoom", async (data) => {
            console.log("createRoom received:", data);
            if (!data.name || !data.characterName || !data.player_id) {
                console.error('Invalid data for createRoom');
                return;
            }
            if (data.name.length > 24 || data.characterName.length > 36 || data.player_id.length > 36) {
                console.error('Data length validation failed for createRoom');
                return;
            }

            try {
                const playerInfo = await serverState.getPlayerInfo(data.player_id);
                if (!playerInfo) {
                    console.error(`Player info not found for id: ${data.player_id}`);
                    return;
                }

                serverState.addPlayer(socket, playerInfo);

                if (serverState.players[socket.id]) {
                    serverState.createRoom(socket, data); // プレイヤー情報も渡す
                } else {
                    console.error('Failed to add player to server state before creating room.');
                }
            } catch (error) {
                console.error('Error processing createRoom:', error);
            }
        });

        socket.on("joinRoom", async (data) => {
            console.log("joinRoom received:", data);
            if (!data.name || !data.characterName || !data.player_id || !data.roomId) {
                console.error('Invalid data for joinRoom');
                return;
            }
            if (data.name.length > 30 || data.characterName.length > 50 || data.player_id.length > 50 || data.roomId.length > 10) {
                console.error('Data length validation failed for joinRoom');
                return;
            }

            try {
                const playerInfo = await serverState.getPlayerInfo(data.player_id);
                if (!playerInfo) {
                    console.error(`Player info not found for id: ${data.player_id}`);
                    socket.emit("roomJoinFailed", { roomId: data.roomId, text: 'プレイヤー情報の取得に失敗しました' });
                    return;
                }

                serverState.addPlayer(socket, playerInfo);

                const url = serverState.rooms[data.roomId];
                if (url) {
                    socket.emit("roomFound", {
                        roomId: data.roomId,
                        gameServerAddress: url
                    });
                } else {
                    socket.emit("roomJoinFailed", { roomId: data.roomId, text: '部屋が見つかりません' });
                }
            } catch (error) {
                console.error('Error processing joinRoom:', error);
                socket.emit("roomJoinFailed", { roomId: data.roomId, text: 'エラーが発生しました' });
            }
        });

        // 切断時の処理
        socket.on("disconnect", () => {
            serverState.removeFromMatchingQueue(socket.id);
            serverState.deletePlayer(socket.id);
        });
    });
}