import { TextUI } from "./ui_text.js";
import { characterImages, audioManager, onClick, characterVideos, strings } from "./main.js";
import { OverlayUI, UI } from "./ui.js";
import { CHARACTER_FOLDER, NUM_QUOTES, OVERLAY_COLOR } from "./const.js";

// キャラクター画像を表示するためのUIクラス
export class CharacterImageUI extends UI {
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

    this.textsize = 0.035;
    this.voiceTextOverlay = new OverlayUI({
      color: OVERLAY_COLOR,
      x: 0.2,
      y: 0.15,
      width: 0,
      height: 0.035 + 0.04
    });
    this.voiceText = new TextUI({
      text: () => {
        return "";
      },
      x: 0.0,
      y: 0.0,
      size: 0.035,
      colors: ["#ffffff", "#00000000", "#00000000"],
      position: 'center'
    });
    this.voiceTextOverlay.add(this.voiceText);
    this.add(this.voiceTextOverlay);
  }
  init() {
    this.videoElement = [];

    if (this.image && characterImages[this.image]) {
      for (let i = 0; i < NUM_QUOTES; i++) {
        const videoKey = `click${i + 1}`;

        // 事前読み込んだ動画を複製して使用
        this.videoElement.push(characterVideos[this.image][videoKey].cloneNode());

        this.videoElement[i].loop = false;
        this.videoElement[i].addEventListener('ended', () => {
          this.currentVideo = null;
          this.isRenderingVideo = false; // 動画描画フラグをオフ
        });

        // エラーハンドリング
        this.videoElement[i].addEventListener('error', (e) => {
          console.error('動画の読み込みまたは再生に失敗しました:', e);
          this.currentVideo = null;
          this.isRenderingVideo = false; // 動画描画フラグをオフ
        });
      }
    }
  }

  renderSelf(ctx, scale) {
    // 動画が再生可能で、動画を描画中の場合は動画フレームを描画
    if (this.currentVideo && this.isRenderingVideo && !this.currentVideo.paused && !this.currentVideo.ended && this.currentVideo.currentTime !== 0) {
      try {
        ctx.drawImage(this.currentVideo, - this.width / 2 * scale, - this.height / 2 * scale, this.width * scale, this.height * scale);
      } catch (e) {
        // 動画がまだ描画可能な状態でない場合のエラーを無視
        if (!(e instanceof DOMException && e.name === 'InvalidStateError')) {
          console.error('動画の描画中にエラーが発生しました:', e);
          this.currentVideo = null;
          this.isRenderingVideo = false; // エラーが発生したら動画描画を停止
        }
      }
    } else {
      // 動画を描画中でない場合、または動画がない場合は画像を描画
      if (this.image && characterImages[this.image]) {
        // 画像を中央揃えで描画
        ctx.drawImage(characterImages[this.image], - this.width / 2 * scale, - this.height / 2 * scale, this.width * scale, this.height * scale);
      }
    }
  }

  onMouseDown(pos) {
    if (onClick) return;
    let randomIndex = Math.floor(Math.random() * NUM_QUOTES - 1);
    if (randomIndex >= this.lastVideoidx) {
      randomIndex++;
    }
    if (this.playVideo(randomIndex)) {
      this.spawnVoiceText(randomIndex);
    }
  }

  resize(data) {
    super.resize(data); // 親クラスのresizeを呼び出す
    // canvasに描画する場合は動画要素自体のサイズ変更は不要
  }

  playVideo(randomIndex) {
    // videoElement が存在し、動画が既に再生中の場合は何もしない
    if (this.videoElement.length < NUM_QUOTES || this.isRenderingVideo) {
      console.log('動画の再生準備ができていません、または既に再生中です。');
      return false;
    }

    // readyStateのチェックを削除（事前読み込み済みのため）
    if (!this.videoElement[randomIndex]) {
      console.log('動画の再生準備ができていません、または既に再生中です。');
      return false;
    }

    this.currentVideo = this.videoElement[randomIndex];

    this.isRenderingVideo = true; // 動画描画フラグをオン
    this.currentVideo.currentTime = 0; // 最初から再生
    this.currentVideo.volume = audioManager.voiceVolume; // 音量を設定
    this.currentVideo.play().catch(error => {
      console.error('動画の再生開始に失敗しました:', error);
      this.currentVideo = null;
      this.isRenderingVideo = false; // 再生開始に失敗したらフラグをオフ
    });
    this.lastVideoidx = randomIndex;
    return true;
  }

  stopVideo() {
    if (this.currentVideo) {
      this.currentVideo.pause();
      this.currentVideo.currentTime = 0;
      this.currentVideo = null;
      this.isRenderingVideo = false;
      this.voiceText.text = () => { return `` };
      this.voiceTextOverlay.width = 0;
    }
  }

  spawnVoiceText(randomIndex) {
    // 参照で読み取ることで言語変更時に自動的に更新されるようにする
    const currentStrings = strings;

    // テキストの長さを正しく取得して幅を設定
    this.voiceText.text = () => {
      const quotes = currentStrings["characters"][this.image]["quotes"];
      return quotes[randomIndex] || "";
    };

    // 実際に描画されるテキストの長さを計算するために、一度テキストを更新してから取得
    const quoteText = currentStrings["characters"][this.image]["quotes"][randomIndex] || "";

    // Canvasを使用して実際の文字幅を測定
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // テキストスタイルを設定（UIと同じように）
      ctx.font = `${this.textsize * 100}px Arial, sans-serif`; // 100倍のサイズで測定
      ctx.textAlign = 'center';

      // 実際のテキスト幅を取得
      const textMetrics = ctx.measureText(quoteText);
      const actualPixelWidth = textMetrics.width;

      // Canvas全体に対する相対的な幅に変換（100倍して測定したので戻す）
      const relativeWidth = (actualPixelWidth / 100) + 0.02; // 少し余白を追加

      // 最小幅と最大幅の制限を設ける
      const minWidth = 0.15; // 最小幅
      const maxWidth = 1;  // 最大幅
      this.voiceTextOverlay.width = Math.max(minWidth, Math.min(maxWidth, relativeWidth));
    }

    // 既存のイベントリスナーが重複しないように一度削除してから追加
    const existingEndedListener = this.currentVideo._endedHandler;
    if (existingEndedListener) {
      this.currentVideo.removeEventListener('ended', existingEndedListener);
    }

    this.currentVideo._endedHandler = () => {
      setTimeout(() => {
        if (this.currentVideo === null) {
          this.voiceText.text = () => { return `` };
          this.voiceTextOverlay.width = 0;
        }
      }, 700);
    };

    this.currentVideo.addEventListener('ended', this.currentVideo._endedHandler);
  }
}

export class CharacterInGameUI extends UI {
  image; // Imageオブジェクト
  videoElement = []; // Video要素
  startVideoElement = [];
  winVideoElement = [];
  currentVideo = null;
  isRenderingVideo = false; // 動画を描画中かどうかのフラグ
  voiceTextOverlay;
  voiceText;

  constructor(params) {
    super(params);
    this.image = params.image;
    this.width = params.width;
    this.height = params.height;
    this.textsize = 0.018;
    this.voiceTextOverlay = new OverlayUI({
      color: OVERLAY_COLOR,
      x: 0.0,
      y: 0.12,
      width: 0,
      height: 0.018 + 0.02
    });
    this.voiceText = new TextUI({
      text: () => {
        return "";
      },
      x: 0.0,
      y: 0.0,
      size: 0.018,
      colors: ["#ffffff", "#00000000", "#00000000"],
      position: 'center'
    });
    this.voiceTextOverlay.add(this.voiceText);
    this.add(this.voiceTextOverlay);
    this.init();
  }

  init() {
    if (this.image && characterImages[this.image]) {
      // 開始動画の設定
      this.startVideoElement.push(characterVideos[this.image]['start'].cloneNode());

      this.startVideoElement[0].loop = false;
      this.startVideoElement[0].addEventListener('ended', () => {
        this.currentVideo = null;
        this.isRenderingVideo = false; // 動画描画フラグをオフ
      });

      // エラーハンドリング
      this.startVideoElement[0].addEventListener('error', (e) => {
        console.error('動画の読み込みまたは再生に失敗しました:', e);
        this.currentVideo = null;
        this.isRenderingVideo = false; // 動画描画フラグをオフ
      });

      // 勝利動画の設定
      this.winVideoElement.push(characterVideos[this.image]['win'].cloneNode());

      this.winVideoElement[0].loop = false;
      this.winVideoElement[0].addEventListener('ended', () => {
        this.currentVideo = null;
        this.isRenderingVideo = false; // 動画描画フラグをオフ
      });

      // エラーハンドリング
      this.winVideoElement[0].addEventListener('error', (e) => {
        console.error('動画の読み込みまたは再生に失敗しました:', e);
        this.currentVideo = null;
        this.isRenderingVideo = false; // 動画描画フラグをオフ
      });
    }
  }

  renderSelf(ctx, scale) {
    // 動画が再生可能で、動画を描画中の場合は動画フレームを描画
    if (this.currentVideo !== null && this.isRenderingVideo && !this.currentVideo.paused && !this.currentVideo.ended && this.currentVideo.currentTime !== 0) {
      try {
        ctx.drawImage(this.currentVideo, -this.width / 2 * scale, -this.height / 2 * scale, this.width * scale, this.height * scale);
      } catch (e) {
        // 動画がまだ描画可能な状態でない場合のエラーを無視
        if (!(e instanceof DOMException && e.name === 'InvalidStateError')) {
          console.error('動画の描画中にエラーが発生しました:', e);
          this.currentVideo = null;
          this.isRenderingVideo = false; // エラーが発生したら動画描画を停止
        }
      }
    } else {
      // 動画を描画中でない場合、または動画がない場合は画像を描画
      if (this.image && characterImages[this.image]) {
        // 画像を中央揃えで描画
        ctx.drawImage(characterImages[this.image], -this.width / 2 * scale, -this.height / 2 * scale, this.width * scale, this.height * scale);
      }
    }
  }

  resize(data) {
    super.resize(data); // 親クラスのresizeを呼び出す
    // canvasに描画する場合は動画要素自体のサイズ変更は不要
  }

  playStartVideo(idx) {
    // videoElement が存在し、動画が既に再生中の場合は何もしない
    if (this.startVideoElement.length === 0 || this.isRenderingVideo) {
      console.log('動画の再生準備ができていません、または既に再生中です。');
      return;
    }

    // readyStateのチェックを削除（事前読み込み済みのため）
    if (!this.startVideoElement[idx]) {
      console.log('動画の再生準備ができていません、または既に再生中です。');
      return;
    }

    this.currentVideo = this.startVideoElement[idx];

    this.isRenderingVideo = true; // 動画描画フラグをオン
    this.currentVideo.volume = audioManager.voiceVolume; // 音量を設定
    this.currentVideo.currentTime = 0; // 最初から再生
    this.currentVideo.play().catch(error => {
      console.error('動画の再生開始に失敗しました:', error);
      this.currentVideo = null;
      this.isRenderingVideo = false; // 再生開始に失敗したらフラグをオフ
    });
    this.spawnVoiceText("start_quotes", idx);
  }

  playWinVideo(idx) {
    // videoElement が存在し、動画が既に再生中の場合は何もしない
    if (this.winVideoElement.length === 0 || this.isRenderingVideo) {
      console.log('動画の再生準備ができていません、または既に再生中です。');
      return false;
    }

    // readyStateのチェックを削除（事前読み込み済みのため）
    if (!this.winVideoElement[idx]) {
      console.log('動画の再生準備ができていません、または既に再生中です。');
      return false;
    }

    this.currentVideo = this.winVideoElement[idx];

    this.currentVideo.volume = audioManager.voiceVolume; // 音量を設定
    this.isRenderingVideo = true; // 動画描画フラグをオン
    this.currentVideo.currentTime = 0; // 最初から再生
    this.currentVideo.play().catch(error => {
      console.error('動画の再生開始に失敗しました:', error);
      this.currentVideo = null;
      this.isRenderingVideo = false; // 再生開始に失敗したらフラグをオフ
    });
    this.spawnVoiceText("win_quotes", idx);
    return true; // 動画の再生が成功
  }

  spawnVoiceText(type, randomIndex) {
    // 参照で読み取ることで言語変更時に自動的に更新されるようにする
    const currentStrings = strings;

    // テキストの長さを正しく取得して幅を設定
    this.voiceText.text = () => {
      const quotes = currentStrings["characters"][this.image][type];
      return quotes[randomIndex] || "";
    };

    // 実際に描画されるテキストの長さを計算するために、一度テキストを更新してから取得
    const quoteText = currentStrings["characters"][this.image][type][randomIndex] || "";

    // Canvasを使用して実際の文字幅を測定
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // テキストスタイルを設定（UIと同じように）
      ctx.font = `${this.textsize * 100}px Arial, sans-serif`; // 100倍のサイズで測定
      ctx.textAlign = 'center';

      // 実際のテキスト幅を取得
      const textMetrics = ctx.measureText(quoteText);
      const actualPixelWidth = textMetrics.width;

      // Canvas全体に対する相対的な幅に変換（100倍して測定したので戻す）
      const relativeWidth = (actualPixelWidth / 100) + 0.02; // 少し余白を追加

      // 最小幅と最大幅の制限を設ける
      const minWidth = 0.15; // 最小幅
      const maxWidth = 1.5;  // 最大幅
      this.voiceTextOverlay.width = Math.max(minWidth, Math.min(maxWidth, relativeWidth));
    }

    // 既存のイベントリスナーが重複しないように一度削除してから追加
    const existingEndedListener = this.currentVideo._endedHandler;
    if (existingEndedListener) {
      this.currentVideo.removeEventListener('ended', existingEndedListener);
    }

    this.currentVideo._endedHandler = () => {
      setTimeout(() => {
        if (this.currentVideo === null) {
          this.voiceText.text = () => { return `` };
          this.voiceTextOverlay.width = 0;
        }
      }, 700);
    };

    this.currentVideo.addEventListener('ended', this.currentVideo._endedHandler);
  }
}

