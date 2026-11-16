export const PRIVATE_DEBUG_STORAGE_KEY = 'ciel_private_debug_session';

export function buildPrivateDebugUrl(roomCode = '') {
  const cleanRoom =
    String(roomCode || '').trim() && String(roomCode || '').toLowerCase().startsWith('priv-debug')
      ? String(roomCode).trim().toLowerCase()
      : `priv-debug-${Math.random().toString(36).slice(2, 8)}`;
  return `/?debug=1&room=${encodeURIComponent(cleanRoom)}`;
}

export async function requestPrivateDebugSession(apiFetch) {
  const fallbackRoom = `priv-debug-${Math.random().toString(36).slice(2, 8)}`;
  if (typeof apiFetch === 'function') {
    try {
      const data = await apiFetch('/api/admin/debug-session', {
        method: 'POST',
        body: JSON.stringify({})
      });
      if (data?.ok && data.room) {
        return {
          ok: true,
          isolated: true,
          room: data.room,
          debugUrl: data.debugUrl || buildPrivateDebugUrl(data.room),
          badge: data.badge || '🛠️ SERVEUR PRIVÉ DEBUG'
        };
      }
    } catch {
      return {
        ok: true,
        isolated: true,
        room: fallbackRoom,
        debugUrl: buildPrivateDebugUrl(fallbackRoom),
        badge: '🛠️ SERVEUR PRIVÉ DEBUG'
      };
    }
  }
  return {
    ok: true,
    isolated: true,
    room: fallbackRoom,
    debugUrl: buildPrivateDebugUrl(fallbackRoom),
    badge: '🛠️ SERVEUR PRIVÉ DEBUG'
  };
}
