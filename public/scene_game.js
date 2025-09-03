import { cancelOverlay, createRoomScene, leaveRoomOverlay, readyOverlay, roomIdOverlay, spectatorsOverlay, tebanOverlay } from "./scene_room.js";
import { MOVETIME } from "./const.js";
import { gameManager, battle_img, audioManager, selectedCharacterName, setScene, scene, setStatus, setupSocket, connectToServer, socket, disconnectFromServer, getTitleInfo, strings, setSceneType } from "./main.js";
import { Scene } from "./scene.js";
import { clearTitleHTML, createTitleScene } from "./scene_title.js";
import { BackgroundImageUI } from "./ui_background.js";
import { CharacterInGameUI } from "./ui_character.js";
import { TextUI } from "./ui_text.js";
import { ButtonUI } from "./ui_button.js";

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

let endText = new TextUI({
    text: () => {
        return "Game End";
    },
    x: 0.0,
    y: -0.2,
    size: 0.2,
    colors: ["#ff6739", "#30140b", "#ffffff"]
});
let winText = new TextUI({
    text: () => {
        return "Win";
    },
    x: 0.0,
    y: -0.2,
    size: 0.2,
    colors: ["#ff6739", "#30140b", "#ffffff"]
});
let loseText = new TextUI({
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

export const timeText = new TextUI({
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

export const countDownText = new TextUI({
    text: () => {
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
    let playScene = new Scene();

    // 背景画像UIを追加 (他のUIより前に描画されるように最初に追加)
    const backgroundImageUI = new BackgroundImageUI({ image: battle_img });
    playScene.add(backgroundImageUI);

    audioManager.playBGM('battle'); // 対戦BGMを再生
    let teban = 0;
    if (roomteban === 'sente' || cpulevel !== null) teban = 1;
    if (roomteban === 'gote') teban = -1;

    gameManager.setRoom(roomId, teban, servertime, moveTime, pawnLimit4thRank, cpulevel);

    const resignButton = new ButtonUI({
        text: `${strings['resign']}`,
        x: -0.8,
        y: -0.46,
        height: 0.05,
        width: 0.12,
        color: '#3241c9',
        textSize: 0.025,
        textColors: ['#ffffffff', '#00000000', '#00000000'],
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

    for (let i = 0; i < arryNames.length; i++) {
        let arryNamesUI = new TextUI({
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
    }

    for (let i = 0; i < enemyNames.length; i++) {
        let enemyNamesUI = new TextUI({
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
    }

    let playerRatingUI = null;
    let opponentRatingUI = null;

    if (roomType === 'rating') {
        let arryRatingtext = `${strings['unrated']}`;
        if (arryRating !== -999999) {
            const roundRating = Math.round(arryRating);
            arryRatingtext = `${roundRating}`
        }
        playerRatingUI = new TextUI({
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
        opponentRatingUI = new TextUI({
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

    return playScene;
}

export async function backToTitle() {
    resultOverlay.style.display = "none";
    disconnectFromServer();
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

    gameManager.resetRoom();
    gameManager.board.finished = true;
}

export function endRoomGame(data) {
    const mywin = data.winPlayer * gameManager.teban;
    setWinCon(roomWinCon, data, mywin);
    setResultText(mywin);
    characterWinMove(mywin, roomResultOverlay);

    gameManager.teban = 0;
    gameManager.board.finished = true;
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

function characterWinMove(mywin, overlay) {
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
    } else if (mywin === 0 && arryCharacterUI.image) {
        if (arryCharacterUI.playWinVideo(0)) {
            arryCharacterUI.winVideoElement[0].addEventListener('ended', () => {
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