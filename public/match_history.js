// 対戦履歴（ブラウザの localStorage に保存する。サーバーには送らない）
//
// 対局は「最近の対戦」と「保存先のフォルダ」の両方に入れられる
//  - 最近の対戦（record.recent）: 終局すると自動で入る。RECENT_LIMIT 件を超えると古いものから外れる
//  - 保存先（record.folder = ROOT か自分で作ったフォルダ。null なら保存していない）:
//    古くなっても消えない。合計 SAVED_LIMIT 件まで。フォルダに保存しても最近の対戦には残る
// どちらにも入っていない対局は消す
// 一覧（対戦相手・結果など）は INDEX_KEY に、手順は対局ごとに MOVES_KEY(id) に分けて置く

const INDEX_KEY = 'matchHistory';
const MOVES_KEY = (id) => `matchHistory.moves.${id}`;

export const RECENT = 'recent';
export const ROOT = 'root';
export const RECENT_LIMIT = 100;
export const SAVED_LIMIT = 200;
export const FOLDER_LIMIT = 50;
export const NAME_MAX_LENGTH = 30;

// 打ち駒の種類（手順の保存用に番号にする）
const DROP_TYPES = ['pawn', 'lance', 'knight', 'silver', 'gold', 'bishop', 'rook', 'king', 'king2'];

// 新しい順に並べる比較関数（同じ時刻なら後から保存したものを新しいとする）
function newerFirst(a, b) {
    return (b.date - a.date) || (Number(b.id.slice(1)) - Number(a.id.slice(1)));
}

function emptyIndex() {
    return { version: 1, nextId: 1, folders: [], records: [] };
}

const isObject = (v) => v !== null && typeof v === 'object';
const isValidFolder = (f) => isObject(f) && typeof f.id === 'string' && /^f\d+$/.test(f.id) && typeof f.name === 'string' && typeof f.parent === 'string';
const isValidRecord = (r) => isObject(r) && typeof r.id === 'string' && /^r\d+$/.test(r.id) && (typeof r.folder === 'string' || r.folder === null)
    && typeof r.date === 'number' && Array.isArray(r.senteNames) && Array.isArray(r.goteNames);

// 壊れた項目は捨て、行き先のないフォルダ・対局はトップに戻して読み込む
function loadIndex() {
    let index = null;
    try {
        index = JSON.parse(localStorage.getItem(INDEX_KEY));
    } catch (e) {
        // 読めなければ空から始める
    }
    if (!isObject(index) || index.version !== 1 || !Array.isArray(index.folders) || !Array.isArray(index.records)) return emptyIndex();
    const folders = index.folders.filter(isValidFolder);
    const byId = new Map(folders.map(f => [f.id, f]));
    for (const f of folders) {
        // 親が無い・親をたどると自分に戻る（循環）フォルダはトップに置く
        const seen = new Set([f.id]);
        let parent = f.parent;
        while (parent !== ROOT && byId.has(parent) && !seen.has(parent)) {
            seen.add(parent);
            parent = byId.get(parent).parent;
        }
        if (parent !== ROOT) f.parent = ROOT;
    }
    let records = index.records.filter(isValidRecord);
    for (const r of records) {
        r.recent = r.recent === true;
        if (r.folder !== null && r.folder !== ROOT && !byId.has(r.folder)) r.folder = ROOT;
    }
    // 最近の対戦にも保存先にも入っていない対局は捨てる
    records = records.filter(r => r.recent || r.folder !== null);
    // 番号は使用済みのものより大きくする（重複させない）
    let nextId = Number.isInteger(index.nextId) && index.nextId > 0 ? index.nextId : 1;
    for (const item of [...folders, ...records]) nextId = Math.max(nextId, Number(item.id.slice(1)) + 1);
    return { version: 1, nextId, folders, records };
}

function oldestOf(records) {
    let result = null;
    for (const r of records) if (!result || newerFirst(r, result) > 0) result = r;
    return result;
}

function removeRecordData(index, record) {
    index.records = index.records.filter(r => r !== record);
    try { localStorage.removeItem(MOVES_KEY(record.id)); } catch (e) { /* 無視 */ }
}

// 最近の対戦から外す。保存先のフォルダにも無ければ消す
function removeFromRecent(index, record) {
    record.recent = false;
    if (record.folder === null) removeRecordData(index, record);
}

// 最近の対戦が上限を超えたら古いものから外す
function trimRecent(index) {
    let recent = index.records.filter(r => r.recent);
    while (recent.length > RECENT_LIMIT) {
        const r = oldestOf(recent);
        removeFromRecent(index, r);
        recent = recent.filter(x => x !== r);
    }
}

// 容量を空けるため、保存していない最近の対戦のうち一番古いものを消す。消せたら true
function dropOldestRecent(index) {
    const r = oldestOf(index.records.filter(x => x.recent && x.folder === null));
    if (!r) return false;
    removeRecordData(index, r);
    return true;
}

// 容量不足で書けないときは、最近の対戦を古い順に消して空きを作り直す。
// makeValue は書く内容を返す関数（一覧自体を書くときは、消した後の一覧を書き直すため毎回作り直す）
function setItemMakingRoom(index, key, makeValue) {
    for (;;) {
        try {
            localStorage.setItem(key, makeValue());
            return true;
        } catch (e) {
            if (!dropOldestRecent(index)) return false;
            // 消した対局を一覧からも外しておく（書けなければ後の saveIndex で書く）
            if (key !== INDEX_KEY) {
                try { localStorage.setItem(INDEX_KEY, JSON.stringify(index)); } catch (e2) { /* 無視 */ }
            }
        }
    }
}

function saveIndex(index) {
    return setItemMakingRoom(index, INDEX_KEY, () => JSON.stringify(index));
}

// 手順は [t, x, y, nx, ny, flags] を並べた数値の配列にする。
// t は対局開始（サーバー時刻）からのミリ秒、flags = 成り(1) | 先手(2) | (打ち駒の種類+1) << 2
function encodeMoves(moves) {
    const flat = [];
    for (const m of moves) {
        const typeIndex = m.x === -1 ? DROP_TYPES.indexOf(m.type) : -1;
        flat.push(m.t, m.x, m.y, m.nx, m.ny, (m.nari ? 1 : 0) | (m.teban === 1 ? 2 : 0) | ((typeIndex + 1) << 2));
    }
    return JSON.stringify(flat);
}

function decodeMoves(text) {
    const flat = JSON.parse(text);
    const moves = [];
    for (let i = 0; i + 5 < flat.length; i += 6) {
        const flags = flat[i + 5];
        const typeIndex = (flags >> 2) - 1;
        moves.push({
            t: flat[i], x: flat[i + 1], y: flat[i + 2], nx: flat[i + 3], ny: flat[i + 4],
            nari: (flags & 1) === 1,
            teban: (flags & 2) ? 1 : -1,
            type: typeIndex >= 0 ? DROP_TYPES[typeIndex] : null,
        });
    }
    return moves;
}

// ---- 対局中の記録 ----

let current = null;

// 対局開始時に呼ぶ。meta は一覧に表示する情報（対戦相手・対局の種類など）
export function beginRecord(meta) {
    current = { meta, moves: [] };
}

export function cancelRecord() {
    current = null;
}

export function isRecording() {
    return current !== null;
}

// 盤に適用された手を記録する。t は対局開始からのミリ秒
export function recordMove(move, t) {
    if (!current) return;
    current.moves.push({ t: Math.max(0, Math.round(t)), x: move.x, y: move.y, nx: move.nx, ny: move.ny, nari: !!move.nari, teban: move.teban, type: move.type ?? null });
}

// 終局時に呼び、最近の対戦に保存する。result は結果など終局時に分かる情報
export function finishRecord(result) {
    if (!current) return;
    const { meta, moves } = current;
    current = null;
    try {
        const index = loadIndex();
        const id = `r${index.nextId++}`;
        const lastT = moves.length > 0 ? moves[moves.length - 1].t : 0;
        const record = {
            ...meta, ...result, id, recent: true, folder: null, name: '', date: Date.now(), moveCount: moves.length,
            duration: Math.max(Math.round(result.duration ?? 0), lastT + 500),
        };
        const movesText = encodeMoves(moves);
        // 先に手順を書く（書けなければ一覧にも載せない）
        if (!setItemMakingRoom(index, MOVES_KEY(id), () => movesText)) {
            saveIndex(index);
            return;
        }
        index.records.push(record);
        trimRecent(index);
        if (!saveIndex(index)) {
            try { localStorage.removeItem(MOVES_KEY(id)); } catch (e) { /* 無視 */ }
        }
    } catch (e) {
        console.error('対戦履歴を保存できませんでした', e);
    }
}

// ---- 一覧・整理 ----

export function getCounts() {
    const index = loadIndex();
    const recent = index.records.filter(r => r.recent).length;
    const saved = index.records.filter(r => r.folder !== null).length;
    return { recent, saved, folders: index.folders.length };
}

// フォルダの中身（サブフォルダは名前順、対局は新しい順）
export function listFolder(folderId) {
    const index = loadIndex();
    const folders = index.folders.filter(f => f.parent === folderId && folderId !== RECENT)
        .sort((a, b) => a.name.localeCompare(b.name));
    const records = index.records.filter(r => folderId === RECENT ? r.recent : r.folder === folderId).sort(newerFirst);
    return { folders, records };
}

export function getAllFolders() {
    return loadIndex().folders;
}

// フォルダ内の件数（サブフォルダの中も含む）
export function countInFolder(folderId) {
    const index = loadIndex();
    const ids = new Set(descendantFolderIds(index, folderId));
    return index.records.filter(r => ids.has(r.folder)).length;
}

function descendantFolderIds(index, folderId) {
    const ids = [folderId];
    for (let i = 0; i < ids.length; i++) {
        for (const f of index.folders) if (f.parent === ids[i] && !ids.includes(f.id)) ids.push(f.id);
    }
    return ids;
}

// ルートから folderId までのフォルダの並び（パンくず表示用）。RECENT と ROOT は空配列
export function getFolderPath(folderId) {
    const index = loadIndex();
    const path = [];
    let id = folderId;
    while (id !== ROOT && id !== RECENT) {
        const f = index.folders.find(x => x.id === id);
        if (!f) break;
        path.unshift(f);
        id = f.parent;
    }
    return path;
}

export function folderExists(folderId) {
    return folderId === ROOT || folderId === RECENT || loadIndex().folders.some(f => f.id === folderId);
}

export function getRecord(id) {
    const index = loadIndex();
    const meta = index.records.find(r => r.id === id);
    if (!meta) return null;
    try {
        return { meta, moves: decodeMoves(localStorage.getItem(MOVES_KEY(id))) };
    } catch (e) {
        return null;
    }
}

function cleanName(name) {
    return String(name ?? '').trim().slice(0, NAME_MAX_LENGTH);
}

// 戻り値は成功なら { ok: true }、失敗なら { ok: false, error: 'folder-full' など }
export function createFolder(name, parent) {
    const index = loadIndex();
    name = cleanName(name);
    if (!name) return { ok: false, error: 'empty-name' };
    if (index.folders.length >= FOLDER_LIMIT) return { ok: false, error: 'folder-full' };
    if (parent !== ROOT && !index.folders.some(f => f.id === parent)) return { ok: false, error: 'not-found' };
    const folder = { id: `f${index.nextId++}`, name, parent };
    index.folders.push(folder);
    return saveIndex(index) ? { ok: true, folder } : { ok: false, error: 'storage' };
}

export function renameFolder(id, name) {
    const index = loadIndex();
    name = cleanName(name);
    if (!name) return { ok: false, error: 'empty-name' };
    const folder = index.folders.find(f => f.id === id);
    if (!folder) return { ok: false, error: 'not-found' };
    folder.name = name;
    return saveIndex(index) ? { ok: true } : { ok: false, error: 'storage' };
}

// フォルダを中身（サブフォルダ・対局）ごと消す。最近の対戦にも入っている対局はそちらに残る
export function deleteFolder(id) {
    const index = loadIndex();
    if (!index.folders.some(f => f.id === id)) return { ok: false, error: 'not-found' };
    const ids = new Set(descendantFolderIds(index, id));
    const removed = [];
    for (const r of index.records) {
        if (!ids.has(r.folder)) continue;
        r.folder = null;
        if (!r.recent) removed.push(r);
    }
    index.folders = index.folders.filter(f => !ids.has(f.id));
    index.records = index.records.filter(r => !removed.includes(r));
    if (!saveIndex(index)) return { ok: false, error: 'storage' };
    for (const r of removed) {
        try { localStorage.removeItem(MOVES_KEY(r.id)); } catch (e) { /* 無視 */ }
    }
    return { ok: true };
}

// フォルダを別のフォルダの中へ移す（自分自身や自分のサブフォルダの中には移せない）
export function moveFolder(id, parent) {
    const index = loadIndex();
    const folder = index.folders.find(f => f.id === id);
    if (!folder) return { ok: false, error: 'not-found' };
    if (parent !== ROOT && !index.folders.some(f => f.id === parent)) return { ok: false, error: 'not-found' };
    if (descendantFolderIds(index, id).includes(parent)) return { ok: false, error: 'invalid-target' };
    folder.parent = parent;
    return saveIndex(index) ? { ok: true } : { ok: false, error: 'storage' };
}

export function renameRecord(id, name) {
    const index = loadIndex();
    const record = index.records.find(r => r.id === id);
    if (!record) return { ok: false, error: 'not-found' };
    record.name = cleanName(name);
    return saveIndex(index) ? { ok: true } : { ok: false, error: 'storage' };
}

// 対局を from（RECENT か保存先のフォルダ）から外す。どちらにも無くなったら消す
export function deleteRecord(id, from) {
    const index = loadIndex();
    const record = index.records.find(r => r.id === id);
    if (!record) return { ok: false, error: 'not-found' };
    const moves = localStorage.getItem(MOVES_KEY(id));
    if (from === RECENT) {
        removeFromRecent(index, record);
    } else {
        record.folder = null;
        if (!record.recent) removeRecordData(index, record);
    }
    if (!saveIndex(index)) {
        // 一覧を書けなかったので手順も元に戻す
        if (moves !== null) {
            try { localStorage.setItem(MOVES_KEY(id), moves); } catch (e) { /* 無視 */ }
        }
        return { ok: false, error: 'storage' };
    }
    return { ok: true };
}

// 対局を保存先のフォルダ（ROOT か自分で作ったフォルダ）に入れる・移す。最近の対戦には残る
export function moveRecord(id, folder) {
    const index = loadIndex();
    const record = index.records.find(r => r.id === id);
    if (!record) return { ok: false, error: 'not-found' };
    if (folder !== ROOT && !index.folders.some(f => f.id === folder)) return { ok: false, error: 'not-found' };
    if (record.folder === null) {
        const saved = index.records.filter(r => r.folder !== null).length;
        if (saved >= SAVED_LIMIT) return { ok: false, error: 'saved-full' };
    }
    record.folder = folder;
    return saveIndex(index) ? { ok: true } : { ok: false, error: 'storage' };
}

// 保存先のフォルダ名（トップや見つからないときは null）
export function getFolderName(folderId) {
    return loadIndex().folders.find(f => f.id === folderId)?.name ?? null;
}
