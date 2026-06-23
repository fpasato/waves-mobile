import { useState, useEffect } from "react";
import { usePlayerStore } from "../../store/playerStore";
import { Header } from "../../components/Header";
import { Button } from "../../components/Button";
import styles from "./style.module.css";
import { MdOutlineAddToPhotos } from "react-icons/md";

export function LibraryScreen({ setScreen }) {
  const {
    library,
    playSong,
    addToQueue,
    setQueue,
    reloadLibraryFromDatabase,
  } = usePlayerStore();

  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (library.length === 0) {
      setIsLoading(true);
      reloadLibraryFromDatabase()
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, []);

  const filteredLibrary = library.filter((song) =>
    song.title?.toLowerCase().includes(search.toLowerCase())
  );

  const totalSeconds = filteredLibrary.reduce(
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

  // Ação de tocar uma música específica
  const handlePlaySong = (song) => {
    addToQueue(song);
    playSong(song, [song]);
    setScreen("player");
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
                <p>{filteredLibrary.length}</p>
              </div>
              <div className={styles.statCard}>
                <h2>Duração total:</h2>
                <p>{formatDuration(totalSeconds)}</p>
              </div>
            </div>

            <input
              className={styles.searchInput}
              type="text"
              placeholder="Buscar por título..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className={styles.headerActions}>
              <Button
                title="Tocar Todas"
                onClick={() => {
                  if (filteredLibrary.length === 0) return;
                  setQueue(filteredLibrary);
                  setScreen("player");
                }}
              />
            </div>
          </div>

          <div className={styles.listContainer}>
            <ul className={styles.songList}>
              {filteredLibrary.length > 0 ? (
                filteredLibrary.map((song, index) => (
                  <li key={song.id ?? index} className={styles.songItem}>
                    {/* Card clicável para tocar a música */}
                    <button
                      className={styles.songPlayButton}
                      onClick={() => handlePlaySong(song)}
                    >
                      <h3>{song.title}</h3>
                    </button>

                    {/* Botão de adicionar à fila (não dispara o play) */}
                    <div className={styles.songActions}>
                      <Button
                        title={<MdOutlineAddToPhotos />}
                        onClick={(e) => {
                          e.stopPropagation();
                          addToQueue(song);
                        }}
                      />
                    </div>
                  </li>
                ))
              ) : (
                <li className={styles.emptyState}>
                  <h3>
                    {search
                      ? "Nenhum resultado para sua busca"
                      : "Nenhuma música encontrada"}
                  </h3>
                </li>
              )}
            </ul>
          </div>
        </>
      )}

      {/* Botão Voltar fixo */}
      <div className={styles.backButtonWrapper}>
        <button
          onClick={() => setScreen("player")}
          className={styles.backButton}
        >
          Voltar
        </button>
      </div>
    </div>
  );
}