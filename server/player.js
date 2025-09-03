import { serverState } from "./server.js";

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

    requestMatch(data) {
        if (this.state === "matching" || this.state === "playing" || this.state === "ready") return false;
        if (this.roomId !== null) return false;
        if (!data.name) return false;
        if (!data.characterName) return false;
        this.name = data.name;
        this.characterName = data.characterName;
        this.player_id = data.player_id;
        this.state = "matching";

        // 新しいマッチングシステムに追加
        serverState.addToMatchingQueue(this.socket.id);

        return true;
    }

    cancelMatch() {
        if (this.state = "matching") {
            this.state = "waiting";

            // キューから削除
            serverState.removeFromMatchingQueue(this.socket.id);

            return true;
        };
        return false;
    }
}