import { darkenColor, drawText } from "./utils.js";
import { UI } from "./ui.js";
import { TextUI } from "./ui_text.js";
import { setOnclick } from "./main.js";

export class ButtonUI extends UI {
    text;
    onClick;
    borderRadius; // 角丸の半径を追加

    constructor(params) {
        super(params);
        this.text = params.text ?? '';
        this.color = params.color ?? '#cccccc'; // デフォルト色
        this.textColors = params.textColors ?? ["#ffffff", "#000000", "#00000000"]; // デフォルトテキスト色
        this.textSize = params.textSize ?? 0.1; // デフォルトフォントサイズ
        this.width = params.width;
        this.height = params.height;
        this.onClick = params.onClick;
        this.touchable = true; // ボタンはタッチ可能にする
        this.borderRadius = params.borderRadius ?? params.height * 0.2; // デフォルトの角丸半径は0
        this.borderWidth = params.boarderWidth ?? params.height * 0.1;
        this.Init(params);
    }

    Init(params) {
        this.text = new TextUI({
            text: () => {
                return params.text;
            },
            x: 0,
            y: params.textSize * 0.12,
            size: params.textSize,
            colors: params.textColors,
        });
        this.add(this.text);
    }

    renderSelf(ctx, scale) {
        this.renderDarkLine(ctx, scale);
        this.renderFill(ctx, scale);
    }

    renderFill(ctx, scale) {
        ctx.fillStyle = this.color;
        const scaledBorderRadius = (this.borderRadius - this.borderWidth / 2) * scale;
        const scaledWidth = this.touched ? (this.width - this.borderWidth) * scale * 1.1 : (this.width - this.borderWidth) * scale;
        const scaledHeight = this.touched ? (this.height - this.borderWidth) * scale * 1.1 : (this.height - this.borderWidth) * scale;
        const x = -scaledWidth / 2 + this.borderWidth;
        const y = -scaledHeight / 2 + this.borderWidth;

        ctx.beginPath();
        ctx.roundRect(x, y, scaledWidth, scaledHeight, scaledBorderRadius);
        ctx.fill();
    }

    renderDarkLine(ctx, scale) {
        ctx.fillStyle = darkenColor(this.color, 0.5);
        const scaledBorderRadius = this.borderRadius * scale;
        const scaledWidth = this.touched ? this.width * scale * 1.1 : this.width * scale;
        const scaledHeight = this.touched ? this.height * scale * 1.1 : this.height * scale;
        const x = -scaledWidth / 2;
        const y = -scaledHeight / 2;

        ctx.beginPath();
        ctx.roundRect(x, y, scaledWidth, scaledHeight, scaledBorderRadius);
        ctx.fill();
    }

    onSearchMouseDown(pos) {
        if (this.isTouched(pos) && this.onClick) {
            this.onClick();
            setOnclick(true);
        }
    }

    onTouch() {
        this.text.size = this.textSize * 1.1;
    }
    unTouch() {
        this.text.size = this.textSize;
    }
}