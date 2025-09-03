import { gameManager } from "./main.js";
import { socket } from "./main.js";

export function sendPutPiece(nx, ny, type) {

    if (gameManager.cpu === null && socket !== null) {
        socket.emit("movePiece", {
            x: -1,
            y: -1,
            nx: nx,
            ny: ny,
            type: type,
            nari: false,
            teban: gameManager.teban,
            roomId: gameManager.roomId,
        });
        return true;
    }
    const move = {
        x: -1,
        y: -1,
        nx: nx,
        ny: ny,
        type: type,
        nari: false,
        teban: gameManager.teban,
        servertime: performance.now(),
    };
    gameManager.receiveMove(move);
    return true;
}

export function sendMovePiece(x, y, nx, ny, nari) {
    if (!gameManager.board.canMove(x, y, nx, ny, nari, gameManager.teban)) return false;
    if (gameManager.cpu === null && socket !== null) {
        socket.emit("movePiece", {
            x: x,
            y: y,
            nx: nx,
            ny: ny,
            type: null,
            nari: nari,
            teban: gameManager.teban,
            roomId: gameManager.roomId,
        });
        return true;
    }
    const move = {
        x: x,
        y: y,
        nx: nx,
        ny: ny,
        type: null,
        nari: nari,
        teban: gameManager.teban,
        servertime: performance.now(),
    };
    gameManager.receiveMove(move);
    return true;
}

export function sendUndoMove(roomId) {
    const data = { roomId: roomId };
    socket.emit("undoMove", data);
}