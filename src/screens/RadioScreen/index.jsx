import { Header } from "../../components/Header";
import styles from "./style.module.css";
import { useRadio } from "../../hooks/useRadio";
import { useState } from "react";
import { usePlayerStore } from "../../store/playerStore";

import { MdOutlineFavorite } from "react-icons/md";
import { MdOutlineFavoriteBorder } from "react-icons/md";
import { LuPause } from "react-icons/lu";
import { LuPlay } from "react-icons/lu";


function WaveIcon() {
  return (
    <span className={styles.waveIcon} aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}

function Spinner() {
  return <span className={styles.spinner} aria-hidden="true" />;
}

function RadioThumb({ radio, isActive, isBuffering }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className={styles.cardThumb}>
      {radio.favicon && !imgError ? (
        <img
          src={radio.favicon}
          onError={(e) => {
            e.target.style.display = "none";
          }}
          alt=""
        />
      ) : null}

      {(imgError || !radio.favicon) && (
        <span className={styles.cardInitial}>
          {radio.name?.[0]?.toUpperCase() ?? "R"}
        </span>
      )}

      {isActive && (
        <div className={styles.cardActiveOverlay}>
          {isBuffering ? <Spinner /> : <WaveIcon />}
        </div>
      )}
    </div>
  );
}

function RadioCard({
  radio,
  isActive,
  isBuffering,
  isFavorite,
  onPlay,
  onPause,
  onFavorite,
}) {
  const firstTag = radio.tags?.[0];

  const handlePlay = () => {
    if (isActive) {
      onPause();
      return;
    }

    onPlay(radio);
  };

  return (
    <article
      className={`${styles.radioCard} ${
        isActive ? styles.radioCardActive : ""
      }`}
    >
      <button
        className={styles.cardMain}
        onClick={handlePlay}
        aria-label={`${isActive ? "Pausar" : "Tocar"} ${radio.name}`}
      >
        <RadioThumb
          radio={radio}
          isActive={isActive}
          isBuffering={isBuffering}
        />

        <div className={styles.cardInfo}>
          <p className={styles.cardName}>{radio.name}</p>

          <p className={styles.cardMeta}>
            {[radio.country, radio.state].filter(Boolean).join(" • ") ||
              "Rádio online"}
          </p>

          <div className={styles.cardTags}>
            {firstTag && <span className={styles.cardTag}>{firstTag}</span>}

            {radio.bitrate > 0 && (
              <span className={styles.cardTag}>{radio.bitrate}kbps</span>
            )}

            {radio.codec && (
              <span className={styles.cardTag}>{radio.codec}</span>
            )}
          </div>
        </div>
      </button>

      <div className={styles.cardActions}>
        <button
          className={styles.playBtn}
          onClick={handlePlay}
          aria-label={isActive ? "Pausar rádio" : "Tocar rádio"}
          title={isActive ? "Pausar" : "Tocar"}
        >
          {isBuffering ? <Spinner /> : isActive ? <LuPause /> : <LuPlay />}
        </button>

        <button
          className={`${styles.favBtn} ${
            isFavorite ? styles.favBtnActive : ""
          }`}
          onClick={() => onFavorite(radio)}
          aria-label={
            isFavorite
              ? `Remover ${radio.name} dos favoritos`
              : `Favoritar ${radio.name}`
          }
          title={isFavorite ? "Remover favorito" : "Favoritar"}
        >
          {isFavorite ? <MdOutlineFavorite /> : <MdOutlineFavoriteBorder />}
        </button>
      </div>
    </article>
  );
}

function RadioList({
  radios,
  currentRadio,
  isPlaying,
  isBuffering,
  isFavorite,
  onPlay,
  onPause,
  onFavorite,
  emptyMessage,
}) {
  const isCurrentActive = (radio) => {
    return currentRadio?.id === radio.id && (isPlaying || isBuffering);
  };

  if (!radios?.length) {
    return <p className={styles.emptyMsg}>{emptyMessage}</p>;
  }

  return (
    <div className={styles.radioList} role="list">
      {radios.map((radio) => (
        <RadioCard
          key={radio.id}
          radio={radio}
          isActive={isCurrentActive(radio)}
          isBuffering={isBuffering && currentRadio?.id === radio.id}
          isFavorite={isFavorite(radio.id)}
          onPlay={onPlay}
          onPause={onPause}
          onFavorite={onFavorite}
        />
      ))}
    </div>
  );
}

function Player({ currentRadio, isPlaying, isBuffering, onPlay, onPause }) {
  if (!currentRadio) return null;

  return (
    <div className={styles.player} aria-label="Player de rádio">
      <div className={styles.playerThumb}>
        {currentRadio.favicon ? (
          <img
            src={currentRadio.favicon}
            alt={currentRadio.name}
            onError={(e) => {
              e.currentTarget.src = "/radio-default.png";
            }}
          />
        ) : null}

        <span
          className={styles.cardInitial}
          style={{
            display: currentRadio.favicon ? "none" : "flex",
          }}
        >
          {currentRadio.name?.[0]?.toUpperCase() ?? "R"}
        </span>
      </div>

      <div className={styles.playerInfo}>
        <p className={styles.playerName}>{currentRadio.name}</p>

        <p className={styles.playerMeta}>
          {isBuffering
            ? "Carregando..."
            : isPlaying
            ? currentRadio.country || currentRadio.state || "Ao vivo"
            : "Pausado"}
        </p>
      </div>

      {isBuffering && <Spinner />}
      {isPlaying && !isBuffering && <WaveIcon />}

      <button
        className={styles.playerBtn}
        onClick={() => (isPlaying ? onPause() : onPlay(currentRadio))}
        disabled={isBuffering}
        aria-label={isPlaying ? "Pausar rádio" : "Tocar rádio"}
      >
        {isPlaying ? "⏸" : "▶"}
      </button>
    </div>
  );
}

export function RadioScreen({ setScreen }) {
  const [activeTab, setActiveTab] = useState("search"); // ← adicionar

  const {
    query,
    setQuery,
    radios,
    popularRadios,
    favorites,
    loading,
    loadingPopular,
    error,
    searchRadios,
    toggleFavorite,
    isFavorite,
  } = useRadio();

  const currentRadio = usePlayerStore((state) => state.currentRadio);
  const radioPlaying = usePlayerStore((state) => state.radioPlaying);
  const radioBuffering = usePlayerStore((state) => state.radioBuffering);
  const playRadio = usePlayerStore((state) => state.playRadio);
  const pauseRadio = usePlayerStore((state) => state.pauseRadio);

  // ← adicionar handlers faltando
  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleSearch = () => {
    searchRadios(query);
  };

  const handlePlayRadio = (radio) => {
    playRadio(radio);
    setScreen("player"); // ← navega para o player
  };

  // ← mapear para os nomes que RadioList espera
  const isPlaying = radioPlaying;
  const isBuffering = radioBuffering;

  return (
    <div className={styles.radioScreen}>
      <Header title="Rádio" />

      <div className={styles.radioContent}>
        <div className={styles.tabs} role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === "search"}
            className={`${styles.tab} ${
              activeTab === "search" ? styles.tabActive : ""
            }`}
            onClick={() => setActiveTab("search")}
          >
            Buscar
          </button>

          <button
            role="tab"
            aria-selected={activeTab === "favorites"}
            className={`${styles.tab} ${
              activeTab === "favorites" ? styles.tabActive : ""
            }`}
            onClick={() => setActiveTab("favorites")}
          >
            Favoritas
            {favorites.length > 0 && (
              <span className={styles.badge}>{favorites.length}</span>
            )}
          </button>

          <div className={styles.backButtonWrapper}> 
            <button
              onClick={() => setScreen("player")}
              className={`${styles.tab} ${styles.backButton}`}
            >
              Voltar
            </button>
          </div>
        </div>

        {activeTab === "search" && (
          <div className={styles.searchArea}>
            <input
              type="search"
              placeholder="Buscar rádios do mundo inteiro..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              aria-label="Buscar rádio"
            />

            {query && (
              <button
                className={styles.clearBtn}
                onClick={() => setQuery("")}
                aria-label="Limpar busca"
              >
                ✕
              </button>
            )}

            <button
              className={styles.searchBtn}
              onClick={handleSearch}
              disabled={!query.trim() || loading}
              aria-label="Buscar rádio"
            >
              {loading ? <Spinner /> : "Buscar"}
            </button>
          </div>
        )}

        {error && !loading && (
          <p className={styles.errorMsg} role="alert">
            {error}
          </p>
        )}

        {loading && (
          <div className={styles.loadingRow} aria-live="polite">
            <Spinner />
            <span>Buscando rádios...</span>
          </div>
        )}

        {activeTab === "search" && !query && !loading && (
          <section className={styles.popularSection}>
            <h2 className={styles.sectionTitle}>Em alta</h2>

            {loadingPopular ? (
              <div className={styles.loadingRow}>
                <Spinner />
                <span>Carregando rádios...</span>
              </div>
            ) : (
              <RadioList
                radios={popularRadios}
                currentRadio={currentRadio}
                isPlaying={isPlaying}
                isBuffering={isBuffering}
                isFavorite={isFavorite}
                onPlay={handlePlayRadio}
                onPause={pauseRadio}
                onFavorite={toggleFavorite}
                emptyMessage="Nenhuma rádio popular encontrada."
              />
            )}
          </section>
        )}

        {activeTab === "search" && query && !loading && (
          <RadioList
            radios={radios}
            currentRadio={currentRadio}
            isPlaying={isPlaying}
            isBuffering={isBuffering}
            isFavorite={isFavorite}
            onPlay={handlePlayRadio}
            onPause={pauseRadio}
            onFavorite={toggleFavorite}
            emptyMessage="Nenhuma rádio encontrada."
          />
        )}

        {activeTab === "favorites" && (
          <RadioList
            radios={favorites}
            currentRadio={currentRadio}
            isPlaying={isPlaying}
            isBuffering={isBuffering}
            isFavorite={isFavorite}
            onPlay={handlePlayRadio}
            onPause={pauseRadio}
            onFavorite={toggleFavorite}
            emptyMessage="Nenhuma rádio favoritada ainda."
          />
        )}
      </div>

      <Player
        currentRadio={currentRadio}
        isPlaying={isPlaying}
        isBuffering={isBuffering}
        onPlay={playRadio}
        onPause={pauseRadio}
      />
    </div>
  );
}
