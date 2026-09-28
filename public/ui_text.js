import { UI } from "./ui.js";
import { drawText, drawTextWithDoubleOutline, drawTextWithOutline } from "./utils.js";

// 1行を maxPx に収まるよう分割する（英語は単語単位、日本語などは文字単位）
export function wrapLine(ctx, line, maxPx) {
  if (ctx.measureText(line).width <= maxPx) return [line];
  const out = [];
  let current = '';
  for (const ch of line) {
    const next = current + ch;
    if (current && ctx.measureText(next).width > maxPx) {
      const space = current.lastIndexOf(' ');
      if (ch !== ' ' && space > 0) {
        out.push(current.slice(0, space));
        current = current.slice(space + 1) + ch;
      } else {
        out.push(current);
        current = ch === ' ' ? '' : ch;
      }
    } else {
      current = next;
    }
  }
  if (current) out.push(current);
  return out;
}

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
    // 指定すると、この幅（ゲーム内座標）を超える行を折り返す
    this.maxWidth = params.maxWidth ?? null;
    // true のとき文中の改行を無視して maxWidth で折り返し直す
    this.reflow = params.reflow ?? false;
  }

  getLines(ctx, size, scale) {
    let text = this.text();
    if (!this.maxWidth) return text.split('\n');
    // 折り返しは文字ごとに幅を測るので重い。文字列・大きさが変わったときだけ計算し直す
    const key = `${size}|${this.maxWidth * scale}|${this.reflow}|${text}`;
    if (this.wrapCache && this.wrapCache.key === key) return this.wrapCache.lines;
    if (this.reflow) text = text.replace(/\n/g, '');
    ctx.save();
    ctx.font = `${size}px Arial`;
    const maxPx = this.maxWidth * scale;
    const lines = text.split('\n').flatMap(line => wrapLine(ctx, line, maxPx));
    ctx.restore();
    this.wrapCache = { key, lines };
    return lines;
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
    const lines = this.getLines(ctx, size, scale);
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
