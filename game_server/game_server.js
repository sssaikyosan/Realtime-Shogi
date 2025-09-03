import 'dotenv/config';

import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import https from 'https';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';


import { ioSetup } from './iosetting.js';
import { ServerState } from './serverstate.js'; // ゲームサーバー側では独自の ServerState を使用するか検討
import { Room } from './room.js';
import { Player } from './player.js';

export const __filename = fileURLToPath(import.meta.url);
export const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'game_public')));
// ルートパスへのリクエストにindex.htmlを送信
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'game_public', 'index.html'));
});

let server;
// Socket.IO 接続ハンドラ内でプレイヤーを識別し、ルームに割り当てる処理が必要になる
if (process.env.NODE_ENV === 'development') {
    const options = {
        key: fs.readFileSync('./localhost-key.pem'),
        cert: fs.readFileSync('./localhost.pem')
    };
    server = https.createServer(options, app);
} else {
    server = http.createServer(app);
}

const socketOptions = {
    cors: {
        origin: ['https://ssdojo.net', 'https://localhost:5000'],
        credentials: true
    }
};

export const io = new Server(server, socketOptions);
export const serverState = new ServerState(io);

// HTTPSサーバーを起動
const PORT = 5001;
server.listen(PORT, () => {
    console.log(new Date(), `HTTPS Server is running on port ${PORT})`);
});

ioSetup();

app.post('/createroom', (req, res) => {
    console.log('Received createroom request');
    // TODO: マッチングサーバーから受け取った情報を使ってゲームを開始するロジックを実装
    const { roomId, roomType, sente, gote, spectators, owner } = req.body; // roomId, player1, player2 の情報を取得

    if (!roomId || !roomType || !sente || !gote || !spectators || owner === undefined) {
        console.error('Missing room or player information in createroom request');
        return res.status(400).send('Missing room or player information');
    }

    // ゲームサーバー側でルームを作成し、プレイヤー情報を保持する
    if (serverState.rooms[roomId]) {
        console.warn(`Room ${roomId} already exists on game server.`);
        // 既にルームが存在する場合はエラーとせず、成功応答を返す（冪等性を考慮）
        return res.status(200).send('Game start request received and room already exists');
    }

    try {
        serverState.rooms[roomId] = new Room(roomId, roomType, owner);

        if (roomType === 'rating') {
            for (const id of sente) {
                serverState.canJoinRoom[id] = { roomId: roomId, teban: 'sente' };
            }
            for (const id of gote) {
                serverState.canJoinRoom[id] = { roomId: roomId, teban: 'gote' };
            }
        }

        console.log(`Game room ${roomId} created on game server.`);

        // ルーム作成と情報保持が成功したとみなし、成功応答を返す
        res.status(200).send('Game start request received and room created on game server');

    } catch (error) {
        console.error(`Error creating room ${roomId} on game server:`, error);
        // エラー発生時は作成途中のルーム情報をクリーンアップ
        if (roomType === 'rating') {
            delete serverState.rooms[roomId];
            for (const id of sente) {
                delete serverState.canJoinRoom[id];
            }
            for (const id of gote) {
                delete serverState.canJoinRoom[id];
            }
        }

        return res.status(500).send('Failed to create game room');
    }
});

// 定期的に部屋をクリーンアップ
setInterval(() => {
    for (const roomId in serverState.rooms) {
        const room = serverState.rooms[roomId];
        // gameFinishedで部屋が削除されている可能性があるので再チェック
        if (serverState.rooms[roomId]) {
            room.cleanup();
        }
    }
}, 10000); // 10秒に1回実行