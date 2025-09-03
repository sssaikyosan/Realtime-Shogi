import { Keyboard } from "./keyboard.js";
import { GameManager } from "./game_manager.js";
import { Board } from './board.js';
import { AudioManager } from "./audio_manager.js"; // audio_manager.jsからインポート
import { clearTitleHTML, createTitleScene, initTitleText, nameInput, playCountText, ratingText, roomIdInput, roomJoinFailed, updateRanking } from "./scene_title.js";
import { createPlayScene, backToRoom, endGame, endRoomGame, initGameText } from "./scene_game.js";
import { createRoomScene, initRoomText, setRoomData, roomUpdate, roomdata } from "./scene_room.js";
import { CHARACTER_FOLDER, LANGUAGE_FOLDER, LANGUAGES, MOVETIME, NUM_QUOTES } from "./const.js";

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
title_img.src = '/images/title.png';

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
  playCountText.text = () => {
    return `${strings['game-count']}:${total_games}`
  }
  if (total_games >= 10) {
    ratingText.text = () => {
      return `${strings['rating']}:${Math.round(rating)}`
    }
  } else {
    ratingText.text = () => {
      return `${strings['rating']}: ${strings['unrated']}`
    }
  }
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

    //@ts-ignore
    socket = io(matchingServerUrl, { withCredentials: true });

    socket.on('connect', () => {
      console.log('Socket.IO connected successfully!');
      setupSocket(); // 接続が確立したらイベントハンドラを設定
      resolve(socket);
    });

    socket.on('connect_error', (err) => {
      console.error('Socket.IO connection error:', err);
      reject(err);
    });
  });
}

// Socket.IOサーバーから切断する関数
export function disconnectFromServer() {
  if (socket && socket.connected) {
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

// キャンバスのリサイズ
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function resizeHTML() {
  let target = 0;
  let offsetX = 0;
  let offsetY = 0;
  if (window.innerHeight > window.innerWidth * scene.aspect) {
    target = window.innerWidth * scene.aspect;
    offsetY = (window.innerHeight - target) / 2;
  } else {
    target = window.innerHeight;
    offsetX = (window.innerWidth - window.innerHeight / scene.aspect) / 2;
  }

  nameInput.style = `display: ${nameInput.style.display}; font-size:${(Math.floor(target * 0.03)).toString()}px; padding: 6px; position: absolute; left: ${(target * 0.5 * 16 / 9 + offsetX).toString()}px; bottom: ${(target * 0.05 + offsetY).toString()}px; width:${(target * 0.35).toString()}px; height: ${(target * 0.04).toString()}px; transform: translate(-50%, 0%);`;
  roomIdInput.style = `display: ${roomIdInput.style.display}; font-size:${(Math.floor(target * 0.025)).toString()}px; padding: 6px; position: absolute; right: ${(target * 0.26 * 16 / 9 + offsetX).toString()}px; bottom: ${(target * 0.18 + offsetY).toString()}px; width:${(target * 0.12).toString()}px; height: ${(target * 0.03).toString()}px; transform: translate(100%, 0%);`;
}

// イベントリスナーを追加
function addEventListeners() {

  // ウィンドウサイズ変更時のリスナーを追加
  window.addEventListener('resize', () => {
    resizeCanvas();
    // シーンのリサイズ処理を呼び出す
    if (scene && scene.resize) {
      scene.resize({ scale: 1 }); // 仮のスケール値
    }
    resizeHTML();
  });

  canvas.addEventListener('mousedown', (event) => {
    if (!scene) return;
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

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
    if (reason !== 'io client disconnect') {
      console.error('Server initiated or network error disconnect.');
      setScene(createTitleScene());
      alert('サーバーとの接続が切れました。タイトルに戻ります。');
    }
  });

  // レーティングを受信 (マッチングサーバーからのイベント)
  socket.on('receiveRating', (data) => {
    setStatus(data.rating, data.total_games);
  });

  // マッチングが成立したときの処理 (マッチングサーバーからのイベント)
  socket.on('matchFound', (data) => {
    disconnectFromServer();
    const gameServerAddress = data.gameServerAddress;
    //@ts-ignore
    socket = io(gameServerAddress, { withCredentials: true });
    setupGameSocketHandlers(data);
  });

  socket.on('matchFailed', () => {
    console.log("matchFailed");
    setScene(createTitleScene());
  });

  // マッチングキャンセル (マッチングサーバーからのイベント)
  socket.on("cancelMatch", () => {
    setScene(createTitleScene());
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
    console.log("disconected");
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

  socket.on("roomJoinFailed", (data) => {
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
  scene.draw(ctx);
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
