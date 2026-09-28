import { OVERLAY_COLOR } from "./const.js";
import { characterImages, gameManager, scene, title_img, audioManager, canvas } from "./main.js";
export class UI {
  globalX;
  x;
  y;
  width;
  height;
  scale;
  touchable;
  childs = [];

  constructor(params) {
    this.x = params.x;
    this.y = params.y;
    this.width = 0;
    this.height = 0;
    this.touchable = params.touchable ?? false;
    this.eventlist = {};
    this.visible = params.visible ?? true;
    // 自分と子要素をまとめて拡大縮小する倍率（縦画面レイアウトで使用）
    this.zoom = params.zoom ?? 1;

    // if (this.touchable) {
    //   canvas.addEventListener('mousemove', (e) => {
    //     this.onMouseMove(e);
    //   });
    //   canvas.addEventListener('mousedown', (e) => {
    //     this.onMouseDown(e);
    //   });
    //   canvas.addEventListener('mouseup', (e) => {
    //     this.onMouseUp(e);
    //   });
    // }

  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx, scale) {
    if (!this.visible) return;
    // コンテキストの座標変換を保存
    ctx.save();

    // 自分の座標に描画位置をずらす 参照:https://developer.mozilla.org/ja/docs/Web/API/Canvas_API/Tutorial/Transformations
    ctx.translate(this.x * scale, this.y * scale);
    const localScale = scale * this.zoom;

    // まず自分を描画
    this.renderSelf(ctx, localScale);

    // 次に子供を描画
    for (const ui of this.childs) {
      ui.draw(ctx, localScale);
    }

    // コンテキストの座標変換を復元
    ctx.restore();
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   */
  renderSelf(ctx, scale) { }

  add(ui) {
    this.childs.push(ui);
  }

  remove(ui) {
    const index = this.childs.findIndex(x => x === ui);
    if (index === -1) return;
    this.childs.splice(index, 1);
  }

  unTouch(pos) { }
  onMouseDown(pos) { }
  onMouseDownRight(pos) { }
  onMouseMove(pos) { }
  onMouseUp(pos) { }
  onMouseUpRight(pos) { }
  onSearchMouseDown(pos) { }
  onSearchMouseDownRight(pos) { }
  onSearchMouseMove(pos) { }
  onSearchMouseUp(pos) { }
  onSearchMouseUpRight(pos) { }
  onSerchTouch(pos) { }
  onTouch(pos) { }

  // 位置・倍率・表示状態をまとめて設定する（レイアウト切り替え用）
  place(params) {
    Object.assign(this, params);
    return this;
  }

  resize(data) {
    this.scale = data.scale;
    // 子要素のリサイズ処理を呼び出す
    this.childs.forEach(child => {
      if (child.resize) {
        child.resize(data);
      }
    });
  }

  isTouched(pos) {
    if (-this.width / 2 < pos.x && pos.x < this.width / 2 &&
      -this.height / 2 < pos.y && pos.y < this.height / 2) {
      return true;
    }
    return false;
  }

  // 戻り値: 押下（mousedown）をこのUIか子要素が処理した（ボタンが押された）とき true。
  // Scene は true を受け取ると、奥にある他のUI（盤など）にはその押下を渡さない
  touchCheck(pos, str) {
    if (!this.visible) return false;
    const cpos = { x: (pos.x - this.x) / this.zoom, y: (pos.y - this.y) / this.zoom };
    let consumed = false;
    if (this.isTouched(cpos)) {
      this.onSerchTouch();
      switch (str) {
        case 'mousedown':
          consumed = this.onSearchMouseDown(cpos) === true;
          break;
        case 'mousedown-right':
          this.onSearchMouseDownRight(cpos);
          break;
        case 'mousemove':
          this.onSearchMouseMove(cpos);
          break;
        case 'mouseup':
          this.onSearchMouseUp(cpos);
          break;
        case 'mouseup-right':
          this.onSearchMouseUpRight(cpos);
          break;
      }
    }
    for (const ui of this.childs) {
      if (ui.touchCheck(cpos, str) === true) consumed = true;
    }
    if (!this.touchable) return consumed;
    if (this.isTouched(cpos)) {
      this.touched = true;
      this.onTouch(cpos);
      switch (str) {
        case 'mousedown':
          this.onMouseDown(cpos);
          break;
        case 'mousedown-right':
          this.onMouseDownRight(cpos);
          break;
        case 'mousemove':
          this.onMouseMove(cpos);
          break;
        case 'mouseup':
          this.onMouseUp(cpos);
          break;
        case 'mouseup-right':
          this.onMouseUpRight(cpos);
          break;
      }
    } else {
      if (this.touched === true) {
        this.touched = false;
        this.unTouch();
      }
    }
    return consumed;
  }
  /**
   * @param {{x: number, y: number}} pos
   */

}


// 横画面の配置（コンストラクタで指定した値）を覚えておき、縦画面から戻すときに使う。
// 同じUIを複数のシーンで使い回すことがあるので、最初に覚えた値（=コンストラクタの値）だけを保持する
const LAYOUT_KEYS = ['x', 'y', 'zoom', 'width', 'height', 'position', 'textBaseline', 'maxWidth', 'reflow'];
const initialLayouts = new WeakMap();

export function rememberLayout(uis, keys = LAYOUT_KEYS) {
  for (const ui of uis) {
    if (!ui || initialLayouts.has(ui)) continue;
    const layout = {};
    for (const key of keys) layout[key] = ui[key];
    initialLayouts.set(ui, layout);
  }
}

export function restoreLayout(uis) {
  for (const ui of uis) {
    const layout = ui && initialLayouts.get(ui);
    if (layout) Object.assign(ui, layout);
  }
}


export class Background extends UI {
  color;
  constructor(params) {
    super(params);
    this.color = params.color;
  }
  renderSelf(ctx, scale) {
    ctx.fillStyle = this.color;
    ctx.fillRect(-window.innerWidth * 127, -window.innerHeight * 127, window.innerWidth * 255, window.innerHeight * 255);
  }
}





export class OverlayUI extends UI {
  color;

  constructor(params) {
    super(params);
    this.color = params.color ?? OVERLAY_COLOR;
    this.width = params.width;
    this.height = params.height;
    this.borderRadius = params.borderRadius ?? 0.02;
  }

  renderSelf(ctx, scale) {

    ctx.fillStyle = this.color;
    const scaledBorderRadius = (this.borderRadius / 2) * scale;
    const scaledWidth = (this.width) * scale;
    const scaledHeight = (this.height) * scale;
    const x = -scaledWidth / 2;
    const y = -scaledHeight / 2;

    ctx.beginPath();
    ctx.roundRect(x, y, scaledWidth, scaledHeight, scaledBorderRadius);
    ctx.fill();
  }
}