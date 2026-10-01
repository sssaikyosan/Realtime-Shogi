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

    // マッチング待ちの人数（同じプレイヤーが複数の接続で待っていても1人と数える）
    getWaitingCount() {
        const ids = new Set();
        for (const entry of this.matchingQueue) {
            const player = this.players[entry.id];
            if (player) ids.add(player.player_id);
        }
        return ids.size;
    }

    // 先に待っていた順に、別のプレイヤーどうしをすぐ組み合わせる（レート差では選ばない）
    matchMakingProcess() {
        const queue = this.matchingQueue.filter(entry => this.players[entry.id]);
        const matched = new Set();
        const pairs = [];
        for (let i = 0; i < queue.length; i++) {
            const a = queue[i];
            if (matched.has(a.id)) continue;
            for (let j = i + 1; j < queue.length; j++) {
                const b = queue[j];
                if (matched.has(b.id)) continue;
                // 同じプレイヤー（別のタブなど）どうしは組まない
                if (this.players[a.id].player_id === this.players[b.id].player_id) continue;
                pairs.push([a.id, b.id]);
                matched.add(a.id);
                matched.add(b.id);
                break;
            }
        }

        for (const [player1, player2] of pairs) {
            this.removeFromMatchingQueue(player1);
            this.removeFromMatchingQueue(player2);
            console.log(new Date(), `Matched players: ${this.players[player1].name} vs ${this.players[player2].name}`);
            this.matchMake(player1, player2);
        }
    }

    async matchMake(player1, player2) {
        const roomId = uuid();  // ルームIDを生成

        // 先手・後手はランダムに決める
        if (Math.random() < 0.5) [player1, player2] = [player2, player1];

        // プレイヤー情報の取得に成功した場合のみ処理を続行
        if (!this.players[player1] || !this.players[player2]) {
            console.error(`プレイヤー情報が見つかりませんでした。socket: ${player1}, ${player2}`);
            for (const id of [player1, player2]) {
                if (this.players[id]) this.players[id].socket.emit("matchFailed");
            }
            return false;
        }

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
                    notifyFailed();
                }
            });
        });

        // ゲームサーバーにつながらないときも、2人に失敗を知らせる（知らせないと「マッチング中」のまま待ち続ける）
        const notifyFailed = () => {
            for (const id of [player1, player2]) {
                if (!this.players[id]) continue;
                this.players[id].state = "waiting";
                this.players[id].socket.emit("matchFailed");
            }
        };
        req.setTimeout(10000, () => req.destroy(new Error('timeout')));
        req.on('error', (e) => {
            console.error(`Problem with game server request: ${e.message}`);
            notifyFailed();
        });

        req.end(postData);

        return true; // リクエスト送信自体は成功
    }

    // 対局中の人数。ゲームサーバーの /status を定期的に問い合わせて合計する
    playingCount = 0;

    updatePlayingCount() {
        const requests = this.game_servers.map(address => new Promise((resolve) => {
            const req = https.get(address + '/status', (res) => {
                let body = '';
                res.on('data', (chunk) => { body += chunk; });
                res.on('end', () => {
                    try {
                        const playing = JSON.parse(body).playing;
                        resolve(Number.isInteger(playing) && playing >= 0 ? playing : 0);
                    } catch (e) {
                        resolve(0);
                    }
                });
            });
            req.setTimeout(3000, () => req.destroy(new Error('timeout')));
            req.on('error', () => resolve(0));
        }));
        return Promise.all(requests).then(counts => {
            this.playingCount = counts.reduce((a, b) => a + b, 0);
        });
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
