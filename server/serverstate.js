import { Player } from './player.js'
import uuid from 'uuid-random';
import { generateRandomString } from './utils.js';
import https from 'https';

import { Postgure } from './postgure.js'; // Postgure クラスをインポート

export class ServerState {
    players = {};
    postgureDb;
    rooms = {};
    game_servers = [];
    next_game_server_idx = 0;

    constructor(io, game_servers) {
        this.io = io;
        this.game_servers = game_servers;
        this.postgureDb = new Postgure();
    }

    // プレイヤーのレーティングデータをデータベースに保存（挿入または更新）(Postgure クラスに処理を委譲)
    async savePlayerInfo(data) { // メソッド名を変更
        await this.postgureDb.savePlayerInfo(data);
    }

    async getPlayerInfo(player_id) { // 非同期にする
        const playerInfo = await this.postgureDb.readPlayerInfo(player_id);
        if (!playerInfo) {
            const player_id = uuid();
            const initialPlayerInfo = { player_id: player_id, rating: 1500, total_games: 0, lastLogin: new Date(), name: '' };
            await this.postgureDb.savePlayerInfo(initialPlayerInfo);
            return initialPlayerInfo;
        }
        return playerInfo;
    }

    addPlayer(socket, playerInfo) {
        if (!socket.id || !playerInfo.player_id) return false;
        const player = new Player(socket, playerInfo.player_id);
        player.rating = playerInfo.rating;
        player.total_games = playerInfo.total_games;
        this.players[socket.id] = player;
        return true;
    }

    //プレイヤーの削除
    deletePlayer(id) {
        if (!this.players[id]) return false;
        // キューからも削除
        this.removeFromMatchingQueue(id);
        delete this.players[id];
        return true;
    }

    // マッチングキュー管理用プロパティとメソッド
    matchingQueue = []; // { id, queueEntryTime } の配列

    addToMatchingQueue(id) {
        if (!this.players[id]) return false;
        // 既にキューにいるかチェック
        if (this.matchingQueue.some(p => p.id === id)) {
            return false;
        }
        this.matchingQueue.push({
            id: id,
            queueEntryTime: Date.now()
        });
        return true;
    }

    removeFromMatchingQueue(id) {
        const index = this.matchingQueue.findIndex(p => p.id === id);
        if (index !== -1) {
            this.matchingQueue.splice(index, 1);
            return true;
        }
        return false;
    }

    // マッチングスコアの計算（低いほど良いマッチ）
    calculateMatchScore(elo1, elo2, plays1, plays2) {
        const EloWeight = 10;      // Elo差の重み
        const PlaysWeight = 50;    // 経験値差の重み（対数スケール）

        const eloDiff = Math.abs(elo1 - elo2);
        // 対数を使って経験値の差を計算。新規プレイヤー保護のために重要
        const logPlays1 = Math.log(plays1 + 1); // +1はゼロ除算防止
        const logPlays2 = Math.log(plays2 + 1);
        const playsDiff = Math.abs(logPlays1 - logPlays2);

        return (eloDiff * EloWeight) + (playsDiff * PlaysWeight);
    }

    matchMakingProcess() {
        // ステップ0: 前処理
        if (this.matchingQueue.length < 2) {
            return;
        }

        const currentTime = Date.now();

        // マッチング候補者をElo順にソート（重要：計算量削減）
        const sortedPlayers = [...this.matchingQueue].sort((a, b) => {
            return a.rating - b.rating;
        });

        // ペア成立済みプレイヤーを追跡
        const matchedPlayers = new Set();
        const matchedPairs = [];

        let searchRange = 10; // 基本の検索範囲

        // ステップ2: 各プレイヤーの最適な相手を探す（Greedy法）
        for (let i = 0; i < sortedPlayers.length; i++) {
            const playerA = sortedPlayers[i];
            if (matchedPlayers.has(playerA.id)) continue;

            let bestMatch = null;
            let minScore = Infinity;

            // 待ち時間に基づく動的パラメータ調整
            const waitTime = currentTime - playerA.queueEntryTime;

            let threshold = waitTime / 5 + 300;   // マッチングスコアの閾値
            let playsWeight = 50;  // 経験値重み


            // 近傍探索：Eloが近いプレイヤーのみを対象に
            for (let j = Math.max(0, i - searchRange); j < Math.min(sortedPlayers.length, i + searchRange + 1); j++) {
                if (i === j) continue;

                const playerB = sortedPlayers[j];
                if (matchedPlayers.has(playerB.id)) continue;

                // マッチングスコアを計算（動的重みを使用）
                const score = (Math.abs(this.players[playerA.id].rating - this.players[playerB.id].rating) * 10) +
                    (Math.abs(Math.log(this.players[playerA.id].total_games + 1) - Math.log(this.players[playerB.id].total_games + 1)) * playsWeight);

                if (score < minScore) {
                    minScore = score;
                    bestMatch = playerB;
                }
            }

            // ステップ3: ペア成立条件チェック（動的閾値）
            if (bestMatch && minScore <= threshold) {
                matchedPairs.push({
                    player1: playerA.id,
                    player2: bestMatch.id,
                    score: minScore
                });
                matchedPlayers.add(playerA.id);
                matchedPlayers.add(bestMatch.id);
            }
        }

        // ペア成立処理
        for (const pair of matchedPairs) {
            this.matchMake(pair.player1, pair.player2);
            console.log(new Date(), `Matched players: ${this.players[pair.player1].name}vs ${this.players[pair.player2].name} (Score:${pair.score})`);

            // キューから削除
            this.removeFromMatchingQueue(pair.player1);
            this.removeFromMatchingQueue(pair.player2);
        }
    }

    async matchMake(player1, player2) {
        const roomId = uuid();  // ルームIDを生成

        // ルームを作成 (マッチングサーバー側での管理用)


        const player1Data = this.players[player1];
        const player2Data = this.players[player2];
        // プレイヤー情報の取得に成功した場合のみ処理を続行
        if (!player1Data || !player2Data) {
            console.error(`プレイヤー情報が見つかりませんでした。Player1 ID: ${this.players[player1].player_id}, Player2 ID: ${this.players[player2].player_id}`);
            // ルーム作成に失敗したとみなし、作成したルームを削除するなどの後処理が必要であればここに追加
            return false;
        }



        const time = performance.now();

        const gameServerAddress = this.game_servers[this.next_game_server_idx];
        this.next_game_server_idx++;
        if (this.next_game_server_idx >= this.game_servers.length) {
            this.next_game_server_idx = 0;
        }

        const postData = JSON.stringify({
            roomId: roomId,
            roomType: 'rating',
            sente: [this.players[player1].player_id],
            gote: [this.players[player2].player_id],
            spectators: [],
            owner: null
        });

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        // ゲームサーバーへのリクエスト送信と応答処理
        const req = https.request(gameServerAddress + '/createroom', options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => { responseData += chunk; });
            console.log(`Game server response status: ${res.statusCode}`);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    // ゲームサーバーでのルーム作成が成功した場合
                    console.log('Game server room creation successful.');
                    // matchFound イベントをクライアントに送信

                    this.players[player1].state = "waiting";
                    this.io.to(this.players[player1].socket.id).emit("matchFound", {
                        roomId: roomId,
                        gameServerAddress: gameServerAddress // ゲームサーバーのアドレスを追加
                    });

                    this.players[player2].state = "waiting";
                    this.io.to(this.players[player2].socket.id).emit("matchFound", {
                        roomId: roomId,
                        gameServerAddress: gameServerAddress // ゲームサーバーのアドレスを追加
                    });
                } else {
                    // ゲームサーバーでのルーム作成が失敗した場合
                    console.error(`Game server room creation failed with status: ${res.statusCode}`);
                    console.error(`Response data: ${responseData}`);
                    if (this.players[player1]) {
                        this.players[player1].socket.emit("matchFailed");
                    }
                    if (this.players[player2]) {
                        this.players[player2].socket.emit("matchFailed");
                    }
                }
            });
        });

        req.on('error', (e) => {
            console.error(`Problem with game server request: ${e.message}`);
            // エラーハンドリング（例: マッチングを解除してプレイヤーを待機状態に戻す）
            // クライアントにエラーを通知することも検討
        });

        req.end(postData);

        return true; // リクエスト送信自体は成功
    }

    async sendServerStatus() {

        const topinfo = await this.postgureDb.readTopPlayers();
        const topPlayers = [];

        for (let i = 0; i < 10; i++) {
            if (topinfo.length - 1 < i) {
                break;
            }
            topPlayers.push({ name: topinfo[i].name, rating: topinfo[i].rating });
        }
        this.io.emit("serverStatus", { topPlayers: topPlayers });
    }


    createRoom(socket, data) { // ownerId 引数を追加
        const roomId = generateRandomString();

        const gameServerAddress = this.game_servers[this.next_game_server_idx]; // ゲームサーバーのアドレスとポート
        this.next_game_server_idx++;
        if (this.next_game_server_idx >= this.game_servers.length) {
            this.next_game_server_idx = 0;
        }

        this.rooms[roomId] = gameServerAddress;

        const ownerInfo = {
            id: this.players[socket.id].player_id,
            name: data.name,
            characterName: data.characterName
        };

        const postData = JSON.stringify({
            roomId: roomId,
            roomType: 'private',
            sente: [],
            gote: [],
            spectators: [ownerInfo], // 観戦者にオーナー情報を入れる
            owner: ownerInfo // オーナー情報
        });

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        // ゲームサーバーへのリクエスト送信と応答処理
        const req = https.request(gameServerAddress + '/createroom', options, (res) => {
            console.log(`Game server response status: ${res.statusCode}`);
            let responseData = '';
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    // ゲームサーバーでのルーム作成が成功した場合
                    console.log('Game server room creation successful.');

                    this.io.to(socket.id).emit("roomFound", {
                        roomId: roomId,
                        gameServerAddress: gameServerAddress // ゲームサーバーのアドレスを追加
                    });
                } else {
                    // ゲームサーバーでのルーム作成が失敗した場合
                    console.error(`Game server room creation failed with status: ${res.statusCode}`);
                    console.error(`Response data: ${responseData}`);
                }
            });
        });

        req.on('error', (e) => {
            console.error(`Problem with game server request: ${e.message}`);
        });

        req.end(postData);
        return roomId;
    }

    // アプリケーション終了時にデータベース接続プールを終了する
    async closeDatabase() {
        console.log('Closing database connection pool via Postgure...');
        await this.postgureDb.end();
    }
}
