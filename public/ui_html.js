// canvas の UI と同じ座標・レイアウトのまま、見た目を HTML の要素で出すための部品。
// draw() では canvas に描かず、そのときの描画位置（ゲーム内座標を画面の位置に直したもの）に要素を置く。
// 描かれなかったフレームは要素を隠すので、シーンから外したり visible=false にすると自動で消える
import { UI } from "./ui.js";
import { OVERLAY_COLOR } from "./const.js";

const hud = document.getElementById('gameHUD');
const live = new Set();
let drawn = new Set();

// 1フレームの描画の前後で呼ぶ（描かれなかった要素を隠す）
export function beginHtmlFrame() {
  drawn = new Set();
}
export function endHtmlFrame() {
  for (const ui of live) {
    if (!drawn.has(ui) && ui.el.style.display !== 'none') ui.el.style.display = 'none';
  }
}

export class HtmlUI extends UI {
  constructor(params, el) {
    super(params);
    this.el = el;
    el.style.display = 'none';
    hud.appendChild(el);
    live.add(this);
  }

  draw(ctx, scale) {
    if (!this.visible) return;
    ctx.save();
    ctx.translate(this.x * scale, this.y * scale);
    const m = ctx.getTransform();
    ctx.restore();
    // getTransform は描画バッファの画素単位（devicePixelRatio 倍）なので CSS ピクセルに戻す
    const px = m.e / m.a;
    const py = m.f / m.d;
    const s = scale * this.zoom;
    if (!this.update(px, py, s)) return;
    drawn.add(this);
    if (this.el.style.display === 'none') this.el.style.display = '';
    this.el.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) ${this.anchor()}`;
  }

  // 要素の中身・大きさを更新する。表示しないときは false を返す
  update(px, py, s) { return true; }
  // 要素のどこを描画位置に合わせるか（既定は中心）
  anchor() { return 'translate(-50%, -50%)'; }

  // 盤などの canvas の UI への押下判定には加わらない（押下は HTML の要素が受け取る）
  touchCheck() { return false; }

  dispose() {
    this.el.remove();
    live.delete(this);
  }
}

// 文字（TextUI と同じ指定：size, position = 'left' | 'right' | 'center', textBaseline = 'top' | 'bottom' | 'middle'）
export class HtmlTextUI extends HtmlUI {
  constructor(params) {
    const el = document.createElement('div');
    el.className = `hud-text ${params.className ?? ''}`;
    super(params, el);
    this.text = params.text;
    this.size = params.size;
    this.position = params.position ?? 'center';
    this.textBaseline = params.textBaseline ?? 'middle';
    this.lastText = null;
    this.lastSize = 0;
    if (params.colors) {
      el.style.color = params.colors[0];
      // 2色目は縁取りの色（#rrggbb00 のように透明なら縁取りなし）
      const outline = params.colors[1];
      const transparent = !outline || (/^#[0-9a-f]{8}$/i.test(outline) && outline.endsWith('00'));
      if (!transparent) el.style.setProperty('--outline', outline);
      else el.classList.add('no-outline');
    }
    if (params.backgroundColor) {
      el.style.background = params.backgroundColor;
      el.classList.add('has-bg');
    }
  }

  update(px, py, s) {
    const text = this.text();
    if (!text) return false;
    if (text !== this.lastText) {
      this.el.textContent = text;
      this.lastText = text;
    }
    const size = this.size * s;
    if (Math.abs(size - this.lastSize) > 0.05) {
      this.el.style.fontSize = `${size.toFixed(2)}px`;
      this.lastSize = size;
    }
    return true;
  }

  anchor() {
    const ax = this.position === 'right' ? '-100%' : this.position === 'left' ? '0%' : '-50%';
    const ay = this.textBaseline === 'bottom' ? '-100%' : this.textBaseline === 'top' ? '0%' : '-50%';
    return `translate(${ax}, ${ay})`;
  }
}

// ボタン（ButtonUI と同じ指定：text, width, height, textSize, onClick）
export class HtmlButtonUI extends HtmlUI {
  constructor(params) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `ubtn hud-btn ${params.className ?? 'ubtn-sub'}`;
    super(params, el);
    this.width = params.width;
    this.height = params.height;
    this.textSize = params.textSize;
    this.label = typeof params.text === 'function' ? params.text : () => params.text;
    this.onClick = params.onClick;
    this.lastKey = '';
    el.addEventListener('click', () => this.onClick?.());
  }

  update(px, py, s) {
    const label = this.label();
    if (this.el.textContent !== label) this.el.textContent = label;
    const key = `${this.width * s}|${this.height * s}|${this.textSize * s}`;
    if (key !== this.lastKey) {
      this.el.style.width = `${(this.width * s).toFixed(1)}px`;
      this.el.style.height = `${(this.height * s).toFixed(1)}px`;
      this.el.style.fontSize = `${(this.textSize * s).toFixed(2)}px`;
      this.lastKey = key;
    }
    return true;
  }
}

// ON/OFF の切り替えスイッチ（ToggleUI と同じ指定：width, height, label, getValue, onToggle）
export class HtmlToggleUI extends HtmlUI {
  constructor(params) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'hud-toggle';
    el.innerHTML = '<span class="hud-toggle-label"></span><span class="hud-switch"><span class="hud-switch-state"></span><span class="hud-switch-knob"></span></span>';
    super(params, el);
    this.width = params.width;
    this.height = params.height;
    this.label = params.label;
    this.getValue = params.getValue;
    this.onToggle = params.onToggle;
    this.labelEl = el.querySelector('.hud-toggle-label');
    this.stateEl = el.querySelector('.hud-switch-state');
    this.lastKey = '';
    // 押したらすぐ表示を切り替える（次の描画を待たない）
    el.addEventListener('click', () => {
      this.onToggle?.();
      this.refresh();
    });
  }

  refresh() {
    const on = !!this.getValue();
    const label = this.label();
    if (this.labelEl.textContent !== label) this.labelEl.textContent = label;
    this.el.classList.toggle('on', on);
    this.el.setAttribute('aria-pressed', on ? 'true' : 'false');
    const state = on ? 'ON' : 'OFF';
    if (this.stateEl.textContent !== state) this.stateEl.textContent = state;
  }

  update(px, py, s) {
    this.refresh();
    const key = `${this.width * s}|${this.height * s}`;
    if (key !== this.lastKey) {
      this.el.style.width = `${(this.width * s).toFixed(1)}px`;
      this.el.style.height = `${(this.height * s).toFixed(1)}px`;
      this.el.style.setProperty('--h', `${(this.height * s).toFixed(1)}px`);
      this.lastKey = key;
    }
    return true;
  }
}

// キャラのセリフの吹き出し（OverlayUI と同じく x, y, width, height を持ち、文字は voice() が返す { text, size }）
export class HtmlBubbleUI extends HtmlUI {
  constructor(params) {
    const el = document.createElement('div');
    el.className = 'hud-bubble';
    super(params, el);
    this.width = params.width ?? 0;
    this.height = params.height ?? 0;
    this.voice = params.voice;
    el.style.background = params.color ?? OVERLAY_COLOR;
    this.lastKey = '';
  }

  update(px, py, s) {
    const voice = this.voice();
    const text = voice.text();
    if (!text || this.width <= 0) return false;
    if (this.el.textContent !== text) this.el.textContent = text;
    const key = `${this.width * s}|${this.height * s}|${voice.size * s}`;
    if (key !== this.lastKey) {
      this.el.style.minWidth = `${(this.width * s).toFixed(1)}px`;
      this.el.style.minHeight = `${(this.height * s).toFixed(1)}px`;
      this.el.style.fontSize = `${(voice.size * s).toFixed(2)}px`;
      this.lastKey = key;
    }
    return true;
  }
}

// 半透明の帯など（OverlayUI と同じ指定：width, height, color）
export class HtmlPanelUI extends HtmlUI {
  constructor(params) {
    const el = document.createElement('div');
    el.className = 'hud-panel';
    super(params, el);
    this.width = params.width ?? 0;
    this.height = params.height ?? 0;
    el.style.background = params.color ?? OVERLAY_COLOR;
    this.lastKey = '';
  }

  update(px, py, s) {
    if (this.width <= 0 || this.height <= 0) return false;
    const key = `${this.width * s}|${this.height * s}`;
    if (key !== this.lastKey) {
      this.el.style.width = `${(this.width * s).toFixed(1)}px`;
      this.el.style.height = `${(this.height * s).toFixed(1)}px`;
      this.lastKey = key;
    }
    return true;
  }
}
