// ルームUIを定義するファイル
import { Scene } from "./scene.js";
import { battle_img, connectToServer, disconnectFromServer, getTitleInfo, setScene, setSceneType, socket, strings } from "./main.js"; // setScene関数をインポート
import { clearTitleHTML, createTitleScene, discordButton } from "./scene_title.js"; // タイトルシーンに戻るために必要
import { BackgroundImageUI } from "./ui_background.js";

export const roomIdOverlay = document.getElementById("roomIdOverlay");
const copyIdButton = document.getElementById("copyIdButton");
const roomIdStr = document.getElementById("roomIdStr");
export const tebanOverlay = document.getElementById("tebanOverlay");
const senteOverlay = document.getElementById("senteOverlay");
const goteOverlay = document.getElementById("goteOverlay");
export const spectatorsOverlay = document.getElementById("spectatorsOverlay");
export const readyOverlay = document.getElementById("readyOverlay");
export const startOverlay = document.getElementById("startOverlay");
export const cancelOverlay = document.getElementById("cancelOverlay");
export const leaveRoomOverlay = document.getElementById("leaveRoomOverlay");
const copySuccessMessage = document.getElementById("copySuccessMessage");
const playingText = document.getElementById("playingText");

// 部屋設定関連の要素を取得
const roomSettingsDisplay = document.getElementById("roomSettingsDisplay");
const maxPlayersDisplay = document.getElementById("maxPlayersDisplay");
const senteMoveTimeDisplay = document.getElementById("senteMoveTimeDisplay");
const goteMoveTimeDisplay = document.getElementById("goteMoveTimeDisplay");
const openRoomSettingsButton = document.getElementById("openRoomSettingsButton");
const roomSettingsOverlay = document.getElementById("roomSettingsOverlay");
const maxPlayersInput = /** @type {HTMLInputElement} */ (document.getElementById("maxPlayersInput"));
const senteMoveTimeInput = /** @type {HTMLInputElement} */ (document.getElementById("senteMoveTimeInput"));
const goteMoveTimeInput = /** @type {HTMLInputElement} */ (document.getElementById("goteMoveTimeInput"));
const saveRoomSettingsButton = document.getElementById("saveRoomSettingsButton");

const maxPlayersLabel = document.querySelector('label[for="maxPlayersInput"]');
const senteMoveTimeLabel = document.querySelector('label[for="senteMoveTimeInput"]');
const goteMoveTimeLabel = document.querySelector('label[for="goteMoveTimeInput"]');


const displayRoomIdButton = document.getElementById("displayRoomIdButton");
const startRoomGameButton = document.getElementById("startRoomGameButton");
const readyButton = document.getElementById("readyButton");
const cancelButton = document.getElementById("cancelButton");
const moveToSenteButton = document.getElementById("moveToSenteButton");
const moveToGoteButton = document.getElementById("moveToGoteButton");
const moveToSpectatorsButton = document.getElementById("moveToSpectatorsButton");
const leaveRoomButton = document.getElementById("leaveRoomButton");

displayRoomIdButton.addEventListener("click", () => { toggleRoomId(); });
startRoomGameButton.addEventListener("click", () => { startRoomGame(); });
readyButton.addEventListener("click", () => { ready(); });
cancelButton.addEventListener("click", () => { cancelReady(); });
moveToSenteButton.addEventListener("click", () => { moveSubmit('sente'); });
moveToGoteButton.addEventListener("click", () => { moveSubmit('gote'); });
moveToSpectatorsButton.addEventListener("click", () => { moveSubmit('spectators'); });
leaveRoomButton.addEventListener("click", () => { leaveRoom(); });

copyIdButton.addEventListener("click", handleCopyIdClick);

export let roomdata;
export function setRoomData(data) {
    roomdata = data;
}

export function initRoomText() {
    openRoomSettingsButton.textContent = `${strings['change-setting']}`
    displayRoomIdButton.textContent = `${strings['display-room-id']}`;
    copyIdButton.textContent = `${strings['copy']}`;
    copySuccessMessage.textContent = `${strings['copy-success']}`;
    readyButton.textContent = strings['ready'];
    cancelButton.textContent = strings['cancel'];
    startRoomGameButton.textContent = strings['start-game'];
    moveToSenteButton.textContent = strings['move-first'];
    moveToGoteButton.textContent = strings['move-second'];
    moveToSpectatorsButton.textContent = strings['spectate'];
    leaveRoomButton.textContent = strings['leave-room'];

    maxPlayersLabel.textContent = `${strings['max-player']}`;
    senteMoveTimeLabel.textContent = `${strings['cooldown-first']}`;
    goteMoveTimeLabel.textContent = `${strings['cooldown-second']}`;

    saveRoomSettingsButton.textContent = strings['apply'];
}

// オーナー用ルーム設定変更ボタンにイベントリスナーを追加
openRoomSettingsButton.addEventListener("click", () => {
    roomSettingsOverlay.style.display = 'flex';
    // 現在の設定値を入力フィールドにセット
    maxPlayersInput.value = maxPlayersDisplay.textContent.replace(`${strings['max-player']}`, '');
    senteMoveTimeInput.value = senteMoveTimeDisplay.textContent.replace(`${strings['cooldown-first']}`, '');

    goteMoveTimeInput.value = goteMoveTimeDisplay.textContent.replace(`${strings['cooldown-second']}`, '');
});


// 設定保存ボタンにイベントリスナーを追加
saveRoomSettingsButton.addEventListener("click", () => {
    const settings = {
        maxplayers: parseInt(maxPlayersInput.value, 10),
        moveTime: {
            sente: parseInt(senteMoveTimeInput.value, 10),
            gote: parseInt(goteMoveTimeInput.value, 10)
        },
        pawnLimit4thRank: false
    };
    socket.emit("updateRoomSettings", settings);
    roomSettingsOverlay.style.display = 'none'; // 保存後にオーバーレイを非表示
});



let currentRoomId = null;

function moveSubmit(teban) {
    socket.emit("moveTeban", { teban: teban });
}

async function leaveRoom() {
    socket.emit("leaveRoom");
    disconnectFromServer();
    await getTitleInfo();
    setScene(createTitleScene());

    currentRoomId = null;
    if (displayRoomIdButton.textContent === `${strings['display-room-id-off']}`) {
        displayRoomIdButton.textContent = `${strings['display-room-id']}`;
        roomIdStr.textContent = ``
    }
    roomIdOverlay.style.display = 'none';
    tebanOverlay.style.display = 'none';
    spectatorsOverlay.style.display = 'none';
    readyOverlay.style.display = 'none';
    startOverlay.style.display = 'none';
    cancelOverlay.style.display = 'none';
    leaveRoomOverlay.style.display = 'none';
    playingText.style.display = 'none';
    roomSettingsOverlay.style.display = 'none'; // 部屋設定UIも非表示に
    roomSettingsDisplay.style.display = 'none'; // 部屋設定表示も非表示に
    // シーンを離れる際にメッセージを非表示にする
    if (copySuccessMessage) {
        copySuccessMessage.style.display = 'none';
        copySuccessMessage.style.opacity = '0';
    }
}

function startRoomGame() {
    socket.emit("startRoomGame");
    startOverlay.style.display = 'none';
    readyOverlay.style.display = 'none';
    cancelOverlay.style.display = 'none';
}

function ready() {
    socket.emit("ready");
    readyOverlay.style.display = 'none';
    cancelOverlay.style.display = 'block';
}

function cancelReady() {
    socket.emit("cancelReady");
    readyOverlay.style.display = 'block';
    cancelOverlay.style.display = 'none';
}

function cleanOverlay() {
    for (let i = senteOverlay.children.length - 1; i >= 0; i--) {
        const child = senteOverlay.children[i];
        // 要素のタグ名が 'P' (大文字) であるかを確認します
        if (child.tagName === 'P') {
            senteOverlay.removeChild(child);
        }
    }

    for (let i = goteOverlay.children.length - 1; i >= 0; i--) {
        const child = goteOverlay.children[i];
        // 要素のタグ名が 'P' (大文字) であるかを確認します
        if (child.tagName === 'P') {
            goteOverlay.removeChild(child);
        }
    }

    for (let i = spectatorsOverlay.children.length - 1; i >= 0; i--) {
        const child = spectatorsOverlay.children[i];
        // 要素のタグ名が 'P' (大文字) であるかを確認します
        if (child.tagName === 'P') {
            spectatorsOverlay.removeChild(child);
        }
    }
}

export function roomUpdate() {
    cleanOverlay();
    let ready = true;

    for (let i = 0; i < roomdata.sente.length; i++) {
        const pElement = document.createElement('p');
        if (roomdata.readys && roomdata.readys.sente[i]) {
            pElement.textContent = roomdata.sente[i] + `(${strings['ready']})`;
        } else {
            ready = false;
            pElement.textContent = roomdata.sente[i];
        }
        pElement.style.color = '#FFFFFF'; // テキスト色を白に設定
        senteOverlay.appendChild(pElement);
    }

    for (let i = 0; i < roomdata.gote.length; i++) {
        const pElement = document.createElement('p');
        if (roomdata.readys && roomdata.readys.gote[i]) {
            pElement.textContent = roomdata.gote[i] + `(${strings['ready']})`;
        } else {
            ready = false;
            pElement.textContent = roomdata.gote[i];
        }
        pElement.style.color = '#FFFFFF'; // テキスト色を白に設定
        goteOverlay.appendChild(pElement);
    }
    for (let i = 0; i < roomdata.spectators.length; i++) {
        const pElement = document.createElement('p');
        pElement.textContent = roomdata.spectators[i];
        pElement.style.color = '#FFFFFF'; // テキスト色を白に設定
        spectatorsOverlay.appendChild(pElement);
    }

    if (roomdata.state !== 'playing') {
        playingText.style.display = 'none';

        startOverlay.style.display = 'none';
        readyOverlay.style.display = 'block';
        cancelOverlay.style.display = 'none';
        if (roomdata.roomteban === 'sente') {
            if (roomdata.readys && roomdata.readys.sente[roomdata.idx]) {
                readyOverlay.style.display = 'none';
                cancelOverlay.style.display = 'block';
            }
        } else if (roomdata.roomteban === 'gote') {
            if (roomdata.readys && roomdata.readys.gote[roomdata.idx]) {
                readyOverlay.style.display = 'none';
                cancelOverlay.style.display = 'block';
            }
        } else {
            readyOverlay.style.display = 'none';
            cancelOverlay.style.display = 'none';
        }
        if (roomdata.isOwner) {
            openRoomSettingsButton.style.display = 'block';
        } else {
            openRoomSettingsButton.style.display = 'none';
        }
        if (roomdata.isOwner && ready && roomdata.sente.length > 0 && roomdata.gote.length > 0) {
            startOverlay.style.display = 'block';
        } else {
            startOverlay.style.display = 'none';
        }
    }

    // 部屋設定表示エリアに現在の設定値を表示
    maxPlayersDisplay.textContent = `${strings['max-player']}${roomdata.maxplayers}`;
    senteMoveTimeDisplay.textContent = `${strings['cooldown-first']}${roomdata.moveTime.sente}`;
    goteMoveTimeDisplay.textContent = `${strings['cooldown-second']}${roomdata.moveTime.gote}`;
}

// コピーボタンのイベントハンドラ
async function handleCopyIdClick() {
    try {
        await navigator.clipboard.writeText(currentRoomId);
        // コピー成功メッセージを表示
        if (copySuccessMessage) {
            copySuccessMessage.style.display = 'block';
            // 強制的にリフローを発生させてトランジションを有効にする
            copySuccessMessage.offsetHeight;
            copySuccessMessage.style.opacity = '1';
            // 2秒後にメッセージを非表示にする
            setTimeout(() => {
                copySuccessMessage.style.opacity = '0';
                // トランジション完了後にdisplayをnoneにする
                copySuccessMessage.addEventListener('transitionend', function handler() {
                    copySuccessMessage.style.display = 'none';
                    copySuccessMessage.removeEventListener('transitionend', handler);
                });
            }, 2000);
        }
    } catch (err) {
        console.error(`${strings['failed-copy']}`, err);
        // 必要であれば、コピー失敗のフィードバックをユーザーに表示する処理を追加
    }
}


export function createRoomScene(data) {
    clearTitleHTML();
    roomdata = data;
    setSceneType('room');
    let roomScene = new Scene();
    const backgroundImageUI = new BackgroundImageUI({ image: battle_img });

    roomScene.add(backgroundImageUI);

    roomUpdate();

    if (data.state === 'playing') {
        playingText.style.display = 'block';
    } else {
        playingText.style.display = 'none';
    }

    currentRoomId = data.roomId;

    discordButton.style.display = "block";
    roomIdOverlay.style.display = 'flex';
    tebanOverlay.style.display = 'flex';
    spectatorsOverlay.style.display = 'block';
    readyOverlay.style.display = 'none';
    cancelOverlay.style.display = 'none';
    leaveRoomOverlay.style.display = 'block';
    copySuccessMessage.style.display = 'none';
    copySuccessMessage.style.opacity = '0';
    roomSettingsDisplay.style.display = 'flex'; // 部屋設定表示エリアを表示

    // シーン破棄時のイベントリスナー削除とメッセージ非表示
    roomScene.destroy = () => {
        if (copySuccessMessage) {
            copySuccessMessage.style.display = 'none';
            copySuccessMessage.style.opacity = '0';
        }
        // 部屋設定UIと表示を非表示に
        roomSettingsOverlay.style.display = 'none';
        roomSettingsDisplay.style.display = 'none';
    };

    return roomScene;
}


function toggleRoomId() {
    if (displayRoomIdButton.textContent === `${strings['display-room-id']}`) {
        displayRoomIdButton.textContent = `${strings['display-room-id-off']}`
        roomIdStr.textContent = `${currentRoomId}`
    } else {
        displayRoomIdButton.textContent = `${strings['display-room-id']}`;
        roomIdStr.textContent = ``
    }
}