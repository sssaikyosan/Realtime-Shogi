import { Keyboard } from "./keyboard.js";
import { GameManager } from "./game_manager.js";
import { Board } from './board.js';
import { AudioManager } from "./audio_manager.js"; // audio_manager.jsからインポート
import { clearTitleHTML, createTitleScene, initTitleText, renderTitleStatus, roomJoinFailed, updateRanking } from "./scene_title.js";
import { isMatching, matchFound, showNotice, stopMatching, updateMatchingPill } from "./matching.js";
import { createPlayScene, backToRoom, endGame, endRoomGame, initGameText, connectionLost } from "./scene_game.js";
import { createRoomScene, initRoomText, setRoomData, roomUpdate, roomdata } from "./scene_room.js";
import { CHARACTER_FOLDER, LANGUAGE_FOLDER, LANGUAGES, MOVETIME, NUM_QUOTES } from "./const.js";
import { beginHtmlFrame, endHtmlFrame } from "./ui_html.js";

// 初期化フラグ
let isInitialized = false;

export let all_strings = {};
export let strings = {}; // 言語データを保持する変数

export let pieceImages = {};
export let characterImages = {}; // キャラクター画像用オブジェクトを追加
export let canvas = null;
/** @type {CanvasRenderingContext2D} */
export let ctx = null;
export let emitter = null;
export let socket = null; // Socket.IO 接続オブジェクト
export let scene = null; // scene変数はmain.jsで管理
export let sceneType = null;
export let playerName = "";
export let player_id = null; // 永続的なプレイヤーID
export let serverStatus = { topPlayers: [], announcement: "" };
export let playerStatus = { total_games: -1, rating: -1 };

export let playerRatingElement = null;
export let gamesPlayedElement = null;
//@ts-ignore
/**@type {Keyboard} */
export let keyboard = null;
export let audioManager = new AudioManager();

export let gameManager = null;
export let characterProfiles = null;

export let onClick = false;

// タッチ操作できる端末か（スマホ・タブレット）。自動成りボタンなどタッチ専用UIの表示に使う
export const isTouchDevice = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
// 最後に使われた入力がタッチかどうか（タップ選択→タップ移動の判定に使う）
export let lastPointerIsTouch = false;

// キャラクター画像フォルダ名のリスト (prof.jsonから抽出)
export const characterFiles = [ // exportを追加
  "rei", "aoi", "akira"
];

export let selectedCharacterName = null; // 選択されたキャラクターの名前

// selectedCharacterNameを設定する関数を追加
export function setSelectedCharacterName(name) {
  selectedCharacterName = name;
}
export const title_img = new Image(1920, 1080);
title_img.src = '/images/title_261001.jpg';

export const battle_img = new Image(1920, 1080);
battle_img.src = '/images/battle.png';

// 動画の事前読み込み（画像と同様な静的方式）
export let characterVideos = {};

function initializeCharacterVideos() {
  for (const charName of characterFiles) {
    characterVideos[charName] = {};

    // クリック動画
    for (let i = 1; i <= NUM_QUOTES; i++) {
      const videoKey = `click${i}`;
      characterVideos[charName][videoKey] = document.createElement('video');
      characterVideos[charName][videoKey].preload = 'auto';
      characterVideos[charName][videoKey].src = `/${CHARACTER_FOLDER}/${charName}/click${i}.webm`;
    }

    // 開始動画
    characterVideos[charName]['start'] = document.createElement('video');
    characterVideos[charName]['start'].preload = 'auto';
    characterVideos[charName]['start'].src = `/${CHARACTER_FOLDER}/${charName}/start1.webm`;

    // 勝利動画
    characterVideos[charName]['win'] = document.createElement('video');
    characterVideos[charName]['win'].preload = 'auto';
    characterVideos[charName]['win'].src = `/${CHARACTER_FOLDER}/${charName}/win1.webm`;
  }
}

// 初期化関数を呼び出す
initializeCharacterVideos();

// ストレージからキャラクターを読み込む関数
function loadOrSelectCharacter() {
  const storedCharacter = localStorage.getItem('selectedCharacter');
  if (storedCharacter && characterFiles.some(file => file === storedCharacter)) {
    selectedCharacterName = storedCharacter;
  } else {
    // ストレージにない場合、または無効な場合は0を設定
    selectedCharacterName = characterFiles[0];
    localStorage.setItem('selectedCharacter', selectedCharacterName);
  }
}

export function setScene(s) {
  // 現在のシーンが存在し、destroyメソッドがあれば呼び出す
  if (scene && scene.destroy && typeof scene.destroy === 'function') {
    scene.destroy();
  }
  scene = s;
  if (canvas) resizeHTML();
  updateMatchingPill();
}

export function setPlayerName(name) {
  playerName = name;
}

export function setOnclick(s) {
  onClick = s;
}

export function setSceneType(str) {
  sceneType = str;
}

export function setStatus(rating, total_games) {
  playerStatus.total_games = total_games;
  playerStatus.rating = Math.round(rating);
  renderTitleStatus();
}

export const matchingServerUrl = window.location.hostname === 'localhost' ?
  'https://localhost:5000' :
  'https://ssdojo.net';

// Socket.IOサーバーへの接続を開始する関数
export function connectToServer() {
  return new Promise((resolve, reject) => {
    if (socket && socket.connected) {
      console.log('Already connected to server.');
      resolve(socket);
      return;
    }

    // 再接続中の古い接続が残っていれば止める（残すと裏で再接続を続け、接続が増えていく）
    if (socket) socket.disconnect();

    //@ts-ignore
    const newSocket = io(matchingServerUrl, { withCredentials: true });
    socket = newSocket;

    newSocket.on('connect', () => {
      console.log('Socket.IO connected successfully!');
      setupSocket(); // 接続が確立したらイベントハンドラを設定
      resolve(newSocket);
    });

    // つながらなかったら再接続を止める（呼び出し側はエラー表示してタイトルへ戻るので、
    // 裏で再接続を続けて後からつながると、関係ない画面で切断アラートが出てしまう）
    newSocket.on('connect_error', (err) => {
      console.error('Socket.IO connection error:', err);
      newSocket.disconnect();
      if (socket === newSocket) socket = null;
      reject(err);
    });
  });
}

// Socket.IOサーバーから切断する関数
export function disconnectFromServer() {
  // 未接続（自動再接続中）でも disconnect() を呼んで再接続を止める
  if (socket) {
    socket.disconnect();
    console.log('Socket.IO disconnected.');
  }
  socket = null;
}

export async function getTitleInfo() {
  try {
    const response = await fetch(`/api/title-info?playerId=${player_id}`);
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    const data = await response.json();
    console.log(data);

    // サーバーから受け取った情報でステータスとランキングを更新
    if (data.player) {
      // player_idが更新された場合（新規作成時）は、localStorageにも保存
      if (player_id !== data.player.player_id) {
        player_id = data.player.player_id;
        localStorage.setItem('shogiUserId', player_id);
      }
      setStatus(data.player.rating, data.player.total_games);
    }
    if (data.ranking) {
      serverStatus.topPlayers = data.ranking;
    }
    if (data.announcement) {
      serverStatus.announcement = data.announcement;
    }

  } catch (error) {
    console.error('Failed to fetch title info:', error);
    // エラーが発生しても、とりあえずタイトル画面は表示
  }
}

export async function loadStrings() {
  for (const lang of Object.keys(LANGUAGES)) {
    // 言語データの読み込み
    try {
      const response = await fetch(`/${LANGUAGE_FOLDER}/${lang}.json`);
      if (!response.ok) {
        throw new Error(`Failed to load language file: ${response.status}`);
      }
      all_strings[lang] = await response.json();
    } catch (error) {
      console.error('Failed to load language data:', error);
      // エラー時は空オブジェクトを設定
      all_strings = {};
    }
  }
}

export function setStrings(lang) {
  if (Object.keys(LANGUAGES).includes(lang)) {
    strings = all_strings[lang];
    initTitleText();
    initGameText();
    initRoomText();
    localStorage.setItem('language', lang);
    return
  }
  console.log("no language file", lang);
  return
}
// ブラウザの言語設定を取得し、'ja' または 'en' を返す関数
export function getBrowserLanguage() {
  const languages = navigator.languages || [navigator.language];
  for (const lang of languages) {
    // 言語コードが 'ja' で始まる場合は 'ja' を返す
    if (lang.startsWith('ja')) {
      return 'ja';
    }
    // 言語コードが 'en' で始まる場合は 'en' を返す
    if (lang.startsWith('en')) {
      return 'en';
    }
    if (lang.startsWith('zh')) {
      return 'zh';
    }
    if (lang.startsWith('ko')) {
      return 'ko';
    }
  }
  return 'en';
}

// 初期化関数
async function init() {
  // 初期化済みであれば何もしない
  if (isInitialized) {
    console.warn("init関数が複数回呼び出されましたが、二重初期化を防ぎました。");
    return;
  }
  isInitialized = true;

  // localStorageから言語設定を読み込む
  let lang = localStorage.getItem('language');
  if (!lang || lang === 'jp') {
    lang = getBrowserLanguage();
  }
  await loadStrings();
  setStrings(lang);

  // キャンバスの初期化
  canvas = document.getElementById('shogiCanvas');
  //@ts-ignore
  // HTML要素の取得
  playerRatingElement = document.getElementById('playerRating');
  gamesPlayedElement = document.getElementById('gamesPlayedText');
  ctx = canvas.getContext('2d');
  keyboard = new Keyboard();
  keyboard.init(canvas);

  // ユーザーIDの読み込みまたは生成
  player_id = localStorage.getItem('shogiUserId');
  if (!player_id) {
    // プレイヤーIDがない場合は、サーバーに新規作成を要求する
    player_id = 'create';
  }

  // キャラクターの読み込みまたは選択
  loadOrSelectCharacter();

  // イベントリスナーの追加
  addEventListeners();
  resizeCanvas();

  gameManager = new GameManager();

  // タイトル画面に必要な情報をAPIから取得
  await getTitleInfo();

  // 初期化完了後にロード中テキストを非表示にする
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }

  // 最初にタイトルシーンを表示
  setScene(createTitleScene());
  resizeHTML();
  roop();
}

// 高解像度ディスプレイでぼやけないよう、描画バッファを devicePixelRatio 倍にする（負荷対策で最大2倍）
let pixelRatio = 1;

// キャンバスのリサイズ
function resizeCanvas() {
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(window.innerWidth * pixelRatio);
  canvas.height = Math.round(window.innerHeight * pixelRatio);
  // CSS の 100vh はスマホのアドレスバー分ずれるので、表示サイズも実寸で指定する
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
}

function handleResize() {
  resizeCanvas();
  // シーンのリサイズ処理を呼び出す
  if (scene && scene.resize) {
    scene.resize({ scale: 1 }); // 仮のスケール値
  }
  resizeHTML();
}

// HTML の画面部品は各シーンの onLayout（scene.resize から呼ばれる）で配置する
function resizeHTML() {
  if (!scene) return;
  scene.resize();
}

// ポインターイベント（タッチ・ペン）を既存のマウス用イベント名に変換してシーンに渡す
let activeTouchPointer = null;
// 押下（mousedown）を指を離したときに通知するか。対局中は即応性のため触れた瞬間、
// それ以外の画面ではボタンで音声・動画を再生できるよう指を離したとき（ブラウザがユーザー操作と
// みなすのはタッチでは pointerup 以降のため）に通知する
let pressOnRelease = false;

function addTouchListeners() {
  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse') return; // マウスは従来の mouse イベントで処理
    // preventDefault で互換マウスイベント（mousedown等）の二重発火を防ぐ
    event.preventDefault();
    // preventDefault するとタップしても入力欄からフォーカスが外れず、キーボードが出たままになるので自分で外す
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      active.blur();
    }
    // マルチタッチの2本目以降は無視。最初の指（isPrimary）は常に受け付けるので、
    // 前のタッチの pointerup を取りこぼしても（アラート表示中など）操作できなくなることはない
    if (!event.isPrimary) return;
    activeTouchPointer = event.pointerId;
    lastPointerIsTouch = true;
    pressOnRelease = sceneType !== 'game';
    try {
      canvas.setPointerCapture(event.pointerId); // 指が画面外に出ても move/up を受け取る
    } catch (e) {
      // 合成イベントなどでキャプチャできない場合は無視
    }
    if (!scene) return;
    // ホバー状態（押下位置のセルやボタン）を先に更新してから押下を通知する
    scene.touchCheck(event, 'mousemove');
    if (!pressOnRelease) {
      scene.touchCheck(event, 'mousedown');
    }
  });

  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'mouse' || event.pointerId !== activeTouchPointer) return;
    event.preventDefault();
    if (!scene) return;
    scene.touchCheck(event, 'mousemove');
  });

  const endTouch = (event) => {
    if (event.pointerType === 'mouse' || event.pointerId !== activeTouchPointer) return;
    event.preventDefault();
    activeTouchPointer = null;
    if (!scene) return;
    if (event.type === 'pointerup') {
      if (pressOnRelease) {
        scene.touchCheck(event, 'mousedown');
      }
      scene.touchCheck(event, 'mouseup');
    } else if (gameManager && gameManager.boardUI) {
      // タッチがキャンセルされた場合はドラッグ中の駒を元に戻す
      gameManager.boardUI.cancelDrag();
    }
    scene.releaseHover();
    if (gameManager && gameManager.boardUI) {
      gameManager.boardUI.hoveredCell = null;
    }
  };
  canvas.addEventListener('pointerup', endTouch);
  canvas.addEventListener('pointercancel', endTouch);
  // キャプチャが外れて pointerup が届かない場合も、押しっぱなしの状態を残さない
  canvas.addEventListener('lostpointercapture', (event) => {
    if (event.pointerId === activeTouchPointer) {
      activeTouchPointer = null;
    }
  });
}

// イベントリスナーを追加
function addEventListeners() {

  // ウィンドウサイズ変更時のリスナーを追加
  window.addEventListener('resize', handleResize);
  // 端末の回転直後は innerWidth/innerHeight が更新されていないことがあるので少し待って再計算する
  window.addEventListener('orientationchange', () => {
    setTimeout(handleResize, 100);
    setTimeout(handleResize, 500);
  });

  addTouchListeners();

  canvas.addEventListener('mousedown', (event) => {
    if (!scene) return;
    lastPointerIsTouch = false;
    if (event.button == 2) {
      scene.touchCheck(event, 'mousedown-right');
    } else {
      scene.touchCheck(event, 'mousedown');
    }
  });

  canvas.addEventListener('mousemove', (event) => {
    if (!scene) return;
    scene.touchCheck(event, 'mousemove');
  });

  canvas.addEventListener('mouseup', (event) => {
    if (!scene) return;
    if (event.button == 2) {
      scene.touchCheck(event, 'mouseup-right');
    } else {
      scene.touchCheck(event, 'mouseup');
    }
  });

  // 右クリックのデフォルト動作を無効にする
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  // 音量スライダーのイベントリスナーを追加
  const bgmVolumeSlider = document.getElementById('bgmVolumeSlider');
  const soundVolumeSlider = document.getElementById('soundVolumeSlider');
  const voiceVolumeSlider = document.getElementById('voiceVolumeSlider');



  // 初期表示時にスライダーの値を現在の音量に設定
  if (bgmVolumeSlider instanceof HTMLInputElement) {
    bgmVolumeSlider.value = (audioManager.bgmVolume * 100).toString();
  }

  if (soundVolumeSlider instanceof HTMLInputElement) {
    soundVolumeSlider.value = (audioManager.soundVolume * 100).toString();
  }

  // 初期表示時にスライダーの値を現在の音量に設定
  if (voiceVolumeSlider instanceof HTMLInputElement) {
    voiceVolumeSlider.value = (audioManager.voiceVolume * 100).toString();
  }

  if (bgmVolumeSlider) {
    bgmVolumeSlider.addEventListener('input', (event) => {
      if (event.target instanceof HTMLInputElement) {
        const volume = parseInt(event.target.value, 10) / 100;
        audioManager.setBGMVolume(volume);
      }
    });
  }

  if (soundVolumeSlider) {
    soundVolumeSlider.addEventListener('change', (event) => {
      if (event.target instanceof HTMLInputElement) {
        const volume = parseInt(event.target.value, 10) / 100;
        audioManager.setSoundVolume(volume);
        audioManager.playSound('sound'); // 効果音を再生
        // 初期表示時にスライダーの値を現在の音量に設定

      }
    });
  }

  if (voiceVolumeSlider) {
    voiceVolumeSlider.addEventListener('input', (event) => {
      if (event.target instanceof HTMLInputElement) {
        const volume = parseInt(event.target.value, 10) / 100;
        audioManager.setVoiceVolume(volume);

        // キャラクターのランダムボイス再生（音量設定の確認用）

        // selectedCharacterNameがnullでないことを確認
        if (selectedCharacterName) {
          const randomIndex = Math.floor(Math.random() * NUM_QUOTES);
          const randomVoiceFile = `/${CHARACTER_FOLDER}/${selectedCharacterName}/voice${randomIndex + 1}.wav`;
          audioManager.playVoice(randomVoiceFile);
        }
      }
    });
  }

  // 設定ボタンのイベントリスナーを追加
  const settingsButton = document.getElementById('settingsButton');
  const volumeOverlay = document.getElementById('volumeOverlay');

  if (settingsButton && volumeOverlay) {
    settingsButton.addEventListener('click', () => {
      if (volumeOverlay.style.display === 'none') {
        volumeOverlay.style.display = 'flex';
      } else {
        volumeOverlay.style.display = 'none';
      }
    });
  }
}

// Socket.IO イベントハンドラ設定関数
export function setupSocket() {
  // 既存のイベントハンドラを全て削除
  if (socket) {
    socket.removeAllListeners();
  }

  // 接続が確立したときの基本的なハンドラ
  socket.on('connect', () => {
    console.log('Socket connected and handlers are set up.');
    // 以前はここで sendUserId を送っていたが、requestMatch に統合されたため不要
  });

  // マッチングサーバーとの接続は、マッチング待ち・部屋の作成/参加の応答待ちの間だけ使う（タイトル画面）
  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
    if (reason !== 'io client disconnect') {
      console.error('Server initiated or network error disconnect.');
      // 待っていた要求はサーバー側で消えているので再接続はしない
      if (isMatching()) {
        // マッチング中は CPU 戦・対戦履歴の画面にいることもあるので、画面はそのままにする
        stopMatching();
        showNotice(strings['matching-disconnected'], 'error');
      } else {
        disconnectFromServer();
        if (sceneType === 'title') {
          setScene(createTitleScene());
          showNotice(strings['connect-failed'], 'error');
        }
      }
    }
  });

  // レーティングを受信 (マッチングサーバーからのイベント)
  socket.on('receiveRating', (data) => {
    setStatus(data.rating, data.total_games);
  });

  // マッチングが成立したときの処理 (マッチングサーバーからのイベント)
  socket.on('matchFound', (data) => {
    matchFound();
    disconnectFromServer();
    const gameServerAddress = data.gameServerAddress;
    //@ts-ignore
    socket = io(gameServerAddress, { withCredentials: true });
    setupGameSocketHandlers(data);
  });

  // マッチングに失敗したら接続を切る（CPU 戦・対戦履歴の画面で待っていることもあるので画面はそのまま）
  socket.on('matchFailed', () => {
    console.log("matchFailed");
    stopMatching();
    showNotice(strings['match-failed'], 'error');
  });

  // マッチングキャンセルの応答（クライアントはキャンセル時に接続を切るので、通常は届かない）
  socket.on("cancelMatch", () => {
    stopMatching();
  });

  socket.on("roomCreated", (data) => {
    disconnectFromServer();
    const gameServerAddress = data.gameServerAddress;
    //@ts-ignore
    socket = io(gameServerAddress, { withCredentials: true });
    setupGameSocketHandlers(data);
  });

  socket.on("roomFound", (data) => {
    disconnectFromServer();
    const gameServerAddress = data.gameServerAddress;
    //@ts-ignore
    socket = io(gameServerAddress, { withCredentials: true });
    setupGameSocketHandlers(data, true);
  });

  socket.on("roomJoinFailed", (data) => {
    disconnectFromServer();
    setScene(createTitleScene());
    roomJoinFailed();
  });
}

// ゲームサーバー接続後の Socket.IO イベントハンドラ設定関数
function setupGameSocketHandlers(roomFoundData, privateroom = false) {
  if (socket) {
    socket.removeAllListeners();
  }

  socket.on('connect', () => {
    if (privateroom) {
      socket.emit('joinRoom', {
        player_id: player_id,
        roomId: roomFoundData.roomId,
        name: playerName,
        characterName: selectedCharacterName
      });
    } else {
      socket.emit('joinRatingRoom', {
        player_id: player_id,
        roomId: roomFoundData.roomId,
        name: playerName,
        characterName: selectedCharacterName
      });
    }
  });

  socket.on('disconnect', (reason) => {
    console.log("disconnected:", reason);
    if (reason === 'io client disconnect') return;
    // オンライン対局中に切れた場合は、再接続しても元の対局には戻れないので接続を止めて対局を終える
    //（部屋で待っている間の切断は、自動再接続で部屋に入り直す）
    if (sceneType === 'game' && gameManager.cpu === null && !gameManager.board.finished) {
      disconnectFromServer();
      connectionLost();
    }
  });

  socket.on('startGame', (data) => {
    console.log("startGame", data);
    setScene(createPlayScene(
      data.senteName,
      data.senteRating,
      data.senteCharacter,
      data.goteName,
      data.goteRating,
      data.goteCharacter,
      data.roomId,
      data.roomType,
      data.servertime,
      data.roomteban,
      data.moveTime,
      data.pawnLimit4thRank
    ));
  });

  socket.on('startRoomGame', (data) => {
    setScene(createPlayScene(
      data.senteName,
      null,
      data.senteCharacter,
      data.goteName,
      null,
      data.goteCharacter,
      data.roomId,
      data.roomType,
      data.servertime,
      data.roomteban,
      data.moveTime,
      data.pawnLimit4thRank
    ));
  });

  socket.on('newMove', (data) => {
    if (gameManager && gameManager.boardUI) {
      gameManager.boardUI.removeReserved(data);
      gameManager.receiveMove(data);
    }
  });

  socket.on('moveFailed', (data) => {
    if (gameManager && gameManager.boardUI) {
      gameManager.boardUI.lastsend = null;
    }
  });

  socket.on('moveReserved', (data) => {
    if (gameManager && gameManager.boardUI) {
      gameManager.boardUI.lastsend = null;
      gameManager.boardUI.moveReserved(data);
    }
  });

  socket.on('reservedMoveFailed', (data) => {
    if (gameManager && gameManager.boardUI) {
      gameManager.boardUI.lastsend = null;
      gameManager.boardUI.removeSameReserved(data);
    }
  });

  socket.on('endGame', (data) => {
    if (gameManager && gameManager.boardUI) {
      gameManager.boardUI.lastsend = null;
    }
    endGame(data);
  });

  socket.on('endRoomGame', (data) => {
    if (gameManager && gameManager.boardUI) {
      gameManager.boardUI.lastsend = null;
    }
    endRoomGame(data);
  });

  socket.on("backToRoom", (data) => {
    backToRoom(data);
  });

  socket.on("roomUpdate", (data) => {
    setRoomData(data);
    if (sceneType === "room") {
      roomUpdate();
    }
  });

  socket.on("roomJoined", (data) => {
    setScene(createRoomScene(data));
  });

  // 部屋に入れなかった（部屋IDの間違い、またはアプリ切替などで切断→自動再接続したときに部屋が消えていた）
  // ゲームサーバーとの接続は切ってタイトルへ戻る（残すと再接続のたびに入室を試みてタイトルを作り直してしまう）
  socket.on("roomJoinFailed", async (data) => {
    disconnectFromServer();
    await getTitleInfo();
    setScene(createTitleScene());
    roomJoinFailed();
  });
}


// 画像の読み込み
const pieceTypes = ['pawn', 'lance', 'knight', 'silver', 'gold', 'king', 'king2', 'rook', 'bishop',
  'prom_pawn', 'prom_lance', 'prom_knight', 'prom_silver', 'horse', 'dragon'];

// 駒画像読み込みのPromiseを作成
const pieceImagePromises = pieceTypes.map(type =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.src = `/pieces/${type}.png`;
    img.onload = () => {
      pieceImages[type] = img;
      resolve();
    };
    img.onerror = () => {
      console.error(`Failed to load image: ${type}.png`);
      reject(new Error(`Failed to load image: ${type}.png`));
    };
  })
);

// キャラクター画像読み込みのPromiseを作成
const characterImagePromises = characterFiles.map(file =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.src = `/${CHARACTER_FOLDER}/${file}/image.png`;
    img.onload = () => {
      const name = file;
      characterImages[name] = img;
      resolve();
    };
    img.onerror = () => {
      console.error(`Failed to load image: /${CHARACTER_FOLDER}/${file}/image.png`);
      resolve();
    };
    const img_face = new Image();
    img_face.src = `/${CHARACTER_FOLDER}/${file}/image_face.png`;
    img_face.onload = () => {
      const name = file;
      characterImages[name + '_face'] = img_face;
      resolve();
    };
    img_face.onerror = () => {
      console.error(`Failed to load image: /${CHARACTER_FOLDER}/${file}/image_face.png`);
      resolve();
    };
  })
);


function roop() {
  if (gameManager) {
    gameManager.update();
  }
  // 以降の描画はCSSピクセル単位で行い、高解像度の拡大はここでまとめて適用する
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  beginHtmlFrame();
  scene.draw(ctx);
  endHtmlFrame();
  requestAnimationFrame(roop);
}

// 全ての画像読み込みが完了したら初期化処理を実行
Promise.all([...pieceImagePromises, ...characterImagePromises])
  .then(() => {
    init(); // 画像読み込み完了後にinitを呼び出す
  })
  .catch(error => {
    console.error("画像の読み込み中にエラーが発生しました:", error);
  });
