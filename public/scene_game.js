import { cancelOverlay, createRoomScene, leaveRoomOverlay, readyOverlay, roomIdOverlay, spectatorsOverlay, tebanOverlay } from "./scene_room.js";
import { MOVETIME, BOARD_SIZE, CELL_SIZE, KOMADAI_WIDTH, KOMADAI_HEIGHT } from "./const.js";
import { gameManager, battle_img, audioManager, selectedCharacterName, setScene, scene, setStatus, setupSocket, connectToServer, socket, disconnectFromServer, getTitleInfo, strings, setSceneType, isTouchDevice } from "./main.js";
import { Scene } from "./scene.js";
import { KOMADAI_PORTRAIT_GAP } from "./ui_komadai.js";
import { clearTitleHTML, createTitleScene, settingsButton } from "./scene_title.js";
import { BackgroundImageUI } from "./ui_background.js";
import { CharacterInGameUI } from "./ui_character.js";
import { rememberLayout, restoreLayout } from "./ui.js";
import { HtmlButtonUI, HtmlPanelUI, HtmlTextUI, HtmlToggleUI } from "./ui_html.js";
import { beginRecord, cancelRecord, finishRecord, isRecording } from "./match_history.js";
import { isMatching } from "./matching.js";

export const winCon = document.getElementById("winCon");
export const roomWinCon = document.getElementById("roomWinCon");
export const changeRating = document.getElementById("changeRating");

const resultOverlay = document.getElementById("resultOverlay");
const toTitleButton = document.getElementById("toTitleButton");

toTitleButton.addEventListener("click", handleToTitleClick);

const roomResultOverlay = document.getElementById("roomResultOverlay");
const toRoomButton = document.getElementById("toRoomButton");

toRoomButton.addEventListener("click", handleToRoomClick);

export let opponentCharacter = null;

export function setOpponentCharacter(character) {
    opponentCharacter = character;
}

let endText = new HtmlTextUI({
    text: () => {
        return "Game End";
    },
    x: 0.0,
    y: -0.2,
    size: 0.2,
    colors: ["#ff6739", "#30140b", "#ffffff"]
});
let winText = new HtmlTextUI({
    text: () => {
        return "Win";
    },
    x: 0.0,
    y: -0.2,
    size: 0.2,
    colors: ["#ff6739", "#30140b", "#ffffff"]
});
let loseText = new HtmlTextUI({
    text: () => {
        return "Lose";
    },
    x: 0.0,
    y: -0.2,
    size: 0.2,
    colors: ["#b639ff", "#270b36", "#ffffff"]
});

export function initGameText() {
    endText.text = () => {
        return strings['game-end'];
    }
    winText.text = () => {
        return strings['win'];
    }
    loseText.text = () => {
        return strings['lose'];
    }
    toRoomButton.textContent = strings['back'];
    toTitleButton.textContent = strings['back'];
}

export const timeText = new HtmlTextUI({
    text: () => {
        let time = (gameManager.board.time - gameManager.board.starttime - 5000) / 1000;
        if (time <= 0) time = 0;
        return `${Math.floor(time)}`;
    },
    x: 0.0,
    y: -0.49,
    size: 0.08,
    colors: ["#ffffff", "#888888", "#ffffff"],
    textBaseline: "top",
});

export const countDownText = new HtmlTextUI({
    text: () => {
        // 終局後は表示しない（開始前に終局すると時計が止まり、カウントダウンが残ってしまう）
        if (gameManager.board.finished) return '';
        let time = (gameManager.board.starttime - gameManager.board.time + 6000) / 1000;
        if (time <= 1) {
            return '';
        }
        return `${Math.floor(time)}`;
    },
    x: 0.0,
    y: 0.18,
    size: 0.4,
    colors: ["#ff6739", "#000000", "#ffffff"],
    textBaseline: "bottom",
});

export function hideRoomUI() {
    roomResultOverlay.style.display = "none";
    roomIdOverlay.style.display = 'none';
    tebanOverlay.style.display = 'none';
    spectatorsOverlay.style.display = 'none';
    readyOverlay.style.display = 'none';
    cancelOverlay.style.display = 'none';
    leaveRoomOverlay.style.display = 'none';
}

// Define the event handler function for the "To Title" button
export function handleToTitleClick() {
    backToTitle();
}

export function handleToRoomClick() {
    socket.emit("backToRoom");
}

export function backToRoom(data) {
    roomResultOverlay.style.display = "none";
    setScene(createRoomScene(data));
    audioManager.playBGM('title');
}

let arryCharacterUI;
let enemyCharacterUI;

//ゲームシーン
export function createPlayScene(senteName, senteRating, senteCharacter, goteName, goteRating, goteCharacter, roomId, roomType, servertime, roomteban, moveTime, pawnLimit4thRank, cpulevel = null) {
    setSceneType('game');
    clearTitleHTML();
    // マッチングしながらの CPU 戦の結果表示中に相手が見つかったときなど、前の対局の結果表示を消す
    resultOverlay.style.display = "none";
    let playScene = new Scene();

    // 背景画像UIを追加 (他のUIより前に描画されるように最初に追加)
    const backgroundImageUI = new BackgroundImageUI({ image: battle_img });
    playScene.add(backgroundImageUI);

    // 縦画面で投了・音量設定ボタンを置く上端の帯（横画面では非表示）
    const topBarUI = new HtmlPanelUI({ x: 0, y: 0, width: 0, height: 0, color: '#000000aa', visible: false });
    playScene.add(topBarUI);

    audioManager.playBGM('battle'); // 対戦BGMを再生
    let teban = 0;
    if (roomteban === 'sente' || cpulevel !== null) teban = 1;
    if (roomteban === 'gote') teban = -1;

    gameManager.setRoom(roomId, teban, servertime, moveTime, pawnLimit4thRank, cpulevel);
    // 自分が指す対局（レート戦・部屋・CPU戦）は対戦履歴に記録する（観戦は記録しない）
    if (teban !== 0) {
        beginRecord({
            roomType: cpulevel !== null ? 'cpu' : roomType,
            cpuLevel: cpulevel !== null ? Number(cpulevel) : null,
            myTeban: teban,
            senteNames: senteName,
            goteNames: goteName,
            senteCharacter: senteCharacter,
            goteCharacter: goteCharacter,
            senteRating: validRating(senteRating),
            goteRating: validRating(goteRating),
            moveTime: { sente: moveTime.sente, gote: moveTime.gote },
            pawnLimit4thRank: !!pawnLimit4thRank,
        });
    } else {
        cancelRecord();
    }
    // 終局処理を通らずに対局画面を離れた場合（接続切れでタイトルへ戻る等）もCPUを止める。
    // setScene は新しいシーンを作ってから古いシーンを破棄するので、次の対局のCPUは止めない
    const sceneCpu = gameManager.cpu;
    // この対局のために作った HTML の文字・ボタンは、シーンを離れるときに取り除く
    const sceneHtmlUIs = [];
    playScene.destroy = () => {
        if (sceneCpu !== null && gameManager.cpu === sceneCpu) gameManager.stopCpu();
        // キャラのセリフ枠も含む（次の対局のキャラは別の UI なので、この対局のものだけを取り除く）
        for (const u of sceneHtmlUIs) u.dispose();
    };

    const resignButton = new HtmlButtonUI({
        text: () => strings['resign'],
        x: -0.8,
        y: -0.46,
        height: 0.05,
        width: 0.12,
        className: '',
        textSize: 0.025,
        onClick: () => {
            if (gameManager.cpu !== null) {
                endGame({ winPlayer: -1, text: "resig" });
            } else {
                socket.emit("resign", {});
            }
        }
    });
    playScene.add(resignButton);

    let arryNames = null;
    let enemyNames = null;
    let arryRating = null;
    let enemyRating = null;
    let arryCharacter = null;
    let enemyCharacter = null;
    let senteCharacterUI = null;
    let goteCharacterUI = null;

    if (teban >= 0) {
        arryNames = senteName;
        arryRating = senteRating;
        enemyNames = goteName;
        enemyRating = goteRating;
        arryCharacter = senteCharacter;
        enemyCharacter = goteCharacter;
        setOpponentCharacter(goteCharacter);
    } else {
        arryNames = goteName;
        arryRating = goteRating;
        enemyNames = senteName;
        enemyRating = senteRating;
        arryCharacter = goteCharacter;
        enemyCharacter = senteCharacter;
        setOpponentCharacter(senteCharacter);
    }

    arryCharacterUI = new CharacterInGameUI({
        image: arryCharacter, // main.jsから選択されたキャラクター名を取得
        x: -0.6, // プレイヤー名の近くに配置
        y: 0.2, // 適切なY座標に調整
        width: 0.48, // サイズ調整
        height: 0.48
    });

    enemyCharacterUI = new CharacterInGameUI({
        image: enemyCharacter, // 相手プレイヤー名からキャラクター名を生成（仮）
        x: 0.6, // 相手プレイヤー名の近くに配置
        y: -0.2, // 適切なY座標に調整
        width: 0.48, // サイズ調整
        height: 0.48
    });

    if (teban >= 0) {
        senteCharacterUI = arryCharacterUI;
        goteCharacterUI = enemyCharacterUI
    } else {
        senteCharacterUI = enemyCharacterUI;
        goteCharacterUI = arryCharacterUI;
    }

    playScene.add(arryCharacterUI);
    playScene.add(enemyCharacterUI);

    const arryNameUIs = [];
    const enemyNameUIs = [];
    for (let i = 0; i < arryNames.length; i++) {
        let arryNamesUI = new HtmlTextUI({
            text: () => {
                return `${arryNames[i]}`;
            },
            x: -0.43,
            y: 0.4 - i * 0.038,
            size: 0.025,
            colors: ["#FFFFFF", "#000000"],
            textBaseline: 'bottom',
            position: 'right',
            backgroundColor: '#000000cc'
        });
        playScene.add(arryNamesUI);
        arryNameUIs.push(arryNamesUI);
    }

    for (let i = 0; i < enemyNames.length; i++) {
        let enemyNamesUI = new HtmlTextUI({
            text: () => {
                return `${enemyNames[i]}`;
            },
            x: 0.43,
            y: -0.4 + i * 0.038,
            size: 0.025,
            colors: ["#FFFFFF", "#000000"],
            textBaseline: 'top',
            position: 'left',
            backgroundColor: '#000000cc'
        });
        playScene.add(enemyNamesUI);
        enemyNameUIs.push(enemyNamesUI);
    }

    let playerRatingUI = null;
    let opponentRatingUI = null;

    if (roomType === 'rating') {
        let arryRatingtext = `${strings['unrated']}`;
        if (arryRating !== -999999) {
            const roundRating = Math.round(arryRating);
            arryRatingtext = `${roundRating}`
        }
        playerRatingUI = new HtmlTextUI({
            text: () => {
                // main.jsで計算された表示用レーティングを使用
                return `${strings['rating']}: ` + arryRatingtext;
            },
            x: -0.43,
            y: 0.44, // プレイヤー名の下に表示するためにy座標を調整
            size: 0.025, // プレイヤー名より少し小さく
            colors: ["#FFFFFF", "#000000"],
            textBaseline: 'bottom', // プレイヤー名の下に揃える
            position: 'right',
            backgroundColor: '#000000cc'
        });

        let opponentRatingtext = `${strings['unrated']}`;
        if (enemyRating !== -999999) {
            const opponentRoundRating = Math.round(enemyRating);
            opponentRatingtext = `${opponentRoundRating}`
        }
        opponentRatingUI = new HtmlTextUI({
            text: () => {
                // main.jsで計算された表示用レーティングを使用
                return `${strings['rating']}: ` + opponentRatingtext;
            },
            x: 0.43,
            y: -0.44, // プレイヤー名の下に表示するためにy座標を調整
            size: 0.025, // プレイヤー名より少し小さく
            colors: ["#FFFFFF", "#000000"],
            textBaseline: 'top', // プレイヤー名の下に揃える
            position: 'left',
            backgroundColor: '#000000cc'
        });
    }

    // 先手の開始ビデオ再生終了後に後手の開始ビデオを再生
    senteCharacterUI.startVideoElement[0].addEventListener('ended', () => {
        goteCharacterUI.playStartVideo(0);
    });

    senteCharacterUI.startVideoElement[0].addEventListener('canplaythrough', () => {
        senteCharacterUI.playStartVideo(0);
    });

    hideRoomUI();

    playScene.add(gameManager.boardUI);
    // playScene.add(playerOverlayUI);
    if (playerRatingUI) playScene.add(playerRatingUI); // レーティング表示UIを追加
    if (opponentRatingUI) playScene.add(opponentRatingUI); // レーティング表示UIを追加
    playScene.add(countDownText);
    playScene.add(timeText);

    // タッチ端末では右ドラッグの代わりに「自動成り」の切り替えスイッチを出す（初期値ON、OFFの間は成らずに移動）
    let autoPromoteToggle = null;
    if (isTouchDevice) {
        autoPromoteToggle = new HtmlToggleUI({
            x: -0.8,
            y: -0.34,
            width: 0.12,
            height: 0.13,
            label: () => strings['auto-promote'],
            getValue: () => !gameManager.boardUI?.noPromote,
            onToggle: () => {
                gameManager.boardUI.noPromote = !gameManager.boardUI.noPromote;
            }
        });
        // 盤より後に追加して先に判定させる（押したときは押下が盤に渡らない）
        playScene.add(autoPromoteToggle);
    }

    sceneHtmlUIs.push(topBarUI, resignButton, ...arryNameUIs, ...enemyNameUIs, arryCharacterUI, enemyCharacterUI);
    for (const u of [autoPromoteToggle, playerRatingUI, opponentRatingUI]) if (u) sceneHtmlUIs.push(u);

    // 横画面の配置はコンストラクタで指定した値。縦画面から戻すときのために覚えておく
    const landscapeUIs = [
        gameManager.boardUI, resignButton, autoPromoteToggle, arryCharacterUI, enemyCharacterUI,
        ...arryNameUIs, ...enemyNameUIs, playerRatingUI, opponentRatingUI,
        timeText, countDownText, endText, winText, loseText
    ].filter(Boolean);
    rememberLayout(landscapeUIs);

    playScene.onLayout = (portrait, sc) => {
        layoutPlayScene(portrait, sc, {
            playScene, topBarUI, resignButton, autoPromoteToggle, arryNameUIs, enemyNameUIs, playerRatingUI, opponentRatingUI, landscapeUIs
        });
    };

    return playScene;
}

// 縦画面で盤を少し大きく表示する倍率
const PORTRAIT_BOARD_ZOOM = 1.16;
// 縦画面の自動成りスイッチの大きさと、駒台・画面下端からの間隔（ゲーム内座標）
const AUTO_PROMOTE_WIDTH = 0.13;
const AUTO_PROMOTE_HEIGHT = 0.19;
const AUTO_PROMOTE_GAP = 0.06;
// キャラ画像の端は透明なので、スイッチの列にこの幅まではキャラがかかってもよい
const CHARA_OVERLAP_ALLOWANCE = 0.04;
// 縦画面で空きがあるときに駒台を大きくする上限の倍率
const PORTRAIT_KOMADAI_MAX_SCALE = 1.15;

function layoutPlayScene(portrait, sc, ui) {
    const boardUI = gameManager.boardUI;
    boardUI.setPortrait(portrait);

    // 横画面ではキャラが駒台と重なるので盤の下に、縦画面ではセリフが盤に隠れないよう盤の上に描く。
    // 名前・レーティングはキャラに重ねて表示するので、常にキャラの直後に描く
    const labelUIs = [...ui.arryNameUIs, ...ui.enemyNameUIs, ui.playerRatingUI, ui.opponentRatingUI].filter(Boolean);
    for (const u of [arryCharacterUI, enemyCharacterUI, ...labelUIs]) ui.playScene.remove(u);
    const boardIndex = ui.playScene.ui_lists.indexOf(boardUI);
    const insertAt = portrait ? boardIndex + 1 : boardIndex;
    ui.playScene.ui_lists.splice(insertAt, 0, arryCharacterUI, enemyCharacterUI, ...labelUIs);

    if (!portrait) {
        // 横画面: コンストラクタで指定した配置に戻す
        restoreLayout(ui.landscapeUIs);
        arryCharacterUI.resetVoiceLayout();
        enemyCharacterUI.resetVoiceLayout();
        ui.topBarUI.place({ visible: false });
        return;
    }

    // 縦画面: 一番上に投了・音量設定ボタン用の帯を取り、その下の領域に盤・駒台・キャラを置く。
    // 駒台（PC版と同じ並び）は盤の右下（自分）・左上（相手）、キャラは空いた側（自分は左下、相手は右上）
    const screenTop = -sc.halfHeight;
    // 帯の高さは音量設定ボタン（HTML）の下端に合わせる
    const settingsBottomPx = settingsButton.getBoundingClientRect().bottom || 48;
    const topBar = Math.min(0.3, (settingsBottomPx + 6) / sc.scale);
    const contentTop = screenTop + topBar;
    const contentBottom = sc.halfHeight;
    const cy = (contentTop + contentBottom) / 2; // 帯の下の領域の中心
    const half = Math.min((contentBottom - contentTop) / 2, 1.15); // 帯の下の領域の半分の高さ

    const buttonZoom = 1.6;
    const buttonWidth = 0.12 * buttonZoom;

    // 上端の帯: 左に投了、中央に経過時間、右は音量設定ボタン（HTML）
    ui.topBarUI.place({ x: 0, y: screenTop + topBar / 2, width: sc.halfWidth * 2 + 0.1, height: topBar, visible: true });
    ui.resignButton.place({ x: -0.5 + 0.02 + buttonWidth / 2, y: screenTop + topBar / 2, zoom: buttonZoom });
    timeText.place({ x: 0, y: screenTop + topBar / 2 - 0.032, zoom: 0.8 });

    // 盤と駒台を帯の下の領域に収める。高さが足りなければ盤を少し小さくし、駒台は最大1割まで縮める。
    // 高さに余裕があれば駒台を最大 PORTRAIT_KOMADAI_MAX_SCALE 倍まで大きくする
    const boardHalf = BOARD_SIZE * CELL_SIZE / 2;
    const komadaiAvail = half - 0.005; // 盤の中心から駒台の外端までに使える高さ
    const zoom = Math.min(PORTRAIT_BOARD_ZOOM, komadaiAvail / (boardHalf + KOMADAI_PORTRAIT_GAP + KOMADAI_HEIGHT * 0.9));
    boardUI.place({ x: 0, y: cy, zoom: zoom });
    const komadaiRoom = komadaiAvail / zoom - boardHalf - KOMADAI_PORTRAIT_GAP;
    const komadaiScale = Math.min(PORTRAIT_KOMADAI_MAX_SCALE, komadaiRoom / KOMADAI_HEIGHT);
    boardUI.komadai.portraitScale = komadaiScale;
    const boardEdge = boardHalf * zoom + 0.01; // 盤の上下の端（領域の中心から）
    const area = half - boardEdge; // 盤の上下それぞれの空き領域の高さ
    // 駒台の内側（盤の中心寄り）の端。自分の駒台は盤の右下、相手の駒台は盤の左上（点対称）
    const komadaiInner = (boardHalf - KOMADAI_WIDTH * komadaiScale) * zoom;

    // キャラの大きさ: 縦は空き領域、横は駒台（と、その左に置く自動成りスイッチ）にかからない範囲
    const buttonColumn = ui.autoPromoteToggle ? AUTO_PROMOTE_WIDTH + AUTO_PROMOTE_GAP + 0.01 - CHARA_OVERLAP_ALLOWANCE : 0;
    const maxCharaWidth = komadaiInner + 0.5 - 0.02 - buttonColumn;
    const charaSize = Math.max(0.2, Math.min(area - 0.01, maxCharaWidth));
    const textZoom = 1.5;
    const lineHeight = 0.025 * textZoom * 1.4;

    // 相手（上）: キャラは右上で盤の上端に寄せ、名前はキャラの下部（盤側）に右寄せ・下ぞろえで重ねる。
    // セリフは名前と重ならないようキャラの上部に出す
    const enemyCharaX = 0.5 - charaSize / 2 - 0.01;
    enemyCharacterUI.place({ x: enemyCharaX, y: cy - boardEdge - charaSize / 2, width: charaSize, height: charaSize });
    enemyCharacterUI.setVoiceLayout({ x: -enemyCharaX, y: -charaSize / 2 + 0.06, size: 0.035, maxWidth: 0.95 });
    let y = cy - boardEdge - 0.01;
    if (ui.opponentRatingUI) {
        ui.opponentRatingUI.place({ x: 0.49, y: y, zoom: textZoom, position: 'right', textBaseline: 'bottom' });
        y -= lineHeight;
    }
    for (let i = ui.enemyNameUIs.length - 1; i >= 0; i--) {
        ui.enemyNameUIs[i].place({ x: 0.49, y: y, zoom: textZoom, position: 'right', textBaseline: 'bottom' });
        y -= lineHeight;
    }

    // 自分（下）: キャラは左下で盤の下端に寄せ、名前はキャラの下部に左寄せで重ねる
    const arryCharaX = -0.5 + charaSize / 2 + 0.01;
    arryCharacterUI.place({ x: arryCharaX, y: cy + boardEdge + charaSize / 2, width: charaSize, height: charaSize });
    arryCharacterUI.setVoiceLayout({ x: -arryCharaX, y: -charaSize / 2 + 0.06, size: 0.035, maxWidth: 0.95 });
    y = cy + boardEdge + charaSize - 0.01;
    if (ui.playerRatingUI) {
        ui.playerRatingUI.place({ x: -0.49, y: y, zoom: textZoom, position: 'left', textBaseline: 'bottom' });
        y -= lineHeight;
    }
    for (let i = ui.arryNameUIs.length - 1; i >= 0; i--) {
        ui.arryNameUIs[i].place({ x: -0.49, y: y, zoom: textZoom, position: 'left', textBaseline: 'bottom' });
        y -= lineHeight;
    }

    // 自動成りスイッチ: キャラと自分の駒台の間の下端（駒台・盤から離して誤タップを防ぐ）
    ui.autoPromoteToggle?.place({
        x: komadaiInner - AUTO_PROMOTE_GAP - AUTO_PROMOTE_WIDTH / 2,
        y: cy + half - 0.02 - AUTO_PROMOTE_HEIGHT / 2,
        zoom: 1,
        width: AUTO_PROMOTE_WIDTH,
        height: AUTO_PROMOTE_HEIGHT
    });

    countDownText.place({ y: cy + 0.18 });
    for (const t of [endText, winText, loseText]) t.place({ y: cy - 0.2, zoom: 0.7 });
}

export async function backToTitle() {
    resultOverlay.style.display = "none";
    // マッチングしながらの CPU 戦から戻るときは、マッチングサーバーとの接続を残す
    if (!isMatching()) disconnectFromServer();
    await getTitleInfo();
    setScene(createTitleScene());
    audioManager.playBGM('title');
}

export function endGame(data) {
    const mywin = data.winPlayer * gameManager.teban;
    setWinCon(winCon, data, mywin);
    setRatingText(data, mywin);
    setResultText(mywin);
    characterWinMove(mywin, resultOverlay);
    saveRecord(data, mywin);

    gameManager.resetRoom();
    gameManager.board.finished = true;
}

export function endRoomGame(data) {
    const mywin = data.winPlayer * gameManager.teban;
    setWinCon(roomWinCon, data, mywin);
    setResultText(mywin);
    characterWinMove(mywin, roomResultOverlay, data.winPlayer);
    saveRecord(data, mywin);

    gameManager.teban = 0;
    gameManager.board.finished = true;
}

// オンライン対局中にサーバーとの接続が切れた（スマホでアプリを切り替えた等）。
// サーバー側では切断負けとして終局しているが、その通知は届かず、再接続しても元の対局には戻れないので、
// ここで対局を終えてタイトルへ戻れるようにする
export function connectionLost() {
    if (gameManager.board.finished || gameManager.cpu !== null) return;
    winCon.textContent = `${strings['connection-lost']}`;
    changeRating.textContent = '';
    setResultText(0);
    resultOverlay.style.display = "block";
    saveRecord({ text: 'connection-lost' }, 0);
    gameManager.teban = 0;
    gameManager.board.finished = true;
}

// レートは未計測のとき -999999（対局開始時）や -99999（終局時）が入っている
function validRating(rating) {
    return typeof rating === 'number' && rating > -99999 ? rating : null;
}

// 終局した対局を対戦履歴（最近の対戦）に保存する
function saveRecord(data, mywin) {
    if (!isRecording()) return;
    let ratingBefore = null;
    let ratingAfter = null;
    if (mywin !== 0 && gameManager.cpu === null) {
        ratingBefore = validRating(mywin === 1 ? data.winRating : data.loseRating);
        ratingAfter = validRating(mywin === 1 ? data.newWinRating : data.newLoseRating);
    }
    const reasons = { 'game-end': 'king', 'try': 'try', 'resign': 'resign', 'resig': 'resign', 'disconnected': 'disconnected', 'connection-lost': 'connection-lost' };
    finishRecord({
        result: mywin,
        reason: reasons[data.text] ?? 'other',
        ratingBefore: ratingBefore,
        ratingAfter: ratingAfter,
        duration: performance.now() - gameManager.board.starttime,
    });
}

function setRatingText(data, mywin) {
    if (mywin === 0 || gameManager.cpu !== null) {
        changeRating.textContent = `${strings['rating-change']} ` + 'none';
        return
    }

    let oldrateText = `${strings['unrated']}`
    let newrateText = `${strings['unrated']}`
    let targetoldrate = data.winRating;
    let targetnewrate = data.newWinRating;
    if (mywin === -1) {
        targetoldrate = data.loseRating;
        targetnewrate = data.newLoseRating;
    }
    if (targetoldrate !== -99999) {
        oldrateText = `${Math.round(targetoldrate)}`
    }
    if (targetnewrate !== -99999) {
        newrateText = `${Math.round(targetnewrate)}`
    }
    changeRating.textContent = `${strings['rating-change']} ` + oldrateText + " → " + newrateText;
}

function setWinCon(winConText, data, mywin) {
    console.log(data.text);
    winConText.textContent = `${strings['game-end']}`;
    if (data.text === "try") {
        winConText.textContent = `${strings['try-rule']}`;
    } else if (data.text === "resign") {
        if (mywin === 1) {
            winConText.textContent = `${strings['resign-win']}`;
        } else {
            winConText.textContent = `${strings['resign-lose']}`;
        }
    }
}

function setResultText(mywin) {
    if (mywin === 1) {
        scene.add(winText);
    } else if (mywin === -1) {
        scene.add(loseText);
    } else if (mywin === 0) {
        scene.add(endText);
    }
}

function characterWinMove(mywin, overlay, win) {
    if (mywin === 1 && arryCharacterUI.image) {
        if (arryCharacterUI.playWinVideo(0)) {
            arryCharacterUI.winVideoElement[0].addEventListener('ended', () => {
                overlay.style.display = "block";
            });
        } else {
            setTimeout(() => {
                overlay.style.display = "block";
            }, 1000);
        }
    } else if (mywin === -1 && enemyCharacterUI.image) {
        if (enemyCharacterUI.playWinVideo(0)) {
            enemyCharacterUI.winVideoElement[0].addEventListener('ended', () => {
                overlay.style.display = "block";
            });
        } else {
            setTimeout(() => {
                overlay.style.display = "block";
            }, 1000);
        }
    } else if (mywin === 0 && win === 1 && arryCharacterUI.image) {
        if (arryCharacterUI.playWinVideo(0)) {
            arryCharacterUI.winVideoElement[0].addEventListener('ended', () => {
                overlay.style.display = "block";
            });
        } else {
            setTimeout(() => {
                overlay.style.display = "block";
            }, 1000);
        }
    } else if (mywin === 0 && win === -1 && enemyCharacterUI.image) {
        if (enemyCharacterUI.playWinVideo(0)) {
            enemyCharacterUI.winVideoElement[0].addEventListener('ended', () => {
                overlay.style.display = "block";
            });
        } else {
            setTimeout(() => {
                overlay.style.display = "block";
            }, 1000);
        }
    } else {
        setTimeout(() => {
            overlay.style.display = "block";
        }, 1000);
    }
}
