// public/cpu.js
export class CPU {
    worker;
    level;
    gameManager;

    pawnLimit4thRank;

    constructor(gameManager, level, pawnLimit4thRank = false) {
        this.level = level
        this.pawnLimit4thRank = pawnLimit4thRank;
        this.gameManager = gameManager;
        this.setWorker(); // コンストラクタでワーカーのイベントハンドラを設定
    }

    gameStart(servertime, now) {
        this.worker.postMessage(["gameStart", { servertime: servertime, time: now, level: this.level, pawnLimit4thRank: this.pawnLimit4thRank }]);
    }

    boardChanged(move) {
        this.worker.postMessage(["move", move]);
    }

    // CPUの手が盤面に適用できなかったことをワーカーに伝える（反映待ちの解除）
    moveRejected(move) {
        this.worker.postMessage(["moveRejected", move]);
    }

    stop() {
        this.worker.terminate();
    }

    setWorker() {
        this.worker = new Worker(new URL("./worker.js", import.meta.url));
        this.worker.onmessage = (e) => {
            // 受信したCPUの手をGameManagerに渡す
            if (this.gameManager && typeof this.gameManager.handleCpuMove === 'function') {
                this.gameManager.handleCpuMove(e.data.move);
            } else {
                console.error("CPU: GameManagerまたはhandleCpuMoveメソッドが見つかりません。");
            }
        };

        this.worker.onerror = (error) => {
            console.error("CPU: Worker error:", error);
        };
    }
}