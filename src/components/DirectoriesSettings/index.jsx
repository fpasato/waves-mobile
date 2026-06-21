import { useState, useRef } from "react";
import { usePlayerStore } from "../../store/playerStore";
import { useSongs } from "../../hooks/useDatabase";
import {
  scanAllMusic,
  mapTracksForDb,
  requestStoragePermission,
  startBackgroundEnrichment,
} from "../../lib/syncLibrary";
import { api } from "../../database/database";
import { Button } from "../Button";
import styles from "./style.module.css";

export function DirectoriesSettings() {
  const { reloadLibraryFromDatabase } = usePlayerStore();
  const { upsertManySongs } = useSongs();

  const [status, setStatus] = useState("");
  const [scanning, setScanning] = useState(false);
  const [minDuration, setMinDuration] = useState(10);

  // Guarda o controlador para cancelar o scan/enriquecimento se necessário
  const abortRef = useRef(null);

  async function handleClearSongs() {
    await api.db.songs.resetSongsTable();
    await reloadLibraryFromDatabase();
    setStatus("Músicas removidas!");
  }

  async function handleScanDevice() {
    if (scanning) return;

    // Cancela qualquer scan/enriquecimento anterior
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;
    const signal = controller.signal;

    setScanning(true);
    setStatus("Solicitando permissão...");

    try {
      // 1. Permissão
      const granted = await requestStoragePermission();
      if (signal.aborted) return;
      if (!granted) {
        setStatus("Permissão de armazenamento negada");
        return;
      }

      // 2. Scan dos arquivos (MediaStore Nativo)
      setStatus("Escaneando dispositivo...");
      const tracks = await scanAllMusic();
      if (signal.aborted) return;

      if (tracks.length === 0) {
        setStatus("Nenhuma música encontrada. Verifique as permissões do app.");
        return;
      }

      const filteredTracks = tracks.filter((track) => {
        if (minDuration > 0 && track.duration > 0 && track.duration < minDuration) {
          return false;
        }
        return true;
      });

      // 3. Salvar no banco
      setStatus(`Salvando ${filteredTracks.length} músicas...`);
      await upsertManySongs(mapTracksForDb(filteredTracks, null));
      await reloadLibraryFromDatabase();
      setStatus(`${filteredTracks.length} músicas encontradas. Enriquecendo...`);

      // handleScanDevice - substitui os passos 4 e 5

      setStatus(`${tracks.length} músicas encontradas. Enriquecendo...`);

      let enriched = 0;
      await startBackgroundEnrichment(async (track) => {
        enriched++;
        setStatus(`Enriquecendo... ${enriched}/${tracks.length}`);

        // Filtra individualmente logo após enriquecer
        if (
          minDuration > 0 &&
          track.duration > 0 &&
          track.duration < minDuration
        ) {
          await api.db.songs.delete(track.id);
        }
      }, signal);

      if (signal.aborted) return;

      // 6. Recarrega biblioteca final (sem deleteByDurationBelow aqui)
      await reloadLibraryFromDatabase();
      const final = usePlayerStore.getState().library;
      setStatus(`Finalizadas: ${final.length} músicas`);

    } catch (err) {
      if (err.name === "AbortError" || signal.aborted) {
        setStatus("Operação cancelada.");
      } else {
        console.error(err);
        setStatus("Erro nativo: " + (err.message || err));
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setScanning(false);
    }
  }

  return (
    <div className={styles.DirectoriesContainer}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h2>Biblioteca de Música</h2>
          <p>
            Escaneie o dispositivo para encontrar automaticamente todas as
            músicas.
          </p>
        </div>

        {status && <div className={styles.status}>{status}</div>}
        
        <div className={styles.scanSettingsSection}>
          <div className={styles.optionTitle}>
            <strong>Duração mínima do áudio</strong>
            <span>Arquivos abaixo desse tempo serão ignorados</span>
          </div>

          <div className={styles.radioGroup}>
            {[0, 1, 5, 10, 30, 60].map((value) => (
              <label key={value} className={styles.radioOption}>
                <input
                  type="radio"
                  name="minDuration"
                  value={value}
                  checked={minDuration === value}
                  onChange={() => setMinDuration(value)}
                />
                <span>{value === 0 ? "Sem filtro" : `${value}s`}</span>
              </label>
            ))}
          </div>
        </div>

        <div className={styles.actions}>
          <Button
            title={scanning ? "Escaneando..." : "Escanear dispositivo (v2)"}
            onClick={handleScanDevice}
            disabled={scanning}
          />

          <Button
            title="🗑️ Limpar banco (temp)"
            onClick={handleClearSongs}
            className={styles.dangerButton}
          />
        </div>

      </div>
    </div>
  );
}
