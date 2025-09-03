import { UI } from "./ui.js";

export class LoadingUI extends UI {
  constructor(params) {
    super(params);
    this.x = params.x;
    this.y = params.y;
    this.width = 0;
    this.height = 0;
    this.scale = params.scale;
    this.radius = params.radius;
    this.loadingAngle = 0;
  }

  renderSelf(ctx, scale) {
    ctx.save();
    const radius = this.radius * scale;
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, radius, this.loadingAngle, this.loadingAngle + Math.PI / 2);
    ctx.stroke();

    // 角度を更新
    this.loadingAngle += 0.05;
    if (this.loadingAngle > Math.PI * 2) {
      this.loadingAngle = 0;
    }
    ctx.restore();
  }
}