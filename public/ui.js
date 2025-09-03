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

    // まず自分を描画
    this.renderSelf(ctx, scale);

    // 次に子供を描画
    for (const ui of this.childs) {
      ui.draw(ctx, scale);
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

  touchCheck(pos, str) {
    if (!this.visible) return;
    const cpos = { x: pos.x - this.x, y: pos.y - this.y };
    if (this.isTouched(cpos)) {
      this.onSerchTouch();
      switch (str) {
        case 'mousedown':
          this.onSearchMouseDown(cpos);
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
    this.childs.forEach(ui => ui.touchCheck(cpos, str));
    if (!this.touchable) return false;
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
    return false;
  }
  /**
   * @param {{x: number, y: number}} pos
   */

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