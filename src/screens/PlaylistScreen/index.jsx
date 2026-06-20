import { useState, useCallback, useEffect, useMemo } from "react";
import { usePlaylists, useSongs } from "../../hooks/useDatabase";
import { usePlayerStore } from "../../store/playerStore";
import { Header } from "../../components/Header";
import { Button } from "../../components/Button";
import styles from "./style.module.css";
import { Capacitor } from "@capacitor/core";
import { LuListPlus } from "react-icons/lu";
import { MdLibraryMusic } from "react-icons/md";
import { PiMusicNotesPlusBold } from "react-icons/pi";
import { FaPlay } from "react-icons/fa";
import { IoIosRemoveCircle } from "react-icons/io";
import { IoIosTrash } from "react-icons/io";

const formatDuration = (seconds) => {
  if (!seconds || isNaN(seconds) || seconds <= 0) return "0:00";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
};

const toSrc = (path) => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return Capacitor.convertFileSrc(path); 
};

export function PlaylistScreen({ setScreen }) {
  const {
    listPlaylists,
    createPlaylist,
    removePlaylist,
    getPlaylistSongs,
    addSongToPlaylist,
    removeSongFromPlaylist,
  } = usePlaylists();
  const { getAllSongs } = useSongs();
  const { playSong, setQueue } = usePlayerStore();

  // Estados da lista de playlists
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);

  // Criação de playlist
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  // Detalhe da playlist
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [playlistSongs, setPlaylistSongs] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Modal de adição
  const [showAddModal, setShowAddModal] = useState(false);
  const [allSongs, setAllSongs] = useState([]);
  const [selectedSongIds, setSelectedSongIds] = useState(new Set());
  const [feedback, setFeedback] = useState("");

  // ------------------------------------------------------------
  // 1. Carregar playlists com duração total enriquecida
  // ------------------------------------------------------------
  const loadPlaylistsWithDuration = useCallback(async () => {
    setLoading(true);
    try {
      const rawList = await listPlaylists();
      if (!rawList || rawList.length === 0) {
        setPlaylists([]);
        return;
      }
      const enriched = await Promise.all(
        rawList.map(async (pl) => {
          const songs = await getPlaylistSongs(pl.id);
          const total = songs.reduce(
            (acc, s) => acc + (Number(s.duration) || 0),
            0,
          );
          return { ...pl, totalDuration: total };
        }),
      );
      setPlaylists(enriched);
    } catch (err) {
      console.error("Erro ao carregar playlists:", err);
    } finally {
      setLoading(false);
    }
  }, [listPlaylists, getPlaylistSongs]);

  useEffect(() => {
    loadPlaylistsWithDuration();
  }, [loadPlaylistsWithDuration]);

  // ------------------------------------------------------------
  // 2. Gerenciar detalhe da playlist
  // ------------------------------------------------------------
  const loadPlaylistSongsOnly = useCallback(
    async (playlistId) => {
      setDetailLoading(true);
      try {
        const songs = await getPlaylistSongs(playlistId);
        setPlaylistSongs(songs ?? []);
      } catch (err) {
        console.error(err);
      } finally {
        setDetailLoading(false);
      }
    },
    [getPlaylistSongs],
  );

  const openPlaylist = useCallback(
    (playlist) => {
      setSelectedPlaylist(playlist);
      setShowAddModal(false);
      setSelectedSongIds(new Set());
      loadPlaylistSongsOnly(playlist.id);
    },
    [loadPlaylistSongsOnly],
  );

  const closePlaylist = useCallback(() => {
    setSelectedPlaylist(null);
    setPlaylistSongs([]);
    setAllSongs([]);
    setFeedback("");
  }, []);

  // ------------------------------------------------------------
  // 3. Ações básicas (criar, remover playlist)
  // ------------------------------------------------------------
  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await createPlaylist(name);
      setNewName("");
      setShowCreate(false);
      await loadPlaylistsWithDuration();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemove = async (id) => {
    try {
      await removePlaylist(id);
      await loadPlaylistsWithDuration();
    } catch (err) {
      console.error(err);
    }
  };

  // ------------------------------------------------------------
  // 4. Ações dentro do detalhe
  // ------------------------------------------------------------
  const handlePlayAll = () => {
    if (!playlistSongs.length) return;
    const mapped = playlistSongs.map((s) => ({ ...s, src: toSrc(s.path) }));
    playSong(mapped[0], mapped); 
    setScreen("player"); 
  };

  const handleRemoveSong = async (songId) => {
    if (!selectedPlaylist) return;
    try {
      await removeSongFromPlaylist(selectedPlaylist.id, songId);
      await loadPlaylistSongsOnly(selectedPlaylist.id);
      setFeedback("Música removida.");
      setTimeout(() => setFeedback(""), 1500);
    } catch (err) {
      console.error(err);
    }
  };

  // ------------------------------------------------------------
  // 5. Modal de adição de músicas
  // ------------------------------------------------------------
  const openAddModal = useCallback(async () => {
    setShowAddModal(true);
    setSelectedSongIds(new Set());
    try {
      const all = await getAllSongs();
      setAllSongs(all ?? []);
    } catch (err) {
      console.error(err);
    }
  }, [getAllSongs]);

  const toggleSongSelect = (songId) => {
    setSelectedSongIds((prev) => {
      const next = new Set(prev);
      if (next.has(songId)) next.delete(songId);
      else next.add(songId);
      return next;
    });
  };

  const addSelectedSongs = async () => {
    if (!selectedPlaylist || selectedSongIds.size === 0) return;
    try {
      for (const songId of selectedSongIds) {
        await addSongToPlaylist(selectedPlaylist.id, songId);
      }
      setShowAddModal(false);
      setFeedback(`${selectedSongIds.size} música(s) adicionada(s).`);
      setTimeout(() => setFeedback(""), 2000);
      await loadPlaylistSongsOnly(selectedPlaylist.id);
    } catch (err) {
      console.error(err);
    }
  };

  const playlistSongIds = useMemo(
    () => new Set(playlistSongs.map((s) => s.id)),
    [playlistSongs],
  );
  const availableSongs = allSongs.filter(
    (song) => !playlistSongIds.has(song.id),
  );

  // ------------------------------------------------------------
  // Renderização: Detalhe da playlist
  // ------------------------------------------------------------
  if (selectedPlaylist) {
    const totalDuration = playlistSongs.reduce(
      (acc, s) => acc + (Number(s.duration) || 0),
      0,
    );

    return (
      <div className={styles.screenContainer}>
        <Header title={selectedPlaylist.name} />

        <div className={styles.detailToolbar}>
          <Button
            className={styles.playAllBtn}
            onClick={handlePlayAll}
            title={<FaPlay />}
          />
          <Button
            className={styles.addSongsBtn}
            onClick={openAddModal}
            title={<PiMusicNotesPlusBold />}
          />
        </div>

        {feedback && <div className={styles.feedback}>{feedback}</div>}

        <div className={styles.statsBar}>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <h2>Total de Músicas:</h2>
              <p>{playlistSongs.length}</p>
            </div>
            <div className={styles.statCard}>
              <h2>Duração total:</h2>
              <p>{formatDuration(totalDuration)}</p>
            </div>
          </div>
        </div>

        {detailLoading ? (
          <div className={styles.emptyState}>Carregando músicas...</div>
        ) : playlistSongs.length === 0 ? (
          <div className={styles.emptyState}>Playlist vazia.</div>
        ) : (
          <div className={styles.songList}>
            {playlistSongs.map((song) => (
              <div key={song.id} className={styles.songItem}>
                <div className={styles.songInfo}>
                  <span className={styles.songTitle}>{song.title}</span>
                </div>
                <div className={styles.songActions}>
                  <Button
                    className={styles.iconBtn}
                    onClick={() => handleRemoveSong(song.id)}
                    title={<IoIosRemoveCircle />}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal de adição */}
        {showAddModal && (
          <div
            className={styles.modalOverlay}
            onClick={() => setShowAddModal(false)}
          >
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <span className={styles.modalTitle}>
                  Adicionar músicas à {selectedPlaylist.name}
                </span>
                <button
                  className={styles.modalClose}
                  onClick={() => setShowAddModal(false)}
                >
                  ✕
                </button>
              </div>
              <div className={styles.modalBody}>
                {availableSongs.length === 0 ? (
                  <p>Todas as músicas já estão na playlist.</p>
                ) : (
                  <>
                    <div className={styles.selectionActions}>
                      <button
                        onClick={() =>
                          setSelectedSongIds(
                            new Set(availableSongs.map((s) => s.id)),
                          )
                        }
                      >
                        Selecionar todas
                      </button>
                      <button onClick={() => setSelectedSongIds(new Set())}>
                        Limpar
                      </button>
                    </div>
                    <ul className={styles.selectableList}>
                      {availableSongs.map((song) => (
                        <li key={song.id} className={styles.selectableItem}>
                          <label>
                            <input
                              type="checkbox"
                              checked={selectedSongIds.has(song.id)}
                              onChange={() => toggleSongSelect(song.id)}
                            />
                            {song.title}
                          </label>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
              <div className={styles.modalFooter}>
                <button onClick={() => setShowAddModal(false)}>Cancelar</button>
                <button
                  disabled={selectedSongIds.size === 0}
                  onClick={addSelectedSongs}
                >
                  Adicionar{" "}
                  {selectedSongIds.size > 0 ? `(${selectedSongIds.size})` : ""}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Botão Voltar fixo */}
        <div className={styles.backButtonWrapper}>
          <button
            onClick={() => {
              closePlaylist();
              setScreen("playlists");
            }}
            className={styles.backButton}
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------
  // Renderização: Lista de playlists
  // ------------------------------------------------------------
  return (
    <div className={styles.screenContainer}>
      <Header title="Playlists" />

      <div className={styles.toolbar}>
        <Button
          className={styles.createBtn}
          onClick={() => setShowCreate((v) => !v)}
          title={showCreate ? "Cancelar" : <LuListPlus />}
        />
      </div>

      {showCreate && (
        <div className={styles.createForm}>
          <input
            className={styles.input}
            type="text"
            placeholder="Nome da playlist..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            autoFocus
          />
          <Button
            className={styles.confirmBtn}
            onClick={handleCreate}
            title="Criar Playlist"
          />
        </div>
      )}

      <div className={styles.listContainer}>
        {loading ? (
          <div className={styles.emptyState}>Carregando...</div>
        ) : playlists.length === 0 ? (
          <div className={styles.emptyState}>Nenhuma playlist ainda.</div>
        ) : (
          playlists.map((pl) => (
            <div
              key={pl.id}
              className={styles.songItem}
              onClick={() => openPlaylist(pl)}
            >
              <div className={styles.playlistInfo}>
                <div className={styles.playlistIcon}>
                  <MdLibraryMusic />
                </div>
                <span className={styles.playlistName}>{pl.name}</span>
                <span className={styles.playlistDuration}>
                  {formatDuration(pl.totalDuration ?? 0)}
                </span>
              </div>
              <div className={styles.songActions}>
                <Button
                  className={styles.iconBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Deletar playlist "${pl.name}"?`)) {
                      handleRemove(pl.id);
                    }
                  }}
                  title={<IoIosTrash />}
                />
              </div>
            </div>
          ))
        )}
      </div>

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
