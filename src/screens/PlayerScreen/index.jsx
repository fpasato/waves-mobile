// PlayerScreen/index.jsx
import styles from "./style.module.css";

import { Header } from "../../components/Header";
import { TopBar } from "../../components/TopBar";
import { PlayerControls } from "../../components/PlayerControls";
import { ProgressBar } from "../../components/ProgressBar";
import { usePlayerStore } from "../../store/playerStore";
import { useAnalyser } from "../../hooks/useAnalyser";
import { SongQueueStack } from "../../components/SongImages";

export function PlayerScreen({ setScreen }) {
  useAnalyser();
  const { currentSong } = usePlayerStore();

  console.log(
    "🖥️ [PlayerScreen] re-renderizou, currentSong:",
    currentSong?.title,
  );

  return (
    <div className={styles.playerScreen}>
      <Header title="Vibe" />
      <div className={styles.content}>
        <TopBar setScreen={setScreen} />
      </div>
      <SongQueueStack />
      <div className={styles.playerArea}>
        <ProgressBar />
        <PlayerControls />
      </div>
    </div>
  );
}
