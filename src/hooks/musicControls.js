import { CapacitorMusicControls } from 'capacitor-music-controls-plugin';
import { usePlayerStore } from '../store/playerStore';

let handlersRegistered = false;
let lastSongId = null;
let listenerHandle = null;
let lastControlActionTime = 0; // timestamp do último comando de controle

// ------------------------------------------------------------------
// Deve ser chamada UMA VEZ na inicialização do app
// ------------------------------------------------------------------
export async function setupMusicControlsListeners() {
  if (handlersRegistered) return;

  // Remove listener antigo (se existir) para evitar duplicação
  if (listenerHandle) {
    listenerHandle.remove();
    listenerHandle = null;
  }

  listenerHandle = await CapacitorMusicControls.addListener(
    'controlsNotification',
    (info) => {
      console.log('🎵 LISTENER JS:', info.message);
      const now = Date.now();

      // Ignora comandos muito rápidos (menos de 600ms entre eles)
      if (now - lastControlActionTime < 600) {
        console.log('🎵 Comando ignorado (debounce)');
        return;
      }
      lastControlActionTime = now;

      const store = usePlayerStore.getState();
      switch (info.message) {
        case 'music-controls-next':      store.nextSong();        break;
        case 'music-controls-previous':  store.previousSong();    break;
        case 'music-controls-play':      store.setPlaying(true);  break;
        case 'music-controls-pause':     store.setPlaying(false); break;
        case 'music-controls-destroy':   destroyMusicControls();  break;
      }
    }
  );

  handlersRegistered = true;
  console.log('🎵 Listener registrado');
}

// ------------------------------------------------------------------
// Atualiza o progresso na notificação (corrigido!)
// ------------------------------------------------------------------
export async function updateMusicControlsElapsed(elapsed) {
  if (!lastSongId) return;
  try {
    const { isPlaying } = usePlayerStore.getState();
    await CapacitorMusicControls.updateElapsed({ elapsed, isPlaying });
  } catch (err) {
    console.error('MusicControls updateElapsed error:', err);
  }
}

// ------------------------------------------------------------------
// Cria/atualiza os controles nativos
// ------------------------------------------------------------------
export async function updateMusicControls(song, isPlaying, elapsed) {
  await setupMusicControlsListeners();

  if (!song) {
    if (lastSongId) {
      try {
        await CapacitorMusicControls.updateIsPlaying({ isPlaying });
      } catch (_) {}
    }
    return;
  }

  try {
    const songChanged = song.id !== lastSongId;

    if (songChanged) {
      await CapacitorMusicControls.create({
        track: song.title || 'Desconhecido',
        artist: song.artist || 'Artista desconhecido',
        album: song.album || '',
        cover: song.artwork || 'www/assets/images/bg5.png',
        isPlaying,
        dismissable: false,
        hasPrev: true,
        hasNext: true,
        hasClose: false,
        notificationIcon: 'ic_media_play',
        duration: song.duration || 0,
        elapsed: elapsed || 0,
        hasSkipForward: false,
        hasSkipBackward: false,
      });

      lastSongId = song.id;
    } else {
      await CapacitorMusicControls.updateIsPlaying({ isPlaying });
    }
  } catch (err) {
    console.error('MusicControls error:', err);
  }
}

// ------------------------------------------------------------------
// Destroi os controles
// ------------------------------------------------------------------
export async function destroyMusicControls() {
  try {
    await CapacitorMusicControls.destroy();
    listenerHandle?.remove();
  } catch (_) {}
  handlersRegistered = false;
  lastSongId = null;
  listenerHandle = null;
}

export function isMusicControlsSuppressed() {
  return false;
}