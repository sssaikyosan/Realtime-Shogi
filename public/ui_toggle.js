import { UI } from "./ui.js";
import { setOnclick } from "./main.js";

export const TOGGLE_ON_COLOR = '#2fbf62';
const TOGGLE_OFF_COLOR = '#5a5b70';
const PANEL_COLOR = '#1b1d33e6';

// ラベルの下にスイッチ（ON: つまみが右で緑 / OFF: つまみが左で灰色）を描く切り替えボタン
export class ToggleUI extends UI {
  constructor(params) {
    super(params);
    this.width = params.width;
    this.height = params.height;
    this.label = params.label; // () => string（\n で改行）
    this.getValue = params.getValue; // () => boolean
    this.onToggle = params.onToggle;
    this.touchable = true;
  }

  renderSelf(ctx, scale) {
    const on = this.getValue();
    const w = this.width * scale;
    const h = this.height * scale;
    ctx.save();
    if (this.touched) ctx.scale(1.05, 1.05);

    // 外枠のパネル（ONのときは枠も緑にする）
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(w, h) * 0.12);
    ctx.fillStyle = PANEL_COLOR;
    ctx.fill();
    ctx.lineWidth = Math.max(2, w * 0.03);
    ctx.strokeStyle = on ? TOGGLE_ON_COLOR : '#8a8aa0';
    ctx.stroke();

    // ラベル（上側）。パネルの幅に収まる大きさにする
    const lines = this.label().split('\n');
    const labelHeight = h * 0.52;
    let size = labelHeight / (lines.length * 1.15);
    ctx.font = `bold ${size}px Arial`;
    const widest = Math.max(...lines.map(line => ctx.measureText(line).width));
    if (widest > w * 0.84) {
      size *= w * 0.84 / widest;
      ctx.font = `bold ${size}px Arial`;
    }
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const labelCenterY = -h / 2 + h * 0.06 + labelHeight / 2;
    lines.forEach((line, i) => {
      ctx.fillText(line, 0, labelCenterY + (i - (lines.length - 1) / 2) * size * 1.15);
    });

    // スイッチ（下側）
    const trackW = w * 0.8;
    const trackH = Math.min(h * 0.28, trackW * 0.5);
    const trackY = h / 2 - h * 0.08 - trackH / 2;
    ctx.beginPath();
    ctx.roundRect(-trackW / 2, trackY - trackH / 2, trackW, trackH, trackH / 2);
    ctx.fillStyle = on ? TOGGLE_ON_COLOR : TOGGLE_OFF_COLOR;
    ctx.fill();

    const knobX = on ? trackW / 2 - trackH / 2 : -trackW / 2 + trackH / 2;
    ctx.beginPath();
    ctx.arc(knobX, trackY, trackH * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // つまみの反対側に ON / OFF
    ctx.font = `bold ${trackH * 0.48}px Arial`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(on ? 'ON' : 'OFF', on ? -trackH / 2 : trackH / 2, trackY);
    ctx.restore();
  }

  // 押されたら true を返し、奥にある盤などには押下を渡さない
  onSearchMouseDown(pos) {
    if (this.isTouched(pos) && this.onToggle) {
      this.onToggle();
      setOnclick(true);
      return true;
    }
    return false;
  }
}
