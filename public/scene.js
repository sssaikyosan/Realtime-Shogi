import { canvas, setOnclick } from "./main.js";

// 縦持ち（高さ >= 幅）かどうか。CSS の (orientation: portrait) と同じ判定にそろえる
export function isPortrait() {
  return window.innerHeight >= window.innerWidth;
}

export class Scene {
  scale = 0;
  aspect = 9 / 16;
  offsetX = 0;
  offsetY = 0;
  ui_lists = [];
  lastFrameTime = performance.now();
  portrait = false;
  // 画面の半分の幅・高さ（ゲーム内座標）。横画面では高さ0.5基準、縦画面では幅0.5基準
  halfWidth = 0;
  halfHeight = 0;
  // 縦横が切り替わったとき・画面サイズが変わったときに呼ばれる (portrait:boolean, scene) => void
  onLayout = null;
  layoutKey = null;
  // 縦画面でHTML入力欄をずらす量（ゲーム内座標）。onLayout 内で設定する
  htmlOffsetY = 0;

  init() {

  }
  destroy() {
    // シーン破棄時のクリーンアップ処理をここに記述
  }

  draw(ctx) {
    setOnclick(false);
    this.resize();
    ctx.fillStyle = '#101010';
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.save();
    ctx.translate((window.innerWidth * 0.5), window.innerHeight * 0.5)
    this.ui_lists.forEach(ui => ui.draw(ctx, this.scale, this.aspect));
    ctx.restore();
  }

  add(ui) {
    this.ui_lists.push(ui);
  }

  remove(ui) {
    this.ui_lists = this.ui_lists.filter(u => u !== ui);
  }

  getGamePosition(event) {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - window.innerWidth * 0.5) / this.scale;
    const y = (event.clientY - rect.top - window.innerHeight * 0.5) / this.scale;
    return { x: x, y: y }
  }

  touchCheck(event, str) {
    const pos = this.getGamePosition(event);
    this.touchCheckAt(pos, str);
  }

  touchCheckAt(pos, str) {
    // 手前（後から追加した）UIから順に判定する
    for (let i = 0; i < this.ui_lists.length; i++) {
      const consumed = this.ui_lists[this.ui_lists.length - i - 1].touchCheck(pos, str);
      // ボタン等が押下を処理したら、奥にあるUI（盤など）には渡さない
      if (consumed && str === 'mousedown') break;
    }
  }

  // タッチ操作では指を離した後もホバー状態が残るので、画面外の座標を渡して解除する
  releaseHover() {
    this.touchCheckAt({ x: 1e9, y: 1e9 }, 'mousemove');
  }

  resize() {
    this.portrait = isPortrait();
    if (this.portrait) {
      // 縦画面: 幅1.0 × 高さ16/9 の領域が収まるようにする
      this.scale = Math.max(0, Math.min(window.innerWidth, window.innerHeight * this.aspect));
    } else {
      this.scale = Math.max(0, Math.min(window.innerWidth * this.aspect, window.innerHeight));
    }
    this.offsetX = Math.max(0, window.innerWidth * this.aspect - window.innerHeight) * 0.5 / this.aspect;
    this.offsetY = Math.max(0, window.innerHeight - window.innerWidth * this.aspect) * 0.5;
    if (this.scale > 0) {
      this.halfWidth = window.innerWidth * 0.5 / this.scale;
      this.halfHeight = window.innerHeight * 0.5 / this.scale;
    }
    this.applyLayout();
  }

  applyLayout(force = false) {
    if (!this.onLayout || this.scale <= 0) return;
    const key = `${this.portrait}:${window.innerWidth}x${window.innerHeight}`;
    if (!force && key === this.layoutKey) return;
    this.layoutKey = key;
    this.onLayout(this.portrait, this);
  }

  // ゲーム内座標 → 画面上のピクセル座標（HTML要素の配置用）
  toScreen(x, y) {
    return {
      x: window.innerWidth * 0.5 + x * this.scale,
      y: window.innerHeight * 0.5 + y * this.scale
    };
  }
}
