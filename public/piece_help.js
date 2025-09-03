import { BOARD_COLOR, LINE_COLOR, MOUSE_HIGHLIGHT_COLOR, PIECE_MOVES } from "./const.js";
import { pieceImages } from "./main.js";
import { UI } from "./ui.js";

export class PieceHelpUI extends UI {
    pieceType;
    display;

    constructor(params) {
        super(params);
        this.pieceType = params.pieceType;
        this.width = params.width;
        this.height = params.height;
        this.touchable = true;
    }

    canMove(x, y) {
        for (const move of PIECE_MOVES[this.pieceType]) {
            if (x === move.dx && y === move.dy) {
                return true;
            }
            if (move.recursive) {
                for (let r = 2; r < 4; r++) {
                    if (x / r === move.dx && y / r === move.dy) {
                        return true;
                    }
                }
            }
        }

        return false;
    }


    renderSelf(ctx, scale) {
        if (this.display) {
            ctx.save()
            ctx.fillStyle = LINE_COLOR;
            ctx.fillRect((-3 * 8 / 11 + 1 / 6 - 1 / 2) * this.width * scale, (-3 * 8 / 11 - 7 / 2) * this.height * scale, this.width * scale * 5, this.width * scale * 5);

            for (let i = -3; i < 4; i++) {
                for (let j = -3; j < 4; j++) {
                    ctx.fillStyle = BOARD_COLOR;
                    if (this.canMove(i, j)) {
                        ctx.fillStyle = MOUSE_HIGHLIGHT_COLOR;
                    }

                    let posX = (i * 8 / 11 + 1 / 6) * this.width * scale;
                    let offsetX = posX - this.width / 2 * scale;
                    let posY = j * 8 / 11 * this.height * scale;
                    let offsetY = posY - 7 / 2 * this.height * scale;

                    ctx.fillRect(offsetX, offsetY, this.width * scale * 2 / 3, this.width * scale * 2 / 3);

                    if (i === 0 && j === 0) {
                        ctx.drawImage(pieceImages[this.pieceType], offsetX, offsetY, this.width * scale * 2 / 3, this.height * scale * 2 / 3);
                    }
                }
            }
            ctx.restore();
        }
        ctx.drawImage(pieceImages[this.pieceType], - this.width / 2 * scale, -this.height / 2 * scale, this.width * scale, this.height * scale);
    }

    onMouseDown(pos) {
    }

    onTouch(pos) {
        this.display = true;
    }

    unTouch(pos) {
        this.display = false;
    }

    resize(data) {
        super.resize(data); // 親クラスのresizeを呼び出す
    }
}