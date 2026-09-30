// 対戦履歴（一覧・フォルダ整理）とリプレイの画面。
// 一覧や操作ボタンは文字入力・スクロールが要るので HTML で作り、キャンバスには背景と盤だけを描く
import { title_img, battle_img, audioManager, setScene, strings, setSceneType } from "./main.js";
import { Scene } from "./scene.js";
import { BackgroundImageUI } from "./ui_background.js";
import { OverlayUI } from "./ui.js";
import { BoardUI } from "./ui_board.js";
import { Board } from "./board.js";
import { KOMADAI_PORTRAIT_GAP } from "./ui_komadai.js";
import { clearTitleHTML, createTitleScene } from "./scene_title.js";
import { BOARD_SIZE, CELL_SIZE, KOMADAI_HEIGHT, KOMADAI_WIDTH, MOVETIME } from "./const.js";
import { getPromotedType, getUnPromotedType } from "./utils.js";
import {
    RECENT, ROOT, RECENT_LIMIT, SAVED_LIMIT, FOLDER_LIMIT, NAME_MAX_LENGTH,
    listFolder, getCounts, getFolderPath, getAllFolders, countInFolder, folderExists, getRecord,
    createFolder, renameFolder, deleteFolder, moveFolder, renameRecord, deleteRecord, moveRecord, getFolderName
} from "./match_history.js";

// 最後に開いていたフォルダ（リプレイから戻ったときに同じ場所を開く）
let currentFolder = ROOT;

// ---- HTML の小道具 ----

function el(tag, className = '', text = null) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== null) e.textContent = text;
    return e;
}

function button(text, className, onClick) {
    const b = el('button', className, text);
    b.addEventListener('click', (e) => {
        e.stopPropagation();
        onClick(e);
    });
    return b;
}

function format(key, values) {
    let text = strings[key] ?? key;
    for (const k in values) text = text.replaceAll(`{${k}}`, values[k]);
    return text;
}

function formatDate(ms) {
    const d = new Date(ms);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function formatTime(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function errorText(error) {
    switch (error) {
        case 'saved-full': return format('history-saved-full', { max: SAVED_LIMIT });
        case 'folder-full': return format('history-folder-full', { max: FOLDER_LIMIT });
        case 'empty-name': return strings['history-empty-name'];
        case 'storage': return strings['history-storage-error'];
        default: return strings['history-not-found'];
    }
}

// ---- ダイアログ ----

let closeCurrentModal = null;

function openModal(title) {
    closeModal();
    const backdrop = el('div', 'hmodal-backdrop');
    const box = el('div', 'hmodal');
    if (title) box.appendChild(el('div', 'hmodal-title', title));
    backdrop.appendChild(box);
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) closeModal();
    });
    document.body.appendChild(backdrop);
    closeCurrentModal = () => backdrop.remove();
    return box;
}

function closeModal() {
    if (closeCurrentModal) closeCurrentModal();
    closeCurrentModal = null;
}

function messageDialog(message) {
    const box = openModal(null);
    box.appendChild(el('div', 'hmodal-message', message));
    const row = el('div', 'hmodal-buttons');
    row.appendChild(button(strings['ok'], 'hbtn', closeModal));
    box.appendChild(row);
}

function confirmDialog(message, okLabel, onOk) {
    const box = openModal(null);
    box.appendChild(el('div', 'hmodal-message', message));
    const row = el('div', 'hmodal-buttons');
    row.appendChild(button(strings['cancel'], 'hbtn hbtn-sub', closeModal));
    row.appendChild(button(okLabel, 'hbtn hbtn-danger', () => {
        closeModal();
        onOk();
    }));
    box.appendChild(row);
}

// onOk(value) が失敗したときはエラー表示してダイアログを閉じない
function inputDialog(title, placeholder, initial, onOk) {
    const box = openModal(title);
    const input = el('input', 'hinput');
    input.type = 'text';
    input.maxLength = NAME_MAX_LENGTH;
    input.placeholder = placeholder;
    input.value = initial;
    box.appendChild(input);
    const error = el('div', 'hmodal-error');
    box.appendChild(error);
    const submit = () => {
        const res = onOk(input.value);
        if (res && !res.ok) {
            error.textContent = errorText(res.error);
            return;
        }
        closeModal();
        render();
    };
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submit();
        if (e.key === 'Escape') closeModal();
    });
    const row = el('div', 'hmodal-buttons');
    row.appendChild(button(strings['cancel'], 'hbtn hbtn-sub', closeModal));
    row.appendChild(button(strings['ok'], 'hbtn', submit));
    box.appendChild(row);
    input.focus();
}

function menuDialog(title, items) {
    const box = openModal(title);
    for (const item of items) {
        box.appendChild(button(item.label, `hbtn hmenu-item${item.danger ? ' hbtn-danger' : ''}`, () => {
            closeModal();
            item.onClick();
        }));
    }
    box.appendChild(button(strings['cancel'], 'hbtn hbtn-sub hmenu-item', closeModal));
}

// 移動先のフォルダを選ぶ。exclude のフォルダ（とその中）は選べない
function folderPicker(title, exclude, current, onPick) {
    const box = openModal(title);
    const list = el('div', 'hpicker');
    const folders = getAllFolders();
    const addItem = (id, name, depth) => {
        const item = button(`📁 ${name}`, 'hpicker-item', () => {
            const res = onPick(id);
            if (res && !res.ok) {
                messageDialog(errorText(res.error));
                return;
            }
            closeModal();
            render();
        });
        item.style.paddingLeft = `${12 + depth * 20}px`;
        if (id === current) item.disabled = true;
        list.appendChild(item);
        const children = folders.filter(f => f.parent === id && f.id !== exclude).sort((a, b) => a.name.localeCompare(b.name));
        for (const f of children) addItem(f.id, f.name, depth + 1);
    };
    addItem(ROOT, strings['history-top'], 0);
    box.appendChild(list);
    const row = el('div', 'hmodal-buttons');
    row.appendChild(button(strings['cancel'], 'hbtn hbtn-sub', closeModal));
    box.appendChild(row);
}

// ---- 一覧画面 ----

let panel = null;

function getPanel() {
    if (!panel) {
        panel = el('div');
        panel.id = 'historyPanel';
        panel.style.display = 'none';
        document.body.appendChild(panel);
    }
    return panel;
}

function typeText(r) {
    if (r.roomType === 'cpu') return format('history-type-cpu', { n: r.cpuLevel ?? '' });
    if (r.roomType === 'rating') return strings['history-type-rating'];
    return strings['history-type-room'];
}

function resultText(r) {
    if (r.result === 1) return strings['win'];
    if (r.result === -1) return strings['lose'];
    return strings['history-draw'];
}

function opponentNames(r) {
    return (r.myTeban === 1 ? r.goteNames : r.senteNames).join(', ');
}

function ratingText(r) {
    if (r.ratingBefore === null && r.ratingAfter === null) return '';
    const text = (v) => v === null ? strings['unrated'] : Math.round(v);
    return `${strings['rating']} ${text(r.ratingBefore)} → ${text(r.ratingAfter)}`;
}

function recordTitle(r) {
    return r.name || `vs ${opponentNames(r)}`;
}

// 保存先のフォルダの表示名（トップに保存したときは「対戦履歴」）
function folderLabel(folderId) {
    return getFolderName(folderId) ?? strings['history-top'];
}

function recordRow(r) {
    const row = el('div', 'hrow hrow-record');
    const badgeClass = r.result === 1 ? 'hbadge-win' : r.result === -1 ? 'hbadge-lose' : 'hbadge-draw';
    row.appendChild(el('div', `hbadge ${badgeClass}`, resultText(r)));
    const body = el('div', 'hrow-body');
    body.appendChild(el('div', 'hrow-title', recordTitle(r)));
    const reason = strings[`history-reason-${r.reason}`] ?? '';
    const meta = [formatDate(r.date), typeText(r), r.name ? `vs ${opponentNames(r)}` : '', reason, ratingText(r), format('history-moves', { n: r.moveCount })];
    body.appendChild(el('div', 'hrow-meta', meta.filter(Boolean).join(' · ')));
    // 最近の対戦では、フォルダに保存済みの対局に保存先を表示する
    if (currentFolder === RECENT && r.folder !== null) {
        body.appendChild(el('div', 'hrow-saved', `📁 ${folderLabel(r.folder)}`));
    }
    row.appendChild(body);
    row.appendChild(button(strings['history-play'], 'hbtn hbtn-play', () => openReplay(r.id)));
    row.appendChild(button('⋯', 'hbtn hbtn-more', () => recordMenu(r)));
    row.addEventListener('click', () => openReplay(r.id));
    return row;
}

function recordMenu(r) {
    const inRecent = currentFolder === RECENT;
    const items = [];
    // 保存先のフォルダを選ぶ（保存済みなら移す）。最近の対戦には残る
    const saveLabel = r.folder === null ? strings['history-save'] : inRecent ? strings['history-change-folder'] : strings['history-move'];
    items.push({ label: saveLabel, onClick: () => folderPicker(strings['history-choose-folder'], null, r.folder, (id) => moveRecord(r.id, id)) });
    items.push({ label: strings['history-rename'], onClick: () => inputDialog(strings['history-rename'], strings['history-record-name'], r.name, (v) => renameRecord(r.id, v)) });
    // 削除は今見ている場所から外す。もう一方（最近の対戦・保存先）にも入っていれば、そちらには残る
    let message = format('history-delete-confirm', { name: recordTitle(r) });
    let label = strings['history-delete'];
    if (inRecent && r.folder !== null) {
        message = format('history-remove-recent-confirm', { name: recordTitle(r), folder: folderLabel(r.folder) });
        label = strings['history-remove'];
    } else if (!inRecent && r.recent) {
        message = format('history-remove-folder-confirm', { name: recordTitle(r) });
        label = strings['history-remove'];
    }
    items.push({
        label: label, danger: true, onClick: () => confirmDialog(message, label, () => {
            const res = deleteRecord(r.id, inRecent ? RECENT : r.folder);
            if (!res.ok) messageDialog(errorText(res.error));
            render();
        })
    });
    menuDialog(recordTitle(r), items);
}

function folderRow(f) {
    const row = el('div', 'hrow hrow-folder');
    row.appendChild(el('div', 'hfolder-icon', '📁'));
    const body = el('div', 'hrow-body');
    body.appendChild(el('div', 'hrow-title', f.name));
    body.appendChild(el('div', 'hrow-meta', format('history-games', { n: countInFolder(f.id) })));
    row.appendChild(body);
    row.appendChild(button('⋯', 'hbtn hbtn-more', () => folderMenu(f)));
    row.addEventListener('click', () => openFolder(f.id));
    return row;
}

function folderMenu(f) {
    menuDialog(f.name, [
        { label: strings['history-rename'], onClick: () => inputDialog(strings['history-rename'], strings['history-folder-name'], f.name, (v) => renameFolder(f.id, v)) },
        { label: strings['history-move'], onClick: () => folderPicker(strings['history-choose-folder'], f.id, f.parent, (id) => moveFolder(f.id, id)) },
        {
            label: strings['history-delete'], danger: true, onClick: () => confirmDialog(format('history-delete-folder-confirm', { name: f.name, n: countInFolder(f.id) }), strings['history-delete'], () => {
                const res = deleteFolder(f.id);
                if (!res.ok) messageDialog(errorText(res.error));
                if (!folderExists(currentFolder)) currentFolder = ROOT;
                render();
            })
        },
    ]);
}

function openFolder(id) {
    currentFolder = id;
    render();
    const list = panel.querySelector('.hlist');
    if (list) list.scrollTop = 0;
}

function render() {
    const p = getPanel();
    if (!folderExists(currentFolder)) currentFolder = ROOT;
    p.replaceChildren();

    const header = el('div', 'hheader');
    header.appendChild(el('div', 'hheader-title', strings['history']));
    header.appendChild(button(strings['back'], 'hbtn hbtn-sub', () => setScene(createTitleScene())));
    p.appendChild(header);

    // パンくず（対戦履歴 > フォルダ > …）
    const crumbs = el('div', 'hcrumbs');
    const addCrumb = (label, id) => {
        if (crumbs.childNodes.length > 0) crumbs.appendChild(el('span', 'hcrumb-sep', '›'));
        if (id === currentFolder) {
            crumbs.appendChild(el('span', 'hcrumb-current', label));
        } else {
            crumbs.appendChild(button(label, 'hcrumb', () => openFolder(id)));
        }
    };
    addCrumb(strings['history-top'], ROOT);
    if (currentFolder === RECENT) addCrumb(strings['history-recent'], RECENT);
    for (const f of getFolderPath(currentFolder)) addCrumb(f.name, f.id);
    if (currentFolder !== ROOT) p.appendChild(crumbs);

    const counts = getCounts();
    const toolbar = el('div', 'htoolbar');
    if (currentFolder === RECENT) {
        toolbar.appendChild(el('div', 'hnote', format('history-recent-note', { n: RECENT_LIMIT })));
    } else {
        toolbar.appendChild(button(`＋ ${strings['history-new-folder']}`, 'hbtn', () => {
            inputDialog(strings['history-new-folder'], strings['history-folder-name'], '', (v) => createFolder(v, currentFolder));
        }));
        toolbar.appendChild(el('div', 'hnote', format('history-saved-count', { n: counts.saved, max: SAVED_LIMIT })));
    }
    p.appendChild(toolbar);

    const list = el('div', 'hlist');
    const { folders, records } = listFolder(currentFolder);
    if (currentFolder === ROOT) {
        const recent = el('div', 'hrow hrow-folder hrow-recent');
        recent.appendChild(el('div', 'hfolder-icon', '🕘'));
        const body = el('div', 'hrow-body');
        body.appendChild(el('div', 'hrow-title', strings['history-recent']));
        body.appendChild(el('div', 'hrow-meta', `${counts.recent}/${RECENT_LIMIT}`));
        recent.appendChild(body);
        recent.addEventListener('click', () => openFolder(RECENT));
        list.appendChild(recent);
    }
    for (const f of folders) list.appendChild(folderRow(f));
    for (const r of records) list.appendChild(recordRow(r));
    if (folders.length === 0 && records.length === 0 && currentFolder !== ROOT) {
        list.appendChild(el('div', 'hempty', strings['history-empty']));
    }
    p.appendChild(list);
}

function openReplay(id) {
    const record = getRecord(id);
    if (!record) {
        messageDialog(strings['history-not-found']);
        render();
        return;
    }
    setScene(createReplayScene(record));
}

export function createHistoryScene() {
    clearTitleHTML();
    setSceneType('history');
    const historyScene = new Scene();
    historyScene.add(new BackgroundImageUI({ image: title_img }));
    historyScene.add(new OverlayUI({ x: 0, y: 0, width: 10, height: 10, color: '#000000aa', borderRadius: 0 }));
    const p = getPanel();
    p.style.display = 'flex';
    render();
    historyScene.destroy = () => {
        closeModal();
        p.style.display = 'none';
    };
    return historyScene;
}

// ---- リプレイ ----

// 記録した手を盤に適用する（記録済みの手は合法なので判定はしない）。
// t は対局開始からの時間で、盤の時刻（lastmovetime）とクールダウン表示の時刻（lastmoveptime）の両方に使う
function applyRecordedMove(board, m) {
    const side = m.teban === 1 ? 'sente' : 'gote';
    if (m.x === -1) {
        board.komadaiPieces[side][m.type]--;
        board.map[m.nx][m.ny] = { type: m.type, teban: m.teban, lastmovetime: m.t, lastmoveptime: m.t, reserved: false };
        return;
    }
    const piece = board.map[m.x][m.y];
    if (!piece) return;
    const captured = board.map[m.nx][m.ny];
    if (captured) board.komadaiPieces[side][getUnPromotedType(captured.type)]++;
    const type = m.nari ? getPromotedType(piece.type) : piece.type;
    board.map[m.nx][m.ny] = { type: type, teban: piece.teban, lastmovetime: m.t, lastmoveptime: m.t, reserved: false };
    board.map[m.x][m.y] = null;
}

const SPEEDS = [0.5, 1, 2, 4];
// 駒は開始5秒後から動かせる。再生はその少し前から始める
const REPLAY_START = 3000;
const GAME_START = 5000;

function playerText(names, rating, mine, mark) {
    let text = `${mark} ${names.join(', ')}`;
    if (rating !== null && rating !== undefined) text += ` (${Math.round(rating)})`;
    if (mine) text += strings['history-me'];
    return text;
}

export function createReplayScene(record) {
    clearTitleHTML();
    setSceneType('replay');
    const { meta, moves } = record;
    const replayScene = new Scene();
    replayScene.add(new BackgroundImageUI({ image: battle_img }));

    const moveTime = meta.moveTime ?? { sente: MOVETIME, gote: MOVETIME };
    const duration = Math.max(meta.duration ?? 0, moves.length > 0 ? moves[moves.length - 1].t + 500 : GAME_START);
    let board = null;
    let applied = 0; // 盤に適用した手の数
    let time = 0; // 再生位置（対局開始からのミリ秒）
    let playing = true;
    let speedIndex = 1;

    const boardUI = new BoardUI({ gameManager: null, board: new Board(), x: 0, y: 0 });
    boardUI.init(meta.myTeban === -1 ? -1 : 1);
    boardUI.touchable = false;
    boardUI.komadai.showKeys = false;
    boardUI.now = () => time;
    replayScene.add(boardUI);

    function resetBoard() {
        board = new Board();
        board.init(0, 0, moveTime, meta.pawnLimit4thRank);
        board.finished = true;
        boardUI.board = board;
        boardUI.komadai.board = board;
        applied = 0;
    }

    // 再生位置を target に移す。戻るときは初めから並べ直す
    function seek(target, playSound = false) {
        target = Math.max(0, Math.min(duration, target));
        if (target < time || board === null) resetBoard();
        let moved = false;
        while (applied < moves.length && moves[applied].t <= target) {
            applyRecordedMove(board, moves[applied]);
            applied++;
            moved = true;
        }
        time = target;
        if (moved && playSound) audioManager.playSound("sound");
    }

    // ---- HTML（上に対局者、下に再生操作） ----
    const info = el('div', 'replay-info');
    const players = el('div', 'replay-players');
    players.appendChild(el('span', 'replay-player', playerText(meta.senteNames, meta.senteRating, meta.myTeban === 1, '☗')));
    players.appendChild(el('span', 'replay-vs', 'vs'));
    players.appendChild(el('span', 'replay-player', playerText(meta.goteNames, meta.goteRating, meta.myTeban === -1, '☖')));
    info.appendChild(players);
    const reason = strings[`history-reason-${meta.reason}`] ?? '';
    const detail = [formatDate(meta.date), typeText(meta), resultText(meta), reason, ratingText(meta)].filter(Boolean).join(' · ');
    info.appendChild(el('div', 'replay-detail', detail));

    const controls = el('div', 'replay-controls');
    const seekRow = el('div', 'replay-row');
    const slider = el('input', 'replay-seek');
    slider.type = 'range';
    slider.min = '0';
    slider.max = String(duration);
    slider.step = '10';
    const timeLabel = el('span', 'replay-time');
    seekRow.appendChild(slider);
    seekRow.appendChild(timeLabel);
    controls.appendChild(seekRow);

    const buttonRow = el('div', 'replay-row');
    // 1手ずつ動かすときは手数で並べ直す（同じ時刻の手が複数あっても1手ずつ進める・戻す）
    const stepTo = (count) => {
        playing = false;
        count = Math.max(0, Math.min(moves.length, count));
        resetBoard();
        while (applied < count) {
            applyRecordedMove(board, moves[applied]);
            applied++;
        }
        time = count > 0 ? moves[count - 1].t : REPLAY_START;
    };
    const firstButton = button('⏮', 'hbtn replay-btn', () => stepTo(0));
    const prevButton = button('◀', 'hbtn replay-btn', () => stepTo(applied - 1));
    const playButton = button('', 'hbtn replay-btn replay-play', () => togglePlay());
    const nextButton = button('▶', 'hbtn replay-btn', () => stepTo(Math.min(moves.length, applied + 1)));
    const lastButton = button('⏭', 'hbtn replay-btn', () => {
        playing = false;
        seek(duration);
    });
    const speedButton = button('', 'hbtn replay-btn replay-speed', () => {
        speedIndex = (speedIndex + 1) % SPEEDS.length;
    });
    const backButton = button(strings['back'], 'hbtn hbtn-sub replay-back', () => setScene(createHistoryScene()));
    for (const b of [firstButton, prevButton, playButton, nextButton, lastButton, speedButton, backButton]) buttonRow.appendChild(b);
    controls.appendChild(buttonRow);

    document.body.appendChild(info);
    document.body.appendChild(controls);

    function togglePlay() {
        if (!playing && time >= duration) seek(REPLAY_START);
        playing = !playing;
    }

    let dragging = false;
    slider.addEventListener('input', () => {
        dragging = true;
        seek(Number(slider.value));
    });
    slider.addEventListener('change', () => {
        dragging = false;
    });

    const onKeyDown = (e) => {
        if (closeCurrentModal) return;
        if (e.key === ' ') {
            togglePlay();
        } else if (e.key === 'ArrowLeft') {
            stepTo(applied - 1);
        } else if (e.key === 'ArrowRight') {
            stepTo(Math.min(moves.length, applied + 1));
        } else {
            return;
        }
        e.preventDefault();
    };
    document.addEventListener('keydown', onKeyDown);

    function updateControls() {
        playButton.textContent = playing ? '⏸' : '▶';
        speedButton.textContent = `×${SPEEDS[speedIndex]}`;
        if (!dragging) slider.value = String(Math.round(time));
        timeLabel.textContent = `${formatTime(time - GAME_START)} / ${formatTime(duration - GAME_START)}  ${format('history-moves', { n: `${applied}/${moves.length}` })}`;
    }

    // 毎フレーム再生位置を進める（タブを離れていた間は進めない）
    let lastFrame = performance.now();
    const baseDraw = replayScene.draw.bind(replayScene);
    replayScene.draw = (ctx) => {
        const now = performance.now();
        const dt = Math.min(now - lastFrame, 100);
        lastFrame = now;
        if (playing && !dragging) {
            seek(time + dt * SPEEDS[speedIndex], true);
            if (time >= duration) playing = false;
        }
        updateControls();
        baseDraw(ctx);
    };

    // 盤は上の対局者表示と下の再生操作の間に収める
    replayScene.onLayout = (portrait, sc) => {
        boardUI.setPortrait(portrait);
        const top = -sc.halfHeight + (info.getBoundingClientRect().bottom + 6) / sc.scale;
        const bottom = sc.halfHeight - (window.innerHeight - controls.getBoundingClientRect().top + 6) / sc.scale;
        const cy = (top + bottom) / 2;
        const half = Math.max(0.1, (bottom - top) / 2);
        const boardHalf = BOARD_SIZE * CELL_SIZE / 2;
        if (!portrait) {
            // 横画面: 駒台は盤の横なので高さは盤だけ。横は駒台まで画面に収める
            const widthHalf = boardHalf + CELL_SIZE * 0.3 + KOMADAI_WIDTH;
            const zoom = Math.min(1, half / boardHalf, (sc.halfWidth - 0.02) / widthHalf);
            boardUI.place({ x: 0, y: cy, zoom: zoom });
            return;
        }
        // 縦画面: 駒台は盤の右下（自分）・左上（相手）。対局画面と同じく足りなければ駒台を縮める
        const zoom = Math.min(1.16, half / (boardHalf + KOMADAI_PORTRAIT_GAP + KOMADAI_HEIGHT * 0.9));
        boardUI.place({ x: 0, y: cy, zoom: zoom });
        const komadaiRoom = half / zoom - boardHalf - KOMADAI_PORTRAIT_GAP;
        boardUI.komadai.portraitScale = Math.min(1.15, komadaiRoom / KOMADAI_HEIGHT);
    };

    replayScene.destroy = () => {
        document.removeEventListener('keydown', onKeyDown);
        info.remove();
        controls.remove();
    };

    seek(REPLAY_START);
    updateControls();
    return replayScene;
}
