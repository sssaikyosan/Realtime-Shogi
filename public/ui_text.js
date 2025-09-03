import { UI } from "./ui.js";
import { drawText, drawTextWithDoubleOutline, drawTextWithOutline } from "./utils.js";

export class TextUI extends UI {
  constructor(params) {
    super(params);

    this.width = 0;
    this.height = 0;

    this.text = params.text;
    this.size = params.size;
    this.textBaseline = params.textBaseline;
    this.position = params.position;
    this.colors = params.colors;
    this.backgroundColor = params.backgroundColor;
    this.lineoffset = 0.1;
  }

  renderSelf(ctx, scale) {
    if (this.backgroundColor) {
      const textWidth = this.getTextWidth(ctx, scale);
      const backgroundWidth = (textWidth + this.size * 0.4) * scale;
      const backgroundHeight = (this.size + this.size * 0.4) * scale;

      let backgroundX = 0;
      let backgroundY = 0;

      // テキストの位置揃えに合わせて背景の位置を調整
      if (this.position === 'center') {
        backgroundX = backgroundX - backgroundWidth / 2;
      } else if (this.position === 'right') {
        backgroundX = backgroundX - backgroundWidth + this.size * 0.2 * scale;
      } else if (this.position === 'left') {
        backgroundX = backgroundX - this.size * 0.2 * scale;
      }

      if (this.textBaseline === 'middle') {
        backgroundY = backgroundY - backgroundHeight / 2;
      } else if (this.textBaseline === 'bottom') {
        backgroundY = backgroundY - backgroundHeight + this.size * 0.2 * scale;;
      } else if (this.textBaseline === 'top') {
        backgroundY = backgroundY - this.size * 0.2 * scale;
      }

      ctx.fillStyle = this.backgroundColor;
      ctx.fillRect(backgroundX, backgroundY, backgroundWidth, backgroundHeight);
    }
    const size = this.size * scale;
    const lines = this.text().split('\n');
    let y = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      switch (this.colors.length) {
        case 1:
          drawText(ctx, line, 0, y, size, this.colors[0], this.textBaseline, this.position);
          break;
        case 2:
          drawTextWithOutline(ctx, line, 0, y, size, this.colors, this.textBaseline, this.position);
          break;
        case 3:
          drawTextWithDoubleOutline(ctx, line, 0, y, size, this.colors, this.textBaseline, this.position);
          break;
        default:
          drawText(ctx, line, 0, y, size, this.colors[0], this.textBaseline, this.position);
          break;
      }
      y += size + size * this.lineoffset;
    }
  }
  /**
     * テキストの描画幅を取得します。
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} scale
     * @returns {number} テキストの幅 (ゲーム内座標)
     */
  getTextWidth(ctx, scale) {
    ctx.save();
    const size = this.size * scale;
    ctx.font = `${size}px sans-serif`; // フォントを設定
    const metrics = ctx.measureText(this.text());
    ctx.restore();
    return metrics.width / scale; // ゲーム内座標に変換して返す
  }
}
