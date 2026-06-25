import { useState, useEffect } from "react";
import { useSwipeNavigation } from "./hooks/useSwipeNavigation";
import { PlayerProvider } from "./store/PlayerContext";
import { PlayerScreen } from "./screens/PlayerScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { LibraryScreen } from "./screens/LibraryScreen";
import { PlaylistScreen } from "./screens/PlaylistScreen";
import { RadioScreen } from "./screens/RadioScreen";
import { RecentScreen } from "./screens/RecentsScreen";
import { useAudio } from "./hooks/useAudio";
import { usePlayerStore } from "./store/playerStore";
import { useTheme } from "./hooks/useTheme";
import { App as CapacitorApp } from "@capacitor/app";
import {
  syncNewFilesFromDisk,
  requestStoragePermission,
  requestNotificationPermission,
} from "./lib/syncLibrary";
import {
  setupMusicControlsListeners,
  updateMusicControls,
} from "./hooks/musicControls";

// ─── Throttle do scan ────────────────────────────────────────────────────────

/** Intervalo mínimo entre scans. Padrão: 30 minutos. */
const SYNC_INTERVAL_MS = 30 * 60 * 1000;
const SYNC_TIMESTAMP_KEY = "last_sync_timestamp";

function shouldSync() {
  const value = localStorage.getItem(SYNC_TIMESTAMP_KEY);
  if (!value) return true;
  return Date.now() - parseInt(value, 10) > SYNC_INTERVAL_MS;
}

function markSynced() {
  localStorage.setItem(SYNC_TIMESTAMP_KEY, String(Date.now()));
}

// ─── Inicialização ───────────────────────────────────────────────────────────

async function requestAllPermissions() {
  const audioGranted = await requestStoragePermission();
  if (!audioGranted) {
    console.warn("⚠️ Permissão de áudio negada");
  }

  const notifGranted = await requestNotificationPermission();
  if (!notifGranted) {
    console.warn("⚠️ Permissão de notificação negada");
  }

  return audioGranted;
}

function loadLibraryAndSettings(store, cancelledRef) {
  store.reloadLibraryFromDatabase().catch((err) => {
    if (!cancelledRef.current)
      console.error("Erro ao carregar biblioteca:", err);
  });

  store.loadPlaybackSettings().catch(() => {});
}

function runDiskSync(store, cancelledRef) {
  if (!shouldSync()) return;

  let reloadTimer = null;
  const debouncedReload = () => {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      if (!cancelledRef.current) store.reloadLibraryFromDatabase();
    }, 3000);
  };

  syncNewFilesFromDisk(debouncedReload)
    .then(() => {
      markSynced();
      if (!cancelledRef.current) store.reloadLibraryFromDatabase();
    })
    .catch((err) => {
      if (!cancelledRef.current) console.error("Erro na sincronização:", err);
    });
}

// ─── App ─────────────────────────────────────────────────────────────────────

function PlayerApp() {
  const [screen, setScreen] = useState("player");
  const [theme, setTheme] = useState("dark");
  useTheme();

  const goBack = () => {
    const store = usePlayerStore.getState();

    if (store.isSheetOpen) {
      store.setSheetOpen(false);
      return;
    }
    if (screen === "playlists") {
      if (store.isPlaylistDetailOpen) {
        store.setPlaylistDetailOpen(false);
        return;
      }
      setScreen("player");
      return;
    }
    if (screen === "player") {
      CapacitorApp.minimizeApp();
      return;
    }
    if (screen === "library") setScreen("player");
    else if (screen === "settings") setScreen("player");
  };

  useSwipeNavigation(goBack, 80);

  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playerType = usePlayerStore((s) => s.playerType);
  const currentRadio = usePlayerStore((s) => s.currentRadio);
  const radioPlaying = usePlayerStore((s) => s.radioPlaying);
  const duration = usePlayerStore((s) => s.duration);

  // Atualiza os controles nativos quando a música, rádio ou estado de play/pause muda
  useEffect(() => {
    if (playerType === "music" && currentSong) {
      const { currentTime } = usePlayerStore.getState();
      updateMusicControls(currentSong, isPlaying, currentTime);
    } else if (playerType === "radio" && currentRadio) {
      updateMusicControls(
        {
          id: currentRadio.id,
          title: currentRadio.name,
          artist: "Rádio ao vivo",
          isRadio: true,
          artwork: currentRadio.favicon || "",
        },
        radioPlaying,
        0,
      );
    }
  }, [
    currentSong,
    isPlaying,
    playerType,
    currentRadio,
    radioPlaying,
    duration,
  ]);

  // Reregistra MusicControls ao retomar o app
  useEffect(() => {
    const appStateListener = CapacitorApp.addListener(
      "appStateChange",
      ({ isActive }) => {
        if (!isActive) return;

        console.log("📱 App retomado — reregistrando MusicControls listeners");
        setupMusicControlsListeners();

        const st = usePlayerStore.getState();
        if (st.currentSong) {
          updateMusicControls(st.currentSong, st.isPlaying, st.currentTime);
        }
      },
    );
    return () => appStateListener.remove();
  }, []);

  // Inicialização do app
  useEffect(() => {
    const cancelledRef = { current: false };
    const store = usePlayerStore.getState();

    async function init() {
      const audioGranted = await requestAllPermissions();
      if (!audioGranted) return;

      loadLibraryAndSettings(store, cancelledRef);
      runDiskSync(store, cancelledRef);
    }

    init();

    return () => {
      cancelledRef.current = true;
    };
  }, []);

  useAudio();

  return (
    <div
      className={theme}
      style={{ width: "100vw", height: "100dvh", overflow: "hidden" }}
    >
      {screen === "player" && <PlayerScreen setScreen={setScreen} />}
      {screen === "settings" && <SettingsScreen setScreen={setScreen} />}
      {screen === "library" && <LibraryScreen setScreen={setScreen} />}
      {screen === "playlists" && <PlaylistScreen setScreen={setScreen} />}
      {screen === "radio" && <RadioScreen setScreen={setScreen} />}
      {screen === "recents" && <RecentScreen setScreen={setScreen} />}
    </div>
  );
}

function App() {
  return (
    <PlayerProvider>
      <PlayerApp />
    </PlayerProvider>
  );
}

export default App;
