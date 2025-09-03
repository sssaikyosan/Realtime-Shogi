import { characterImages } from "./main.js";
import { UI } from "./ui.js";

export class ImageUI extends UI {
  image; // Imageオブジェクト
  videoElement = []; // Video要素
  startVideoElement = [];
  winVideoElement = [];
  currentVideo = null;
  isRenderingVideo = false; // 動画を描画中かどうかのフラグ
  voiceTextOverlay;
  voiceText;
  lastVideoidx = 0;

  constructor(params) {
    super(params);
    this.image = params.image;
    this.width = params.width;
    this.height = params.height;
  }


  renderSelf(ctx, scale) {
    ctx.drawImage(characterImages[this.image], this.x * scale - this.width / 2 * scale, this.y * scale - this.height / 2 * scale, this.width * scale, this.height * scale);
  }

  onMouseDown(pos) {
  }

  resize(data) {
    super.resize(data); // 親クラスのresizeを呼び出す
  }
}