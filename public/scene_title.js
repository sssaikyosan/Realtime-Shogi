//タイトルシーン要素
// ボタン・入力欄・ランキングなどは HTML（index.html の #titleUI）、背景とキャラはキャンバスに描く

import { createPlayScene } from "./scene_game.js";
import { createHistoryScene } from "./scene_history.js";
import { isMatching, startMatching, stopMatching, onMatchingChange, liveStatus, refreshLiveStatus } from "./matching.js";
import { serverStatus, title_img, audioManager, setPlayerName, playerName, selectedCharacterName, player_id, setScene, characterFiles, setSelectedCharacterName, connectToServer, strings, all_strings, playerStatus, setStrings, setSceneType, scene, isTouchDevice } from "./main.js";
import { Scene } from "./scene.js";
import { OverlayUI, rememberLayout, restoreLayout } from "./ui.js";
import { BackgroundImageUI } from "./ui_background.js";
import { CharacterImageUI } from "./ui_character.js";
import { TextUI } from "./ui_text.js";
import { KOMADAI_TYPES, LANGUAGES, MOVETIME, PIECE_MOVES, PROMOTE_TYPES } from "./const.js";
import { ImageUI } from "./ui_image.js";
import { ButtonUI } from "./ui_button.js";

const $ = (id) => document.getElementById(id);

export const discordButton = $("discordButton");
export const settingsButton = $("settingsButton");
export const bgmVolumeText = document.querySelector('label[for="bgmVolumeSlider"]');
export const seVolumeText = document.querySelector('label[for="soundVolumeSlider"]');
export const voiceVolumeText = document.querySelector('label[for="voiceVolumeSlider"]');

export const nameInput = /** @type {HTMLInputElement} */ ($("nameInput"));
export const roomIdInput = /** @type {HTMLInputElement} */ ($("roomIdInput"));

const titleUI = $("titleUI");
const titleLanguage = /** @type {HTMLSelectElement} */ ($("titleLanguage"));
const titleAnnounce = $("titleAnnounce");
const titleLogo = $("titleLogo");
const titleCharaArea = $("titleCharaArea");
const titleRankingTitle = $("titleRankingTitle");
const titleRankingList = $("titleRankingList");
const titlePlay = $("titlePlay");
const titleGameCount = $("titleGameCount");
const titleRating = $("titleRating");
const onlineMatchButton = $("onlineMatchButton");
const cpuMatchButton = $("cpuMatchButton");
const cpuLevels = $("cpuLevels");
const joinRoomButton = $("joinRoomButton");
const makeRoomButton = $("makeRoomButton");
const titleMatching = $("titleMatching");
const matchingText = $("matchingText");
const cancelMatchButton = $("cancelMatchButton");
const titleLive = $("titleLive");
const matchingLive = $("matchingLive");
const matchingCpuButton = $("matchingCpuButton");
const matchingCpuLevels = $("matchingCpuLevels");
const matchingHistoryButton = $("matchingHistoryButton");
const changeCharaButton = $("changeCharaButton");
const historyButton = $("historyButton");
const ruleButton = $("ruleButton");
const titleToast = $("titleToast");

const ruleDialog = $("ruleDialog");
const ruleTabs = { pieces: $("ruleTabPieces"), manual: $("ruleTabManual"), win: $("ruleTabWin") };
const ruleTitle = $("ruleTitle");
const ruleBody = $("ruleBody");
const ruleCloseButton = $("ruleCloseButton");

// 今のタイトル画面のキャラ（キャラ変更の画面にも引き継ぐ）
let titleCharacter = null;
// タイトルの文字（元のデザインのままキャンバスに描く。HTML の #titleLogo は場所を取るだけ）
let titleText = null;

// 部屋IDは大文字に統一しているので、小文字で打っても入力欄ではその場で大文字にする
roomIdInput.addEventListener('input', () => {
    const upper = roomIdInput.value.toUpperCase();
    if (upper === roomIdInput.value) return;
    const cursor = roomIdInput.selectionStart;
    roomIdInput.value = upper;
    roomIdInput.setSelectionRange(cursor, cursor);
});
roomIdInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') joinRoomSubmit();
});

// CPU のレベル選択（通常の CPU 対戦と、マッチングしながらの CPU 戦の両方に置く）
for (const container of [cpuLevels, matchingCpuLevels]) {
    for (let i = 1; i <= 5; i++) {
        const button = document.createElement('button');
        button.className = 'ubtn';
        button.textContent = `Lv${i}`;
        button.addEventListener('click', () => cpuLevelSubmit(String(i)));
        container.appendChild(button);
    }
}

for (const lang in LANGUAGES) {
    const option = document.createElement('option');
    option.value = lang;
    option.textContent = LANGUAGES[lang];
    titleLanguage.appendChild(option);
}
titleLanguage.addEventListener('change', () => {
    setStrings(titleLanguage.value);
    setScene(createTitleScene());
});

onlineMatchButton.addEventListener('click', startOnlineMatch);
cpuMatchButton.addEventListener('click', () => setLevelsOpen(cpuMatchButton, cpuLevels, cpuLevels.hidden));
joinRoomButton.addEventListener('click', joinRoomSubmit);
makeRoomButton.addEventListener('click', makeRoomSubmit);
cancelMatchButton.addEventListener('click', () => stopMatching());
matchingCpuButton.addEventListener('click', () => setLevelsOpen(matchingCpuButton, matchingCpuLevels, matchingCpuLevels.hidden));
matchingHistoryButton.addEventListener('click', () => setScene(createHistoryScene()));
onMatchingChange(() => {
    if (scene && scene.onLayout === layoutTitle) setMatching(isMatching());
    renderLive();
});
changeCharaButton.addEventListener('click', () => setScene(createCharacterSelectScene(titleCharacter)));
historyButton.addEventListener('click', () => setScene(createHistoryScene()));
ruleButton.addEventListener('click', () => openRule('pieces'));

// 開いている部品が増減して枠の大きさが変わったら、キャラの位置を合わせ直す
function relayoutTitle() {
    if (scene && scene.onLayout === layoutTitle) scene.applyLayout(true);
}

function setLevelsOpen(button, levels, open) {
    levels.hidden = !open;
    button.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
    relayoutTitle();
}

// マッチング中は対局を始めるボタンの代わりに「マッチング中」と、待っている間の遊び方（CPU 戦・対戦履歴）とキャンセルを出す
function setMatching(matching) {
    if (titleMatching.hidden === !matching) return;
    titlePlay.hidden = matching;
    titleMatching.hidden = !matching;
    changeCharaButton.hidden = matching;
    historyButton.hidden = matching;
    titleLanguage.disabled = matching;
    setLevelsOpen(matchingCpuButton, matchingCpuLevels, false);
    relayoutTitle();
}

// 対局中・マッチング待ちの人数。0人の項目は出さない（マッチング中は自分も待ち人数に入るので対局中だけ出す）
function renderLive() {
    const parts = [];
    if (liveStatus.playing > 0) parts.push({ text: strings['live-playing'].replace('{n}', liveStatus.playing) });
    const waitingParts = [...parts];
    if (liveStatus.waiting > 0) waitingParts.push({ text: strings['live-waiting'].replace('{n}', liveStatus.waiting), waiting: true });
    const fill = (el, items) => {
        el.replaceChildren();
        items.forEach((item, i) => {
            if (i > 0) el.appendChild(document.createTextNode(' ・ '));
            const span = document.createElement('span');
            span.textContent = item.text;
            if (item.waiting) span.className = 'is-waiting';
            el.appendChild(span);
        });
        el.hidden = items.length === 0;
    };
    fill(titleLive, waitingParts);
    fill(matchingLive, parts);
}

function readPlayerName() {
    setPlayerName(nameInput.value.trim());
    localStorage.setItem("playerName", playerName);
    if (playerName == "") setPlayerName(`${strings['anonymous']}`);
}

function startOnlineMatch() {
    readPlayerName();
    startMatching().catch(err => {
        console.error("Failed to connect for matching:", err);
        showTitleMessage(strings['connect-failed']);
    });
}

function makeRoomSubmit() {
    readPlayerName();
    connectToServer().then(socket => {
        socket.emit("createRoom", { name: playerName, characterName: selectedCharacterName, player_id: player_id });
    }).catch(err => {
        console.error("Failed to connect for creating room:", err);
        showTitleMessage(strings['connect-failed']);
    });
}

function joinRoomSubmit() {
    readPlayerName();
    const roomId = roomIdInput.value.trim().toUpperCase();
    if (!roomId) {
        roomJoinFailed();
        return;
    }
    connectToServer().then(socket => {
        socket.emit("joinRoom", { roomId: roomId, name: playerName, characterName: selectedCharacterName, player_id: player_id });
    }).catch(err => {
        console.error("Failed to connect for joining room:", err);
        showTitleMessage(strings['connect-failed']);
    });
}

function cpuLevelSubmit(level) {
    readPlayerName();
    clearTitleHTML();
    const now = performance.now();
    setScene(createPlayScene([playerName], null, selectedCharacterName, [`CPU${strings['level']}${level}`], null, null, null, 'cpu', now, 'sente', { sente: MOVETIME, gote: MOVETIME }, false, level));
}

function currentLanguage() {
    return Object.keys(all_strings).find(lang => all_strings[lang] === strings) ?? localStorage.getItem('language');
}

export function initTitleText() {
    nameInput.placeholder = strings['name'];
    roomIdInput.placeholder = strings['room-id'];
    settingsButton.textContent = strings['volume-setting'];
    bgmVolumeText.textContent = strings['bgm-volume'];
    seVolumeText.textContent = strings['se-volume'];
    voiceVolumeText.textContent = strings['voice-volume'];

    titleLogo.textContent = strings['title'];
    titleRankingTitle.textContent = strings['ranking'];
    onlineMatchButton.textContent = strings['online-match'];
    cpuMatchButton.textContent = strings['cpu-match'];
    joinRoomButton.textContent = strings['join-room'];
    makeRoomButton.textContent = strings['make-room'];
    matchingText.textContent = strings['matching'];
    cancelMatchButton.textContent = strings['cancel'];
    matchingCpuButton.textContent = strings['matching-with-cpu'];
    matchingHistoryButton.textContent = strings['matching-with-history'];
    changeCharaButton.textContent = strings['change-character'];
    historyButton.textContent = strings['history'];
    ruleButton.textContent = strings['rule'];
    for (const button of [...cpuLevels.children, ...matchingCpuLevels.children]) {
        button.title = `${strings['level']}${button.textContent.slice(2)}`;
    }
    renderLive();
    ruleTabs.pieces.textContent = strings['piece-list'];
    ruleTabs.manual.textContent = strings['manual'];
    ruleTabs.win.textContent = strings['win-condition'];
    ruleCloseButton.textContent = strings['close'];
    const lang = currentLanguage();
    if (lang) titleLanguage.value = lang;

    renderTitleStatus();
}

// 試合数とレート（10試合未満は計測中）
export function renderTitleStatus() {
    const games = playerStatus.total_games;
    titleGameCount.textContent = `${strings['game-count']}: ${games >= 0 ? games : '-'}`;
    const rating = games >= 10 ? Math.round(playerStatus.rating) : strings['unrated'];
    titleRating.textContent = `${strings['rating']}: ${rating}`;
}

export function updateRanking() {
    titleRankingList.replaceChildren();
    const players = serverStatus?.topPlayers ?? [];
    for (let i = 0; i < 10; i++) {
        const li = document.createElement('li');
        const player = players[i];
        if (player) {
            const rate = document.createElement('span');
            rate.className = 'rate';
            rate.textContent = String(Math.round(player.rating));
            li.appendChild(rate);
            li.appendChild(document.createTextNode(player.name));
        }
        titleRankingList.appendChild(li);
    }
}

export function clearTitleHTML() {
    discordButton.style.display = "none";
    titleUI.style.display = "none";
    closeRule();
    titleToast.hidden = true;
}

let toastTimer = null;

// タイトル画面の中央に短いお知らせを出す（入室失敗・接続失敗など）
function showTitleMessage(text) {
    titleToast.textContent = text;
    titleToast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        titleToast.hidden = true;
    }, 2500);
}

export function roomJoinFailed() {
    console.log("roomJoinFailed");
    showTitleMessage(strings['join-failed']);
}

// ---- ルール画面（駒一覧・操作方法・勝利条件）----

function canPieceMove(type, x, y) {
    for (const move of PIECE_MOVES[type]) {
        if (x === move.dx && y === move.dy) return true;
        if (move.recursive) {
            for (let r = 2; r < 4; r++) {
                if (x / r === move.dx && y / r === move.dy) return true;
            }
        }
    }
    return false;
}

// 駒の動ける範囲（7×7マス、中央が駒）
function pieceMovesView(type) {
    const grid = document.createElement('div');
    grid.className = 'piece-moves-grid';
    for (let y = -3; y <= 3; y++) {
        for (let x = -3; x <= 3; x++) {
            const cell = document.createElement('div');
            if (x === 0 && y === 0) {
                const img = document.createElement('img');
                img.src = `/pieces/${type}.png`;
                img.alt = '';
                cell.appendChild(img);
            } else if (canPieceMove(type, x, y)) {
                cell.className = 'can';
            }
            grid.appendChild(cell);
        }
    }
    return grid;
}

function piecesView() {
    const wrap = document.createElement('div');
    const grid = document.createElement('div');
    grid.className = 'piece-grid';
    const moves = document.createElement('div');
    moves.className = 'piece-moves';
    const select = (type, cell) => {
        for (const c of grid.children) c.classList.toggle('is-selected', c === cell);
        moves.replaceChildren(pieceMovesView(type));
    };
    for (const type of [...KOMADAI_TYPES, ...PROMOTE_TYPES]) {
        const cell = document.createElement('button');
        cell.className = 'piece-cell';
        if (!type) {
            cell.classList.add('is-empty');
            cell.tabIndex = -1;
        } else {
            const img = document.createElement('img');
            img.src = `/pieces/${type}.png`;
            img.alt = type;
            cell.appendChild(img);
            cell.addEventListener('click', () => select(type, cell));
            cell.addEventListener('mouseenter', () => select(type, cell));
        }
        grid.appendChild(cell);
    }
    wrap.appendChild(grid);
    wrap.appendChild(moves);
    select(KOMADAI_TYPES[0], grid.children[0]);
    return wrap;
}

function showRuleTab(tab) {
    for (const key in ruleTabs) ruleTabs[key].setAttribute('aria-selected', String(key === tab));
    if (tab === 'pieces') {
        ruleTitle.textContent = strings['piece-list'];
        ruleBody.replaceChildren(piecesView());
    } else if (tab === 'manual') {
        ruleTitle.textContent = strings['manual'];
        ruleBody.textContent = isTouchDevice ? strings['manual-text-touch'] : strings['manual-text'];
    } else {
        ruleTitle.textContent = strings['win-condition'];
        ruleBody.textContent = strings['rule-text'];
    }
}

function openRule(tab) {
    ruleDialog.hidden = false;
    showRuleTab(tab);
}

function closeRule() {
    ruleDialog.hidden = true;
}

for (const key in ruleTabs) ruleTabs[key].addEventListener('click', () => showRuleTab(key));
ruleCloseButton.addEventListener('click', closeRule);
ruleDialog.addEventListener('click', (e) => {
    if (e.target === ruleDialog) closeRule();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !ruleDialog.hidden) closeRule();
});

// ---- タイトルシーン ----

// #titleUI を画面の高さいっぱい・ゲーム画面の幅（横画面は 16:9 ぶん、縦画面は画面幅）に合わせ、
// キャラ（キャンバス）を HTML の空き枠（.tui-chara）に収める
function layoutTitle(portrait, sc) {
    titleUI.className = portrait ? 'portrait' : 'landscape';
    const width = Math.min(window.innerWidth, portrait ? sc.scale : sc.scale * 16 / 9);
    const height = window.innerHeight;
    titleUI.style.width = `${width}px`;
    titleUI.style.height = `${height}px`;
    titleUI.style.left = `${(window.innerWidth - width) / 2}px`;
    titleUI.style.top = '0px';
    // 一番上の列（言語）を、画面右上の音量設定ボタンと同じ高さにそろえる
    // 言語は画面の左端から、音量設定ボタンの右端までと同じ間隔に置く（枠は画面の中央にあるので枠の左端からの位置にする）
    const bar = settingsButton.getBoundingClientRect();
    if (bar.height > 0) {
        titleUI.style.setProperty('--bar-top', `${bar.top}px`);
        titleUI.style.setProperty('--bar-height', `${bar.height}px`);
        titleUI.style.setProperty('--bar-font', getComputedStyle(settingsButton).fontSize);
        titleUI.style.setProperty('--lang-left', `${window.innerWidth - bar.right - (window.innerWidth - width) / 2}px`);
    }

    const logo = titleLogo.getBoundingClientRect();
    titleText?.place({ x: 0, y: (logo.top + logo.height / 2 - window.innerHeight / 2) / sc.scale, zoom: portrait ? 0.7 : 1 });

    const area = titleCharaArea.getBoundingClientRect();
    if (area.width <= 0 || area.height <= 0) return;
    const toGameX = (px) => (px - window.innerWidth / 2) / sc.scale;
    const toGameY = (px) => (px - window.innerHeight / 2) / sc.scale;
    if (!portrait) {
        // 横画面: キャラは枠の左端に寄せ、枠の上端から画面の下端まで使って大きく出す（画面の下に接する）。
        // キャラ変更ボタンはキャラに重ねて、キャラの左右中央に置く
        const sizePx = Math.min(window.innerHeight - area.top, area.width);
        const size = sizePx / sc.scale;
        const x = toGameX(area.left) + size / 2;
        titleCharacter.place({ x: x, y: sc.halfHeight - size / 2, width: size, height: size });
        restoreLayout([titleCharacter.voiceTextOverlay]);
        changeCharaButton.style.marginLeft = '0px';
        const button = changeCharaButton.getBoundingClientRect();
        const target = window.innerWidth / 2 + x * sc.scale - button.width / 2;
        changeCharaButton.style.marginLeft = `${Math.max(0, target - button.left)}px`;
        return;
    }
    changeCharaButton.style.marginLeft = '';
    // 縦画面: キャラは枠の左右中央。下のキャラ変更ボタンの行まで使って大きく出す（ボタンはキャラに重なってよい）
    const button = changeCharaButton.getBoundingClientRect();
    const bottom = button.height > 0 ? Math.max(area.bottom, button.bottom) : area.bottom;
    const size = Math.min(bottom - area.top, area.width) / sc.scale;
    const x = toGameX(area.left + area.width / 2);
    const y = toGameY(bottom) - size / 2;
    titleCharacter.place({ x: x, y: y, width: size, height: size });
    // セリフは画面の左右中央、キャラの下の方に出す。キャラ変更ボタンにはかからないよう、ボタンの上端より上に収める
    let voiceY = size * 0.4;
    if (button.height > 0) voiceY = Math.min(voiceY, toGameY(button.top) - 0.075 - y);
    titleCharacter.voiceTextOverlay.place({ x: -x, y: voiceY });
}

// キャラ変更の画面でも、キャラをタイトル画面と同じ位置・大きさに置く。
// タイトルの HTML を見えない状態で並べて、タイトル画面と同じ計算で置く。戻り値はタイトル文字の位置（ゲーム内座標の y）
function placeCharacterAsTitle(character, portrait, sc) {
    titleCharacter = character;
    const hidden = titleUI.style.display === 'none';
    if (hidden) {
        titleUI.style.visibility = 'hidden';
        titleUI.style.display = '';
    }
    layoutTitle(portrait, sc);
    const logo = titleLogo.getBoundingClientRect();
    const logoY = (logo.top + logo.height / 2 - window.innerHeight / 2) / sc.scale;
    if (hidden) {
        titleUI.style.display = 'none';
        titleUI.style.visibility = '';
    }
    return logoY;
}

export function createTitleScene(savedTitleCharacter = null, loadNameInput = true) {
    clearTitleHTML();

    setSceneType('title');
    const titleScene = new Scene();
    titleScene.add(new BackgroundImageUI({ image: title_img }));
    titleText = new TextUI({
        text: () => `${strings['title']}`,
        x: 0,
        y: -0.3,
        size: 0.12,
        colors: ["#c2a34f", "#000000", "#ffffff"]
    });
    titleScene.add(titleText);

    const playBGMOnce = () => {
        if (audioManager.currentBGM === null) {
            audioManager.playBGM('title');
        }
        document.removeEventListener('click', playBGMOnce);
    };
    document.addEventListener('click', playBGMOnce);

    updateRanking();
    renderTitleStatus();
    titleAnnounce.textContent = serverStatus.announcement ?? '';

    titleCharacter = savedTitleCharacter;
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
    // キャラ変更の画面（横画面）はこの値を基準に戻すので、置き直す前に覚えておく
    rememberLayout([titleCharacter]);
    rememberLayout([titleCharacter.voiceTextOverlay], ['x', 'y']);
    titleScene.add(titleCharacter);

    if (loadNameInput) {
        const savedName = localStorage.getItem("playerName");
        if (savedName) nameInput.value = savedName;
    }
    roomIdInput.value = '';

    discordButton.style.display = "block";
    titleUI.style.display = '';
    setLevelsOpen(cpuMatchButton, cpuLevels, false);
    titleMatching.hidden = isMatching(); // setMatching で必ず表示を切り替えさせる
    setMatching(isMatching());
    renderLive();
    refreshLiveStatus();

    titleScene.onLayout = layoutTitle;
    return titleScene;
}

// 今の言語のキャラ説明を縦画面の幅で折り返したときの最大行数。
// 縦画面では文字の大きさも折り返し幅も画面幅に比例するので、行数は画面幅によらない（計測用の倍率は任意）
function maxProfileLines(size, zoom, maxWidth) {
    const ctx = document.createElement('canvas').getContext('2d');
    const scale = 1000 * zoom;
    return Math.max(...characterFiles.map(name => new TextUI({
        text: () => strings['characters'][name]['profile'], size, maxWidth, reflow: true, colors: ['#ffffff']
    }).getLines(ctx, size * scale, scale).length));
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

    // 横画面の配置はコンストラクタで指定した値。縦画面から戻すときのために覚えておく（顔アイコンは作成時に追加）。
    // キャラはタイトル画面と同じ位置に置くので含めない
    const landscapeUIs = [selectTitle, overlayUI, profileOverlayUI, characterProfileText, charaSubmitButton];
    rememberLayout(landscapeUIs);
    const faceUIs = [];
    selectScene.onLayout = (portrait, sc) => {
        // キャラ（とセリフ）はタイトル画面と同じ位置・大きさ
        const logoY = placeCharacterAsTitle(titleCharacter, portrait, sc);
        if (!portrait) {
            // 横画面: キャラは左、選択画面は右（コンストラクタで指定した配置）
            restoreLayout(landscapeUIs);
            return;
        }
        // 縦画面: 見出しはタイトル画面のタイトル文字の位置。キャラの下（タイトル画面で対局パネルがある辺り）に
        // 顔の一覧〜プロフィールを並べる。以下の y は、キャラの下端を -0.14 としたときの値。画面の下に収まらなければ上にずらす
        const profileZoom = 1.2;
        const profileMaxWidth = 0.92 / profileZoom;
        const profilePadding = 0.022;
        const lines = maxProfileLines(characterProfileText.size, profileZoom, profileMaxWidth);
        const lineHeight = characterProfileText.size * profileZoom * (1 + characterProfileText.lineoffset);
        const profileHeight = profilePadding * 2 + (lines - 1) * lineHeight + characterProfileText.size * profileZoom;
        const charaBottom = titleCharacter.y + titleCharacter.height / 2;
        let dy = charaBottom + 0.14;
        dy -= Math.max(0, 0.51 + dy + profileHeight - (sc.halfHeight - 0.02));
        selectTitle.place({ x: 0, y: logoY, zoom: 1.3 });
        overlayUI.place({ x: 0, y: 0.09 + dy, height: 0.42 });
        const faceZoom = 1.15;
        faceUIs.forEach(({ ui, col }) => ui.place({ x: (col - 1) * 0.32, y: 0.03 + dy, zoom: faceZoom }));
        charaSubmitButton.place({ x: 0, y: 0.4 + dy, zoom: 1.6 });
        // プロフィール枠は、今の言語でいちばん長いキャラ説明が収まる高さにする（キャラを切り替えても枠の大きさは変えない）
        const profileTop = 0.51 + dy;
        profileOverlayUI.place({ x: 0, y: profileTop + profileHeight / 2, height: profileHeight });
        characterProfileText.place({ x: -0.46, y: profileTop + profilePadding, zoom: profileZoom, textBaseline: 'top', maxWidth: profileMaxWidth, reflow: true });
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
