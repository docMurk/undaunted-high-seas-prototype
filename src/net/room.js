// Room ID parsing, clientId management, and the ?room= URL helpers.

const CLIENT_ID_KEY = 'highSeas:clientId';

export function getClientId() {
  if (typeof localStorage === 'undefined') return 'local';
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = `c_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

export function getRoomIdFromURL() {
  if (typeof location === 'undefined') return null;
  const u = new URL(location.href);
  return u.searchParams.get('room');
}

export function makeRoomId() {
  // human-readable: 6 lowercase alnum
  const alpha = 'abcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += alpha[Math.floor(Math.random() * alpha.length)];
  return out;
}

export function setRoomURL(roomId) {
  if (typeof location === 'undefined') return;
  const u = new URL(location.href);
  if (roomId) u.searchParams.set('room', roomId);
  else u.searchParams.delete('room');
  history.replaceState(null, '', u.toString());
}

export function buildRoomShareLink(roomId) {
  if (typeof location === 'undefined') return '';
  const u = new URL(location.href);
  u.searchParams.set('room', roomId);
  return u.toString();
}
