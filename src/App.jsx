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
  setupMusicControlsListeners,
  updateMusicControls,
} from "./hooks/musicControls";

import { syncNewFilesFromDisk } from "./lib/syncLibrary";

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

  // Reregistra MusicControls ao retomar o app
  useEffect(() => {
    const appStateListener = CapacitorApp.addListener(
      "appStateChange",
      ({ isActive }) => {
        if (isActive) {
          console.log("📱 App retomado — reregistrando MusicControls listeners");
          setupMusicControlsListeners();
          const st = usePlayerStore.getState();
          if (st.currentSong) {
            updateMusicControls(st.currentSong, st.isPlaying, st.currentTime);
          }
        }
      },
    );
    return () => appStateListener.remove();
  }, []);

  // Inicialização
  useEffect(() => {
    let cancelled = false;
    const store = usePlayerStore.getState();

    // 1. Biblioteca do banco — sempre, é rápido (sem I/O de disco)
    store.reloadLibraryFromDatabase().catch((err) => {
      if (!cancelled) console.error("Erro ao carregar biblioteca:", err);
    });

    // 2. Configurações de playback
    store.loadPlaybackSettings().catch(() => {});

    // 3. Scan de disco — só roda se passou mais de SYNC_INTERVAL_MS
    //    desde o último scan. Assim não escaneia a cada abertura do app.
    if (shouldSync()) {
      console.log("🔍 Iniciando sincronização de novos arquivos...");
      syncNewFilesFromDisk()
        .then(() => {
          markSynced();
          if (!cancelled) store.reloadLibraryFromDatabase();
        })
        .catch((err) => {
          if (!cancelled) console.error("Erro na sincronização:", err);
        });
    } else {
      console.log("⏭️ Scan ignorado — biblioteca sincronizada recentemente.");
    }

    return () => {
      cancelled = true;
    };
  }, []);

  useAudio();

  return (
    <div className={theme}>
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