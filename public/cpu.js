// public/cpu.js
export class CPU {
    worker;
    level;
    gameManager;

    constructor(gameManager, level) {
        this.level = level
        this.gameManager = gameManager;
        this.setWorker(); // コンストラクタでワーカーのイベントハンドラを設定
    }

    gameStart(servertime, now) {
        this.worker.postMessage(["gameStart", { servertime: servertime, time: now, level: this.level }]);
    }

    boardChanged(move) {
        this.worker.postMessage(["move", move]);
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