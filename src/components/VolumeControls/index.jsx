import styles from "./style.module.css";
import { FaVolumeHigh } from "react-icons/fa6";
import { FaVolumeMute } from "react-icons/fa";
import { usePlayerStore } from "../../store/playerStore";
import { useState } from "react";

export function VolumeControls() {
  const volume = usePlayerStore((state) => state.volume);
  const setVolume = usePlayerStore((state) => state.setVolume);
  
  // Guarda o último volume antes de mutar
  const [lastVolume, setLastVolume] = useState(1);

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    // Se o usuário move o slider, atualiza o lastVolume também (para que o mute não restaure um volume antigo)
    if (newVolume > 0) {
      setLastVolume(newVolume);
    }
  };

  const toggleMute = () => {
    if (volume > 0) {
      // Silencia: guarda o volume atual e depois zera
      setLastVolume(volume);
      setVolume(0);
    } else {
      // Restaura o último volume (se for 0, restaura 1)
      setVolume(lastVolume > 0 ? lastVolume : 1);
    }
  };

  const percent = volume * 100; // 0 a 100

  return (
    <div className={styles.volume}>
      <div className={styles.sliderContainer}>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={handleVolumeChange}
          className={styles.slider}
          style={{ '--percent': `${percent}%` }}
        />
      </div>
      <div onClick={toggleMute} className={styles.iconWrapper}>
        {volume === 0 ? <FaVolumeMute className={styles.icon} /> : <FaVolumeHigh className={styles.icon} />}
      </div>
    </div>
  );
}