import { UI } from "./ui.js";

// 背景画像を表示するためのUIクラス
export class BackgroundImageUI extends UI {
    image;

    constructor(params) {
        super(params);
        this.image = params.image;
    }

    renderSelf(ctx, scale) {
        // 背景画像が存在するかチェック
        const backgroundImage = this.image;
        if (backgroundImage) {
            // キャンバス全体に背景画像を描画
            // アスペクト比を維持しつつ、画面全体をカバーするように調整
            const canvasAspect = window.innerWidth / window.innerHeight;
            const imageAspect = backgroundImage.width / backgroundImage.height;

            let drawWidth;
            let drawHeight;
            let drawX = -window.innerWidth / 2;
            let drawY = -window.innerHeight / 2;

            if (canvasAspect > imageAspect) {
                // キャンバスの方が横長の場合、高さを基準に描画
                drawHeight = window.innerWidth / imageAspect;
                drawWidth = window.innerWidth;
                drawY += (window.innerHeight - drawHeight) / 2;
            } else {
                // 画像の方が横長、またはアスペクト比が同じ場合、幅を基準に描画
                drawWidth = window.innerHeight * imageAspect;
                drawHeight = window.innerHeight;
                drawX += (window.innerWidth - drawWidth) / 2;
            }

            ctx.drawImage(backgroundImage, drawX, drawY, drawWidth, drawHeight);
        } else {
            // 背景画像がない場合は黒で塗りつぶすなどのフォールバック
            ctx.fillStyle = '#000000';
            ctx.fillRect(-window.innerWidth / 2, -window.innerHeight / 2, window.innerWidth, window.innerHeight);
        }
    }
}