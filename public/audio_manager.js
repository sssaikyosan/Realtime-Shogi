import { SOUND_FOLDER } from "./const.js";

export class AudioManager {
    currentVoice = null;
    currentBGM = null;

    bgmVolume = 1;
    soundVolume = 1;
    voiceVolume = 1;

    bgmDict = {};
    soundDict = {};
    voiceDict = {};

    constructor() {
        this.loadVolumeSettings(); // アプリケーション起動時に設定を読み込む
        this.addBGM('title', 0.25);
        this.addBGM('battle', 0.18);
    }

    addBGM(filename, originalVolume) {
        const audio = new Audio(`/music/${filename}.mp3`);
        audio.onended = () => {
            audio.currentTime = 0; // 再生位置を最初に戻す
            audio.play(); // 再度再生を開始する
        };
        this.bgmDict[filename] = { audio: audio, originalVolume: originalVolume };
    }

    setBGMVolume(volume) {
        this.bgmVolume = Math.max(0.0, Math.min(1.0, volume)); // 0.0から1.0の範囲に制限
        // 現在再生中のBGMの音量も更新
        if (this.currentBGM) {
            this.bgmDict[this.currentBGM].audio.volume = this.bgmVolume * this.bgmDict[this.currentBGM].originalVolume; // 元の音量に掛け合わせる
        }
        this.saveVolumeSettings(); // 設定変更時に保存
    }

    // 効果音音量を設定する関数
    setSoundVolume(volume) {
        this.soundVolume = Math.max(0.0, Math.min(1.0, volume)); // 0.0から1.0の範囲に制限
        // 現在再生中の音声の音量も更新
        // 効果音とボイスでcurrentVoiceを共有しているため、ここではsoundVolumeのみを適用
        // playSoundやplayVoice内でそれぞれのvolumeを適用する
        this.saveVolumeSettings(); // 設定変更時に保存
    }


    // キャラボイス音量を設定する関数
    setVoiceVolume(volume) {
        this.voiceVolume = Math.max(0.0, Math.min(1.0, volume)); // 0.0から1.0の範囲に制限
        // 現在再生中の音声の音量も更新
        // 効果音とボイスでcurrentVoiceを共有しているため、ここではvoiceVolumeのみを適用
        // playSoundやplayVoice内でそれぞれのvolumeを適用する
        this.saveVolumeSettings(); // 設定変更時に保存
    }

    playSound(filename) {
        const audio = new Audio(`/${SOUND_FOLDER}/${filename}.mp3`);
        audio.volume = this.soundVolume; // 効果音音量を適用
        audio.play();
    }

    playVoice(filename, onComplete) {
        // 現在再生中の音声があれば停止
        if (this.currentVoice) {
            this.currentVoice.pause();
            this.currentVoice.currentTime = 0; // 再生位置をリセット
        }

        const audio = new Audio(filename);
        audio.volume = this.voiceVolume; // キャラボイス音量を適用
        audio.play();

        this.currentVoice = audio; // 新しい音声を保持

        // 音声再生完了時のコールバックを設定
        audio.onended = () => {
            if (onComplete && typeof onComplete === 'function') {
                onComplete();
            }
            this.currentVoice = null; // 再生完了したら参照をクリア
        };
    }

    playBGM(bgm) {
        if (!this.bgmDict[bgm]) {
            console.log('no BGM', bgm);
            return;
        }
        // 現在再生中のBGMがあれば停止
        if (this.currentBGM) {
            this.bgmDict[this.currentBGM].audio.pause();
            if (this.bgmDict[this.currentBGM].audio.currentTime > 0) { // 再生位置が0より大きい場合のみリセット
                this.bgmDict[this.currentBGM].audio.currentTime = 0;
            }
        }

        this.bgmDict[bgm].loop = false; // BGMはループ再生
        this.bgmDict[bgm].audio.volume = this.bgmVolume * this.bgmDict[bgm].originalVolume; // マスター音量と元の音量を掛け合わせる
        this.bgmDict[bgm].audio.play();

        this.currentBGM = bgm; // 新しいBGMを保持
    }

    stopBGM() {
        if (this.currentBGM) {
            this.bgmDict[this.currentBGM].audio.pause();
            if (this.bgmDict[this.currentBGM].audio.currentTime > 0) { // 再生位置が0より大きい場合のみリセット
                this.bgmDict[this.currentBGM].audio.currentTime = 0;
            }
            this.currentBGM = null; // BGM参照をクリア
        }
    }

    // 音量設定をローカルストレージに保存する
    saveVolumeSettings() {
        try {
            const settings = {
                bgmVolume: this.bgmVolume,
                soundVolume: this.soundVolume,
                voiceVolume: this.voiceVolume
            };
            localStorage.setItem('volumeSettings', JSON.stringify(settings));
        } catch (e) {
            console.error('ローカルストレージへの保存に失敗しました:', e);
        }
    }

    // ローカルストレージから音量設定を読み込む
    loadVolumeSettings() {
        try {
            const settingsString = localStorage.getItem('volumeSettings');
            if (settingsString) {
                const settings = JSON.parse(settingsString);
                // 読み込んだ設定が有効な数値か確認し、一時変数に格納。無効な場合はデフォルト値を使用。
                const loadedBgmVolume = (typeof settings.bgmVolume === 'number' && isFinite(settings.bgmVolume)) ? settings.bgmVolume : 0.2;
                const loadedSoundVolume = (typeof settings.soundVolume === 'number' && isFinite(settings.soundVolume)) ? settings.soundVolume : 0.5;
                const loadedVoiceVolume = (typeof settings.voiceVolume === 'number' && isFinite(settings.voiceVolume)) ? settings.voiceVolume : 0.2;

                // 一時変数に格納した値を使って音量プロパティを設定
                this.setBGMVolume(loadedBgmVolume);
                this.setSoundVolume(loadedSoundVolume);
                this.setVoiceVolume(loadedVoiceVolume);

            } else {
                // 設定がない場合はデフォルト値をセット
                this.setBGMVolume(0.2);
                this.setSoundVolume(0.2);
                this.setVoiceVolume(0.2);
            }
        } catch (e) {
            console.error('ローカルストレージからの読み込みに失敗しました:', e);
            // 読み込み失敗時もデフォルト値をセット
            this.setBGMVolume(0.2);
            this.setSoundVolume(0.2);
            this.setVoiceVolume(0.2);
        }
    }
}