// オンライン対戦のマッチング。待っている間は CPU 戦や対戦履歴の画面に移れるので、
// 状態はシーンとは別にここで持つ（タイトル以外の画面では隅に「マッチング中」を出す）
import { connectToServer, disconnectFromServer, playerName, player_id, selectedCharacterName, strings, sceneType } from "./main.js";

let active = false;
// マッチング待ち・対局中の人数（/api/status から取る）
export const liveStatus = { waiting: 0, playing: 0 };
const listeners = new Set();

const pill = document.getElementById("matchingPill");
const pillText = document.getElementById("matchingPillText");
const pillStop = document.getElementById("matchingPillStop");
const noticeToast = document.getElementById("noticeToast");

pillStop.addEventListener('click', () => stopMatching());

export function isMatching() {
    return active;
}

// マッチングの状態や人数が変わったときに呼ぶ関数を登録する
export function onMatchingChange(listener) {
    listeners.add(listener);
}

function changed() {
    for (const listener of listeners) listener();
    updateMatchingPill();
}

// マッチングを始める。つながらなければ reject する
export function startMatching() {
    active = true;
    changed();
    return connectToServer().then(socket => {
        socket.emit("requestMatch", { name: playerName, characterName: selectedCharacterName, player_id: player_id });
    }).catch(err => {
        active = false;
        changed();
        throw err;
    });
}

// マッチングをやめる（自分でやめる・失敗・切断）。サーバーとの接続を切れば待ち行列からも外れる
export function stopMatching() {
    if (!active) return;
    active = false;
    disconnectFromServer();
    changed();
}

// 相手が見つかった。この後ゲームサーバーにつなぎ直し、対局画面に切り替わる
export function matchFound() {
    active = false;
    changed();
    showNotice(strings['match-found']);
}

// タイトル以外の画面では、隅に「マッチング中［やめる］」を出す（対局画面は音量設定の下、それ以外は左上）
export function updateMatchingPill() {
    pill.hidden = !active || sceneType === 'title';
    pill.dataset.place = sceneType === 'game' ? 'game' : 'corner';
    pillText.textContent = strings['matching'] ?? '';
    pillStop.textContent = strings['matching-stop'] ?? '';
}

let noticeTimer = null;

// 画面上部に短いお知らせを出す（kind: 'info' | 'error'）
export function showNotice(text, kind = 'info') {
    noticeToast.textContent = text;
    noticeToast.dataset.kind = kind;
    noticeToast.hidden = false;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
        noticeToast.hidden = true;
    }, 3000);
}

export async function refreshLiveStatus() {
    try {
        const response = await fetch('/api/status');
        if (!response.ok) return;
        const data = await response.json();
        liveStatus.waiting = Number.isInteger(data.waiting) ? data.waiting : 0;
        liveStatus.playing = Number.isInteger(data.playing) ? data.playing : 0;
        changed();
    } catch (e) {
        // 取れなければ前の値のまま
    }
}

// タイトル画面を開いている間とマッチング中は、人数を定期的に取り直す
setInterval(() => {
    if (document.hidden) return;
    if (sceneType === 'title' || active) refreshLiveStatus();
}, 15000);
