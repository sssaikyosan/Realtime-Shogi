//タイトルシーン要素

import { createPlayScene } from "./scene_game.js";
import { serverStatus, title_img, audioManager, setPlayerName, playerName, socket, selectedCharacterName, player_id, setScene, characterFiles, setSelectedCharacterName, connectToServer, strings, playerStatus, setStatus, setStrings, setSceneType, scene, isTouchDevice, PORTRAIT_NAME_INPUT_Y, PORTRAIT_ROOM_INPUT } from "./main.js";
import { Scene } from "./scene.js";
import { OverlayUI, rememberLayout, restoreLayout } from "./ui.js";
import { BackgroundImageUI } from "./ui_background.js";
import { CharacterImageUI } from "./ui_character.js";
import { LoadingUI } from "./ui_loading.js";
import { TextUI } from "./ui_text.js";
import { KOMADAI_TYPES, LANGUAGES, MOVETIME, PROMOTE_TYPES } from "./const.js";
import { ImageUI } from "./ui_image.js";
import { ButtonUI } from "./ui_button.js";
import { PieceHelpUI } from "./piece_help.js";

export const discordButton = document.getElementById("discordButton");

export const roomIdInput = /** @type {HTMLInputElement} */ (document.getElementById("roomIdInput"));
export const nameInput = /** @type {HTMLInputElement} */ (document.getElementById("nameInput"));
export const settingsButton = document.getElementById("settingsButton");
export const bgmVolumeText = document.querySelector('label[for="bgmVolumeSlider"]');
export const seVolumeText = document.querySelector('label[for="soundVolumeSlider"]');
export const voiceVolumeText = document.querySelector('label[for="voiceVolumeSlider"]');

const languageOverlay = new OverlayUI({
    x: -0.78,
    y: -0.36,
    height: 0.13,
    width: 0.11,
    visible: false
});

let langY = 0.0;
for (const lang in LANGUAGES) {
    const langButton = new ButtonUI({
        text: LANGUAGES[lang],
        x: 0.0,
        y: -0.046 + langY,
        height: 0.024,
        width: 0.1,
        color: '#3241c9',
        textSize: 0.014,
        textColors: ['#ffffffff', '#00000000', '#00000000'],
        onClick: () => {
            setStrings(lang);
            setScene(createTitleScene());
        }
    });
    languageOverlay.add(langButton);
    langY += 0.03;
}

const cpuLevelOverlay = new OverlayUI({
    x: 0.65,
    y: 0.16,
    height: 0.235,
    width: 0.11,
    visible: false
});

for (let i = 1; i <= 5; i++) {
    const cpulevelButton = new ButtonUI({
        text: `level${i}`,
        x: 0.0,
        y: 0.09 - (i - 1) * 0.045,
        height: 0.04,
        width: 0.1,
        color: '#3241c9',
        textSize: 0.025,
        textColors: ['#ffffffff', '#00000000', '#00000000'],
        onClick: () => {
            cpuLevelSubmit(i.toString());
        }
    });
    cpuLevelOverlay.add(cpulevelButton);
}

export const statusOverlay = new OverlayUI({
    x: -0.78,
    y: 0.43,
    width: 0.2,
    height: 0.1,
    color: '#111122bb'
});

export const playCountText = new TextUI({
    text: () => ``,
    x: 0,
    y: -0.015,
    size: 0.025,
    colors: ["#ffffff", "#00000000", "#00000000"],
    position: 'center'
});

export const ratingText = new TextUI({
    text: () => ``,
    x: 0,
    y: 0.025,
    size: 0.025,
    colors: ["#ffffff", "#00000000", "#00000000"],
    position: 'center'
});

export const cancelMatchButton = new ButtonUI({
    text: ``,
    x: 0.65,
    y: 0.4,
    height: 0.08,
    width: 0.24,
    color: '#df398c',
    textSize: 0.04,
    textColors: ['#ffffffff', '#00000000', '#00000000'],
    onClick: () => {
        if (socket) {
            socket.emit('cancelMatch');
        }
    }
});

const rankingOverlay = new OverlayUI({
    x: 0.72,
    y: -0.22,
    width: 0.3,
    height: 0.36
});

const rankingTitle = new TextUI({
    text: () => {
        return ``
    },
    x: 0,
    y: -0.15,
    size: 0.03,
    colors: ["#ffffffff", "#00000000", "#00000000"]
});

for (let i = 0; i < 10; i++) {
    const rankingText = new TextUI({
        text: () => {
            return ``
        },
        x: -0.13,
        y: -0.11 + i * 0.03,
        size: 0.022,
        colors: ["#ffffffff", "#00000000", "#00000000"],
        position: 'left'
    });
    rankingOverlay.add(rankingText);
}

const matchingText = new TextUI({
    text: () => {
        return ``;
    },
    x: 0.0,
    y: 0.4,
    size: 0.05,
    colors: ["#ffffff", "#00000000", "#00000000"],
    position: 'center'
});

const loading = new LoadingUI({
    x: 0.2,
    y: 0.4,
    radius: 0.03,
});

rankingOverlay.add(rankingTitle);
statusOverlay.add(playCountText);
statusOverlay.add(ratingText);

export function initTitleText() {
    nameInput.placeholder = strings['name'];

    roomIdInput.placeholder = strings['room-id'];
    settingsButton.textContent = strings['volume-setting'];
    bgmVolumeText.textContent = strings['bgm-volume'];
    seVolumeText.textContent = strings['se-volume'];
    voiceVolumeText.textContent = strings['voice-volume'];

    setStatus(playerStatus.rating, playerStatus.total_games);
    cancelMatchButton.text.text = () => {
        return `${strings['cancel']}`
    }
    rankingTitle.text = () => {
        return `${strings['ranking']}`
    }
    matchingText.text = () => {
        return `${strings['matching']}`
    }
}



export function clearTitleHTML() {
    discordButton.style.display = "none";
    roomIdInput.style.display = "none";
    nameInput.style.display = "none";
}

//タイトルシーン
export function createTitleScene(savedTitleCharacter = null, loadNameInput = true) {
    clearTitleHTML();

    setSceneType('title');
    let titleScene = new Scene();
    const backgroundImageUI = new BackgroundImageUI({ image: title_img });
    titleScene.add(backgroundImageUI);
    cpuLevelOverlay.visible = false;
    languageOverlay.visible = false;

    const playBGMOnce = () => {
        if (audioManager.currentBGM === null) {
            audioManager.playBGM('title');
        }
        document.removeEventListener('click', playBGMOnce);
    };
    document.addEventListener('click', playBGMOnce);

    function startOnlineMatch() {
        setPlayerName(nameInput.value.trim());
        localStorage.setItem("playerName", playerName);
        if (playerName == "") setPlayerName(`${strings['anonymous']}`);

        clearTitleHTML();
        titleScene.remove(joinRoomButton);
        titleScene.remove(makeRoomButton);
        titleScene.remove(cpuButton);
        titleScene.remove(cpuLevelOverlay);
        titleScene.remove(languageOverlay);
        titleScene.remove(charaSelectButton);
        titleScene.remove(playButton);
        titleScene.remove(langButton);
        titleScene.add(matchingText);
        titleScene.add(loading);
        titleScene.add(cancelMatchButton);



        connectToServer().then(socket => {
            socket.emit("requestMatch", { name: playerName, characterName: selectedCharacterName, player_id: player_id });
        }).catch(err => {
            console.error("Failed to connect for matching:", err);
            alert("failed to connect server");
            setScene(createTitleScene());
        });
    }

    function makeRoomSubmit() {
        setPlayerName(nameInput.value.trim());
        localStorage.setItem("playerName", playerName);
        if (playerName == "") setPlayerName(`${strings['anonymous']}`);

        connectToServer().then(socket => {
            socket.emit("createRoom", { name: playerName, characterName: selectedCharacterName, player_id: player_id });
        }).catch(err => {
            console.error("Failed to connect for creating room:", err);
            alert("failed to connect server");
            setScene(createTitleScene());
        });
    }

    function joinRoomSubmit() {
        setPlayerName(nameInput.value.trim());
        localStorage.setItem("playerName", playerName);
        if (playerName == "") setPlayerName(`${strings['anonymous']}`);
        const roomId = roomIdInput.value.trim();
        if (roomId) {
            connectToServer().then(socket => {
                socket.emit("joinRoom", { roomId: roomId, name: playerName, characterName: selectedCharacterName, player_id: player_id });
            }).catch(err => {
                console.error("Failed to connect for joining room:", err);
                alert("failed to connect server");
            });
        } else {
            roomJoinFailed();
        }
    }

    function charaSelectSubmit() {
        setScene(createCharacterSelectScene(titleCharacter));
    }

    updateRanking();

    const title = new TextUI({
        text: () => `${strings['title']}`,
        x: 0,
        y: -0.3,
        size: 0.12,
        colors: ["#c2a34f", "#000000", "#ffffff"]
    });
    titleScene.add(title);

    const announce = new TextUI({
        text: () => `${serverStatus.announcement}`,
        x: -0.7,
        y: -0.48,
        size: 0.025,
        colors: ["#ffffff", "#000000", "#00000000"],
        position: "left",
        textBaseline: "top"
    });
    titleScene.add(announce);

    let titleCharacter = savedTitleCharacter;
    if (titleCharacter === null) {
        titleCharacter = new CharacterImageUI({
            image: selectedCharacterName,
            x: -0.55,
            y: 0.15,
            width: 0.7,
            height: 0.7,
            touchable: true
        });
        titleCharacter.init();
    }
    titleScene.add(titleCharacter);

    const playButton = new ButtonUI({
        text: `${strings['online-match']}`,
        x: 0.65,
        y: 0.4,
        height: 0.1,
        width: 0.4,
        color: '#df398c',
        textSize: 0.05,
        textColors: ['#ffffffff', '#00000000', '#00000000'],
        onClick: startOnlineMatch
    });
    titleScene.add(playButton);

    const makeRoomButton = new ButtonUI({
        text: `${strings['make-room']}`,
        x: 0.78,
        y: 0.3,
        height: 0.05,
        width: 0.12,
        color: '#3241c9',
        textSize: 0.025,
        textColors: ['#ffffffff', '#00000000', '#00000000'],
        onClick: makeRoomSubmit
    });
    titleScene.add(makeRoomButton);

    const joinRoomButton = new ButtonUI({
        text: `${strings['join-room']}`,
        x: 0.64,
        y: 0.3,
        height: 0.05,
        width: 0.12,
        color: '#3241c9',
        textSize: 0.025,
        textColors: ['#ffffffff', '#00000000', '#00000000'],
        onClick: joinRoomSubmit
    });
    titleScene.add(joinRoomButton);

    const cpuButton = new ButtonUI({
        text: `${strings['cpu-match']}`,
        x: 0.78,
        y: 0.24,
        height: 0.05,
        width: 0.12,
        color: '#3241c9',
        textSize: 0.025,
        textColors: ['#ffffffff', '#00000000', '#00000000'],
        onClick: cpuButtonSubmit
    });
    titleScene.add(cpuButton);

    const langButton = new ButtonUI({
        text: `${strings['language']}`,
        x: -0.8,
        y: -0.46,
        height: 0.05,
        width: 0.12,
        color: '#3241c9',
        textSize: 0.025,
        textColors: ['#ffffffff', '#00000000', '#00000000'],
        onClick: () => {
            languageOverlay.visible = !languageOverlay.visible;
        }
    });
    titleScene.add(langButton);

    const winConditionOverlay = new OverlayUI({
        x: 0,
        y: 0,
        height: 0.42,
        width: 1,
        visible: false
    });
    const winConditionTitle = new TextUI({
        text: () => `${strings['win-condition']}`,
        x: 0,
        y: -0.14,
        size: 0.06,
        colors: ['#ffffffff', '#000000ff', '#00000000'],
    });
    const winConditionText = new TextUI({
        text: () => `${strings['rule-text']}`,
        x: -0.26,
        y: -0.06,
        size: 0.025,
        colors: ['#ffffffff', '#00000000', '#00000000'],
        position: 'left'
    });
    const closeWinConditionButton = new ButtonUI({
        text: `${strings['close']}`,
        x: 0,
        y: 0.16,
        width: 0.15,
        height: 0.05,
        color: '#3241c9',
        textSize: 0.026,
        textColors: ['#ffffffff', '#00000000', '#00000000'],
        onClick: () => showHelp(null)
    });

    const pieceHelpOverlay = new OverlayUI({
        x: 0,
        y: 0,
        height: 0.42,
        width: 1,
        visible: false
    });

    const pieceListTitle = new TextUI({
        text: () => `${strings['piece-list']}`,
        x: 0,
        y: -0.14,
        size: 0.06,
        colors: ['#ffffffff', '#000000ff', '#00000000'],
    });



    const closePieceHelpButton = new ButtonUI({
        text: `${strings['close']}`,
        x: 0,
        y: 0.16,
        width: 0.15,
        height: 0.05,
        color: '#3241c9',
        textSize: 0.026,
        textColors: ['#ffffffff', '#00000000', '#00000000'],
        onClick: () => showHelp(null)
    });



    const ctrlOverlay = new OverlayUI({
        x: 0,
        y: 0,
        height: 0.42,
        width: 1,
        visible: false
    });

    const ctrlTitle = new TextUI({
        text: () => `${strings['manual']}`,
        x: 0,
        y: -0.14,
        size: 0.06,
        colors: ['#ffffffff', '#000000ff', '#00000000'],
    });

    const ctrlText = new TextUI({
        text: () => `${isTouchDevice ? strings['manual-text-touch'] : strings['manual-text']}`,
        x: -0.15,
        y: -0.06,
        size: 0.025,
        colors: ['#ffffffff', '#00000000', '#00000000'],
        position: 'left'
    });

    const closeCtrlButton = new ButtonUI({
        text: `${strings['close']}`,
        x: 0,
        y: 0.16,
        width: 0.15,
        height: 0.05,
        color: '#3241c9',
        textSize: 0.026,
        textColors: ['#ffffffff', '#00000000', '#00000000'],
        onClick: () => showHelp(null)
    });

    const pieceListButton = new ButtonUI({
        text: `${strings['piece-list']}`,
        x: -0.4,
        y: -0.15,
        width: 0.15,
        height: 0.05,
        color: '#3241c9',
        textSize: 0.026,
        textColors: ['#ffffffff', '#00000000', '#00000000'],
        onClick: () => showHelp(pieceHelpOverlay)
    });

    const ctrlButton = new ButtonUI({
        text: `${strings['manual']}`,
        x: -0.4,
        y: -0.09,
        height: 0.05,
        width: 0.15,
        color: '#3241c9',
        textSize: 0.026,
        textColors: ['#ffffffff', '#00000000', '#00000000'],
        onClick: () => showHelp(ctrlOverlay)
    });

    const winConditionButton = new ButtonUI({
        text: `${strings['win-condition']}`,
        x: -0.4,
        y: -0.03,
        width: 0.15,
        height: 0.05,
        color: '#3241c9',
        textSize: 0.026,
        textColors: ['#ffffffff', '#00000000', '#00000000'],
        onClick: () => showHelp(winConditionOverlay)
    });

    pieceHelpOverlay.add(pieceListButton);
    ctrlOverlay.add(pieceListButton);
    winConditionOverlay.add(pieceListButton);

    pieceHelpOverlay.add(ctrlButton);
    ctrlOverlay.add(ctrlButton);
    winConditionOverlay.add(ctrlButton);

    pieceHelpOverlay.add(winConditionButton);
    ctrlOverlay.add(winConditionButton);
    winConditionOverlay.add(winConditionButton);

    pieceHelpOverlay.add(pieceListTitle);
    pieceHelpOverlay.add(closePieceHelpButton);

    ctrlOverlay.add(closeCtrlButton);
    ctrlOverlay.add(ctrlTitle);
    ctrlOverlay.add(ctrlText);

    winConditionOverlay.add(winConditionTitle);
    winConditionOverlay.add(winConditionText);
    winConditionOverlay.add(closeWinConditionButton);

    const pieceHelpUIs = [];
    let typeX = 0;
    for (const type of KOMADAI_TYPES) {
        const pieceHelp = new PieceHelpUI({
            pieceType: type,
            x: -0.24 + typeX,
            y: -0.04,
            width: 0.08,
            height: 0.08
        });
        typeX += 0.08;
        pieceHelpOverlay.add(pieceHelp);
        pieceHelpUIs.push({ ui: pieceHelp, col: pieceHelpUIs.length % KOMADAI_TYPES.length, row: 0 });
    }
    typeX = 0;
    for (const type of PROMOTE_TYPES) {
        if (type !== '') {
            const pieceHelp = new PieceHelpUI({
                pieceType: type,
                x: -0.24 + typeX,
                y: 0.06,
                width: 0.08,
                height: 0.08
            });

            pieceHelpOverlay.add(pieceHelp);
            pieceHelpUIs.push({ ui: pieceHelp, col: PROMOTE_TYPES.indexOf(type), row: 1 });
        }
        typeX += 0.08;
    }

    // ルール画面（駒一覧・操作方法・勝利条件）を切り替える。null で閉じる。
    // 名前・部屋ID の入力欄（キャンバスより手前に出るHTML）とは重ならない位置に置く（縦画面は onLayout で調整）
    function showHelp(target) {
        for (const overlay of [pieceHelpOverlay, ctrlOverlay, winConditionOverlay]) {
            overlay.visible = overlay === target;
        }
    }
    // ルール画面の枠内のタップは、奥にあるボタン（キャラ変更など）に渡さない
    for (const overlay of [pieceHelpOverlay, ctrlOverlay, winConditionOverlay]) {
        overlay.onSearchMouseDown = () => true;
    }

    const ruleButton = new ButtonUI({
        text: `${strings['rule']}`,
        x: 0.78,
        y: 0.02,
        height: 0.05,
        width: 0.12,
        color: '#3241c9',
        textSize: 0.025,
        textColors: ['#ffffffff', '#00000000', '#00000000'],
        onClick: () => showHelp(pieceHelpOverlay)
    });

    titleScene.add(ruleButton);

    const charaSelectButton = new ButtonUI({
        text: `${strings['change-character']}`,
        x: -0.58,
        y: 0.45,
        height: 0.06,
        width: 0.16,
        color: '#3241c9',
        textSize: 0.028,
        textColors: ['#ffffffff', '#00000000', '#00000000'],
        onClick: () => {
            titleCharacter.touchable = false;
            charaSelectSubmit();
            const cantouchCharacter = () => {
                titleCharacter.touchable = true;
            }
            document.addEventListener('pointerup', cantouchCharacter, { once: true });
        }
    });

    titleScene.add(rankingOverlay);
    titleScene.add(charaSelectButton);
    titleScene.add(statusOverlay);
    titleScene.add(cpuLevelOverlay);
    titleScene.add(languageOverlay);

    titleScene.add(pieceHelpOverlay);
    titleScene.add(ctrlOverlay);
    titleScene.add(winConditionOverlay);

    if (loadNameInput) {
        const savedName = localStorage.getItem("playerName");
        if (savedName) {
            nameInput.value = savedName;
        }
    }

    roomIdInput.value = '';
    discordButton.style.display = "block";
    roomIdInput.style.display = "flex";
    nameInput.style.display = "flex";

    const helpOverlays = [pieceHelpOverlay, ctrlOverlay, winConditionOverlay];
    const helpNavButtons = [pieceListButton, ctrlButton, winConditionButton];
    const helpTitles = [pieceListTitle, ctrlTitle, winConditionTitle];
    const helpCloseButtons = [closePieceHelpButton, closeCtrlButton, closeWinConditionButton];

    // 横画面の配置はコンストラクタで指定した値。縦画面から戻すときのために覚えておく
    const landscapeUIs = [
        title, announce, titleCharacter, playButton, makeRoomButton, joinRoomButton, cpuButton, langButton, ruleButton,
        charaSelectButton, languageOverlay, cpuLevelOverlay, statusOverlay, cancelMatchButton, rankingOverlay,
        matchingText, loading, ...helpOverlays, ...helpNavButtons, ...helpTitles, ...helpCloseButtons,
        winConditionText, ctrlText, ...pieceHelpUIs.map(p => p.ui)
    ];
    rememberLayout(landscapeUIs);
    // セリフ枠は表示中に幅が変わるので位置だけ覚える
    rememberLayout([titleCharacter.voiceTextOverlay], ['x', 'y']);

    titleScene.onLayout = (portrait, sc) => {
        if (!portrait) {
            // 横画面: コンストラクタで指定した配置に戻す
            restoreLayout(landscapeUIs);
            restoreLayout([titleCharacter.voiceTextOverlay]);
            return;
        }

        // 縦画面: 上から ボタン列 → お知らせ → タイトル → キャラ(+ランキング) → 名前 → 各種ボタン
        const top = -Math.max(0.889, Math.min(sc.halfHeight, 1.1));
        // 縦長の端末では下側のまとまりを余った高さの分だけ下げる（HTML入力欄も main.js で同じだけ下げる）
        const extra = -top - 0.889;
        const dy = extra * 0.6;
        sc.htmlOffsetY = dy;
        const smallZoom = 1.7; // 0.12×0.05 のボタンを指で押せる大きさにする
        langButton.place({ x: -0.5 + 0.02 + 0.06 * smallZoom, y: top + 0.07, zoom: smallZoom });
        ruleButton.place({ x: -0.5 + 0.04 + 0.18 * smallZoom, y: top + 0.07, zoom: smallZoom });
        languageOverlay.place({ x: langButton.x, y: top + 0.12 + 0.065 * smallZoom, zoom: smallZoom });
        announce.place({ x: -0.47, y: top + 0.15, zoom: 1.4 });
        title.place({ x: 0, y: top + 0.33, zoom: 0.7 });

        titleCharacter.place({ x: -0.12, y: -0.1 + dy * 0.5, width: 0.76 + extra * 0.4, height: 0.76 + extra * 0.4 });
        titleCharacter.voiceTextOverlay.place({ x: 0.12, y: 0.3 });
        rankingOverlay.place({ x: 0.3, y: -0.2 + dy * 0.5, zoom: 1.25 });

        statusOverlay.place({ x: -0.3, y: 0.33 + dy, zoom: 1.4 });
        charaSelectButton.place({ x: 0.28, y: 0.33 + dy, zoom: 1.4 });
        // 0.47 は名前入力欄（main.js の PORTRAIT_NAME_INPUT_Y）
        const rowY = PORTRAIT_ROOM_INPUT.y + dy;
        cpuButton.place({ x: -0.37, y: rowY, zoom: smallZoom });
        joinRoomButton.place({ x: 0.11, y: rowY, zoom: smallZoom });
        makeRoomButton.place({ x: 0.35, y: rowY, zoom: smallZoom });
        cpuLevelOverlay.place({ x: 0, y: 0.0, zoom: smallZoom });
        playButton.place({ x: 0, y: 0.76 + dy, zoom: 1.5 });
        cancelMatchButton.place({ x: 0, y: 0.76 + dy, zoom: 1.5 });
        matchingText.place({ x: -0.05, y: 0.58 + dy, zoom: 1.2 });
        loading.place({ x: 0.3, y: 0.58 + dy, zoom: 1.2 });

        // ヘルプ画面: ナビボタンを上に横並び、本文は大きめの文字で折り返す。
        // 上端のボタン列と名前入力欄（HTMLでキャンバスより手前に出る）の間の中央に置き、入力欄と重ねない
        const helpAreaTop = top + 0.13;
        const helpAreaBottom = PORTRAIT_NAME_INPUT_Y - 0.035 - 0.02 + dy; // 名前入力欄の上端の少し上
        helpOverlays.forEach(o => o.place({ y: (helpAreaTop + helpAreaBottom) / 2, height: 0.8 }));
        helpNavButtons.forEach((b, i) => b.place({ x: (i - 1) * 0.31, y: -0.33, zoom: 1.8 }));
        helpTitles.forEach(t => t.place({ y: -0.21, zoom: 1 }));
        helpCloseButtons.forEach(b => b.place({ y: 0.33, zoom: 1.8 }));
        winConditionText.place({ x: -0.45, y: -0.13, zoom: 1.5, maxWidth: 0.9 / 1.5 });
        ctrlText.place({ x: -0.45, y: -0.13, zoom: 1.5, maxWidth: 0.9 / 1.5 });
        const pieceZoom = 1.25;
        pieceHelpUIs.forEach(({ ui, col, row }) => ui.place({ x: (col - 4) * 0.08 * pieceZoom, y: row === 0 ? -0.03 : 0.09, zoom: pieceZoom }));
    };
    return titleScene;
}

// キャラクター選択シーン
export function createCharacterSelectScene(titleCharacter) {
    const playBGMOnce = () => {
        if (audioManager.currentBGM === null) {
            audioManager.playBGM('title');
        }
        document.removeEventListener('click', playBGMOnce);
    };
    document.addEventListener('click', playBGMOnce);

    let selectScene = new Scene();
    const backgroundImageUI = new BackgroundImageUI({ image: title_img });
    selectScene.add(backgroundImageUI);

    const selectTitle = new TextUI({
        text: () => `${strings['select-character']}`,
        x: 0.4,
        y: -0.23,
        size: 0.06,
        colors: ["#bbdd44", "#000000", "#FFFFFF"]
    });

    const charactersPerRow = 3;
    const characterSize = 0.22;
    const padding = 0.08;
    const startX = -(charactersPerRow * (characterSize + padding) - characterSize - padding) / 2 + 0.4;
    const startY = -0.04;

    let overlayUI = new OverlayUI({
        x: 0.4,
        y: -0.07,
        width: 1,
        height: 0.45,
        color: "#111122bb"
    });

    let profileOverlayUI = new OverlayUI({
        x: 0.4,
        y: 0.38,
        width: 1,
        height: 0.15,
        color: "#111122bb"
    });

    const characterProfileText = new TextUI({
        text: () => strings['characters'][selectedCharacterName]['profile'],
        x: -0.05,
        y: 0.35,
        size: 0.03,
        colors: ["#ffffff", "#000000", "#00000000"],
        textBaseline: 'middle',
        position: 'left'
    });

    const charaSubmitButton = new ButtonUI({
        text: strings['submit'],
        x: 0.4,
        y: 0.22,
        height: 0.07,
        width: 0.15,
        color: '#3241c9',
        textSize: 0.03,
        textColors: ['#ffffffff', '#00000000', '#00000000'],
        onClick: () => {
            setScene(createTitleScene(titleCharacter, false));
        }
    });

    // 横画面の配置はコンストラクタで指定した値。縦画面から戻すときのために覚えておく（顔アイコンは作成時に追加）
    const landscapeUIs = [titleCharacter, selectTitle, overlayUI, profileOverlayUI, characterProfileText, charaSubmitButton];
    rememberLayout(landscapeUIs);
    rememberLayout([titleCharacter.voiceTextOverlay], ['x', 'y']);
    const faceUIs = [];
    selectScene.onLayout = (portrait, sc) => {
        if (!portrait) {
            // 横画面: コンストラクタで指定した配置に戻す
            restoreLayout(landscapeUIs);
            restoreLayout([titleCharacter.voiceTextOverlay]);
            return;
        }
        titleCharacter.place({ x: 0, y: -0.55, width: 0.62, height: 0.62 });
        titleCharacter.voiceTextOverlay.place({ x: 0, y: 0.22 });
        selectTitle.place({ x: 0, y: -0.17, zoom: 0.9 });
        overlayUI.place({ x: 0, y: 0.09, height: 0.42 });
        const faceZoom = 1.15;
        faceUIs.forEach(({ ui, col }) => ui.place({ x: (col - 1) * 0.32, y: 0.03, zoom: faceZoom }));
        charaSubmitButton.place({ x: 0, y: 0.4, zoom: 1.6 });
        profileOverlayUI.place({ x: 0, y: 0.66, height: 0.3 });
        characterProfileText.place({ x: -0.46, y: 0.53, zoom: 1.2, textBaseline: 'top', maxWidth: 0.92 / 1.2, reflow: true });
    };

    selectScene.add(overlayUI);
    selectScene.add(profileOverlayUI);
    selectScene.add(characterProfileText);
    selectScene.add(titleCharacter);
    selectScene.add(selectTitle);
    selectScene.add(charaSubmitButton);

    characterFiles.forEach((characterName, index) => {
        const row = Math.floor(index / charactersPerRow);
        const col = index % charactersPerRow;
        const x = startX + col * (characterSize + padding);
        const y = startY + row * (characterSize + padding);

        const faceOverlayUI = new OverlayUI({
            x: x,
            y: y,
            width: characterSize + 0.01,
            height: characterSize + 0.01,
            color: "#ffffff",
            touchable: true
        });

        const characterUI = new ImageUI({
            image: characterName + '_face',
            x: 0,
            y: 0,
            width: characterSize,
            height: characterSize
        });

        const characterNameText = new TextUI({
            text: () => strings['characters'][characterName]['name'],
            x: 0,
            y: characterSize / 3 + 0.10,
            size: 0.03,
            colors: ["#bbdd44", "#000000", "#00000000"],
            textBaseline: 'bottom',
            position: 'center'
        });

        faceOverlayUI.onTouch = () => {
            faceOverlayUI.width = (characterSize + 0.01) * 1.1;
            faceOverlayUI.height = (characterSize + 0.01) * 1.1;
            characterUI.width = characterSize * 1.1;
            characterUI.height = characterSize * 1.1;
        }

        faceOverlayUI.unTouch = () => {
            faceOverlayUI.width = characterSize + 0.01;
            faceOverlayUI.height = characterSize + 0.01;
            characterUI.width = characterSize;
            characterUI.height = characterSize;
        }

        faceOverlayUI.onMouseDown = () => {
            setSelectedCharacterName(characterName);
            localStorage.setItem('selectedCharacter', characterName);
            titleCharacter.stopVideo();
            titleCharacter.image = characterName;
            titleCharacter.init();
            titleCharacter.videoElement[0].addEventListener('canplaythrough', () => {
                if (titleCharacter.playVideo(0)) {
                    titleCharacter.spawnVoiceText(0);
                }
            });
            characterProfileText.text = () => strings['characters'][characterName]['profile'];
        };

        selectScene.add(faceOverlayUI);
        faceUIs.push({ ui: faceOverlayUI, col: col });
        rememberLayout([faceOverlayUI]);
        landscapeUIs.push(faceOverlayUI);
        faceOverlayUI.add(characterUI);
        faceOverlayUI.add(characterNameText);
    });

    clearTitleHTML();
    discordButton.style.display = "block";

    return selectScene;
}

export function roomJoinFailed() {
    console.log("roomJoinFailed");
    const roomJoinFailedOverlay = new OverlayUI({
        x: 0.5,
        y: 0.24,
        width: 0.26,
        height: 0.04,
        color: '#187a1c'
    });
    const roomJoinFailedtext = new TextUI({
        text: () => `${strings['join-failed']}`,
        x: 0,
        y: 0.002,
        size: 0.025,
        colors: ['#ffffff', '#00000000', '#00000000']
    });
    roomJoinFailedOverlay.add(roomJoinFailedtext);
    if (scene && scene.portrait) {
        roomJoinFailedOverlay.place({ x: 0, y: 0.66, zoom: 1.6 });
    }
    setTimeout(() => {
        scene.add(roomJoinFailedOverlay);
    }, 100);
    setTimeout(() => {
        scene.remove(roomJoinFailedOverlay);
    }, 2500);
}

function cpuButtonSubmit() {
    cpuLevelOverlay.visible = !cpuLevelOverlay.visible;
}

function cpuLevelSubmit(level) {
    setPlayerName(nameInput.value.trim());
    localStorage.setItem("playerName", playerName);
    if (playerName == "") setPlayerName(`${strings['anonymous']}`);
    clearTitleHTML();
    const now = performance.now();
    setScene(createPlayScene([playerName], null, selectedCharacterName, [`CPU${strings['level']}${level}`], null, null, null, 'cpu', now, 'sente', { sente: MOVETIME, gote: MOVETIME }, false, level));
}

export function updateRanking() {
    if (serverStatus && serverStatus.topPlayers) {
        for (let i = 0; i < 10; i++) {
            if (serverStatus.topPlayers[i]) {
                rankingOverlay.childs[i].text = () => {
                    return `${Math.round(serverStatus.topPlayers[i].rating)} ${serverStatus.topPlayers[i].name}`;
                }
            } else {
                rankingOverlay.childs[i].text = () => ``;
            }
        }
    }
}