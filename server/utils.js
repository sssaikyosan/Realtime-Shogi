// 部屋IDに使う文字: 大文字と数字のみ。見間違えやすい I・O・0・1 は使わない（32種類×6文字）
const ROOM_ID_CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRandomString() {
  const characters = ROOM_ID_CHARACTERS;
  let result = '';
  const charactersLength = characters.length;
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

// 入力された部屋IDを照合用の形にそろえる（前後の空白を除き大文字に。小文字で入力しても同じ部屋に入れる）
export function normalizeRoomId(roomId) {
  return String(roomId).trim().toUpperCase();
}
