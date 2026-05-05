// Game-level reducer fragments. END_GAME freezes the room (gameOver=true).

export function endGame(state) {
  return { ...state, gameOver: true };
}

export function resumeGame(state) {
  return { ...state, gameOver: false };
}

export function setLocalPlayer(state, action) {
  return { ...state, localPlayer: action.player || null };
}

export function setRoomId(state, action) {
  return { ...state, roomId: action.roomId || null };
}
