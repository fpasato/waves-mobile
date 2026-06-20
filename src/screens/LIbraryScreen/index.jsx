import { useState, useEffect, useCallback } from "react";
import { usePlayerStore } from "../../store/playerStore";
import { Header } from "../../components/Header";
import { Button } from "../../components/Button";
import styles from "./style.module.css";
import { FaPlay } from "react-icons/fa";
import { MdOutlineAddToPhotos } from "react-icons/md";

export function LibraryScreen({ setScreen }) {
  const {
    library,
    playSong,
    addToQueue,
    setQueue,
    reloadLibraryFromDatabase, // carrega apenas do banco (leve)
  } = usePlayerStore();

  const [isLoading, setIsLoading] = useState(false);

  // Carrega do banco apenas se a biblioteca estiver vazia (primeira vez)
  useEffect(() => {
    if (library.length === 0) {
      setIsLoading(true);
      reloadLibraryFromDatabase()
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, []); // executa apenas na montagem

  // Cálculos derivados
  const totalSeconds = library.reduce(
    (acc, song) => acc + (song.duration || 0),
    0
  );

  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds) || seconds <= 0) return "0:00";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) return `${hours}h ${minutes}min`;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className={styles.screenContainer}>
      <Header title="Biblioteca" />

      {isLoading ? (
        <div className={styles.loadingContainer}>
          <p>Carregando biblioteca...</p>
        </div>
      ) : (
        <>
          <div className={styles.statsBar}>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <h2>Total de Músicas:</h2>
                <p>{library.length}</p>
              </div>
              <div className={styles.statCard}>
                <h2>Duração total:</h2>
                <p>{formatDuration(totalSeconds)}</p>
              </div>
            </div>

            <div className={styles.headerActions}>
              <Button
                title="Tocar Todas"
                onClick={() => {
                  if (library.length === 0) return;
                  setQueue(library);
                  setScreen("player");
                }}
              />
              <Button
                title="Voltar"
                className={styles.backButton}
                onClick={() => setScreen("player")}
              />
            </div>
          </div>

          <div className={styles.listContainer}>
            <ul className={styles.songList}>
              {library.length > 0 ? (
                library.map((song, index) => (
                  <li key={song.id ?? index} className={styles.songItem}>
                    <h3>{song.title}</h3>
                    <div className={styles.songActions}>
                      <Button
                        title={<FaPlay />}
                        onClick={() => {
                          addToQueue(song);
                          playSong(song, [song]);
                          setScreen("player");
                        }}
                      />
                      <Button
                        title={<MdOutlineAddToPhotos />}
                        onClick={() => addToQueue(song)}
                      />
                    </div>
                  </li>
                ))
              ) : (
                <li className={styles.emptyState}>
                  <h3>Nenhuma música encontrada</h3>
                </li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}