import { serverState } from "./game_server.js";

export class Player {
    player_id = null;
    name = "";
    characterName = null;
    roomId = null;
    socket = null;
    state = "";
    rating = 0;
    total_games = 0;

    constructor(socket, player_id) {
        this.socket = socket;
        this.player_id = player_id;
    }

    setInfo(name, characterName) {
        this.name = name;
        this.characterName = characterName;
    }

    requestMatch(data) {
        if (this.state === "playing" || this.state === "ready") return false;
        if (this.roomId !== null) return false;
        if (!data.name) return false;
        if (!data.characterName) return false;
        this.name = data.name;
        this.characterName = data.characterName;
        this.player_id = data.player_id;
        this.state = "matching";
        return true;
    }

    cancelMatch() {
        if (this.state = "matching") {
            this.state = "waiting";
            return true;
        };
        return false;
    }

    goToPlay(roomId) {
        this.state = "playing";
        this.roomId = roomId;
    }

    readyToPlay() {
        this.state = "ready";
    }

    cancelReady() {
        if (!this.roomId) return false;
        if (this.state === 'ready') {
            this.state = "waiting";
        }
        serverState.rooms[this.roomId].roomUpdate();
    }

    joinRoom(roomId) {
        if (this.roomId) return 'すでに入っている部屋があります';
        const res = serverState.rooms[roomId].joinRoom(this.socket.id);
        if (res === "roomJoined") {
            this.roomId = roomId;
            serverState.rooms[roomId].roomUpdate();
            return "roomJoined"
        } else {
            return res;
        }
    }

    leaveRoom() {
        if (!this.roomId) return;
        serverState.rooms[this.roomId].leaveRoom(this.socket.id);
        this.roomId = null;
        this.state = 'waiting';
    }

    chat(data) {
        if (!this.roomId) return;
        serverState.rooms[roomId].chat(this.name, data.text);
    }
}