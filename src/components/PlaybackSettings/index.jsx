import { useState } from "react";
import styles from "./style.module.css";
import { usePlayerStore } from "../../store/playerStore";
import { useSettings } from "../../hooks/useDatabase";
import { Button } from "../Button";

export function PlaybackSettings() {
  const { fadeEnabled, setFadeEnabled, fadeDuration, setFadeDuration } =
    usePlayerStore();

  const { set: setSetting } = useSettings();
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    try {
      await setSetting("fadeEnabled", String(fadeEnabled));
      await setSetting("fadeDuration", String(fadeDuration));
      setSaved(true);
      console.log("[PlaybackSettings] Settings saved");
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    }
  }

  // Calcula a porcentagem de preenchimento (min=1, max=10)
  const percent = ((fadeDuration - 1) / 9) * 100;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Crossfade</h2>
        <p>Transição entre músicas.</p>
      </div>

      <div className={styles.option}>
        <label className={styles.toggleLabel}>
          <span>Fade entre músicas</span>
          <input
            type="checkbox"
            checked={fadeEnabled}
            onChange={(e) => setFadeEnabled(e.target.checked)}
          />
          <span className={styles.toggleSwitch} />
        </label>

        <p className={styles.description}>
          A próxima música começa antes da atual terminar <br />
          criando uma transição suave entre as faixas.
        </p>
      </div>

      <div
        className={`${styles.option} ${!fadeEnabled ? styles.disabled : ""}`}
      >
        <label>
          Duração do fade: <strong>{fadeDuration.toFixed(1)}s</strong>
        </label>

        <div className={styles.sliderWrapper} data-swipe-ignore="true">
          <input
            type="range"
            min="1"
            max="10"
            step="0.1"
            value={fadeDuration}
            disabled={!fadeEnabled}
            onChange={(e) => setFadeDuration(Number(e.target.value))}
            className={styles.slider}
            style={{ '--slider-fill': `${percent}%` }}
          />

          <div className={styles.ticks}>
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i}>{i + 1}s</span>
            ))}
          </div>
        </div>

        <div className={styles.rangeLabels}>
          <div>
            <span>Rápido</span>
            <small>1s - 3s</small>
          </div>

          <div>
            <span>Ideal</span>
            <small>3s - 6s</small>
          </div>

          <div>
            <span>Longo</span>
            <small>6s - 10s</small>
          </div>
        </div>
      </div>

      <Button
        title={saved ? "Salvo!" : "Salvar"}
        onClick={handleSave}
        className={styles.saveButton}
      />
    </div>
  );
}