import { useState, useEffect, useCallback } from "react";
import { RadioBrowserApi } from "radio-browser-api";
import { usePlayerStore } from "../store/playerStore";

const api = new RadioBrowserApi("AuraPlayer");
const FAVORITES_KEY = "aura:radio:favorites";

const BRAZILIAN_POPULAR = [
  "Jovem Pan FM",
  "Band FM",
  "Mix FM",
  "Modão ",
  "Nativa FM",
  "Cultura FM",
  "Clube FM",
  "Difusora FM",
  "Educadora FM",
  "Cidade FM",
];

function loadStorage(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function normalizeRadio(station) {
  return {
    id: station.stationuuid || crypto.randomUUID(),
    name: station.name || "Rádio",
    favicon: typeof station.favicon === "string" ? station.favicon : "",
    stream: station.urlResolved || station.url_resolved || station.url || "",
    country: "Brazil",
    state: station.state || "",
    bitrate: station.bitrate || 0,
    codec: station.codec || "",
    tags:
      typeof station.tags === "string"
        ? station.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
  };
}

export function useRadio() {
  const [query, setQuery] = useState("");
  const [radios, setRadios] = useState([]);
  const [popularRadios, setPopularRadios] = useState([]);
  const [favorites, setFavorites] = useState(() =>
    loadStorage(FAVORITES_KEY, []),
  );
  const [loading, setLoading] = useState(false);
  const [loadingPopular, setLoadingPopular] = useState(false);
  const [error, setError] = useState(null);

  // ── SEM audioRef, SEM currentRadio, SEM isPlaying local ──
  // tudo isso vive no playerStore agora

  // ── persistência só de favoritos ──
  useEffect(() => saveStorage(FAVORITES_KEY, favorites), [favorites]);
  // ← REMOVER: useEffect(() => saveStorage(LAST_RADIO_KEY, currentRadio), [currentRadio]);

  const fetchPopularRadios = useCallback(async () => {
    setLoadingPopular(true);
    setError(null);
    try {
      const results = await Promise.all(
        BRAZILIAN_POPULAR.map((name) =>
          api.searchStations({ name, limit: 1, hideBroken: true }),
        ),
      );
      const stations = results.flat().filter(Boolean);
      const formatted = stations
        .filter((s) => s.urlResolved || s.url_resolved || s.url)
        .map(normalizeRadio);
      setPopularRadios(formatted);
    } catch (err) {
      console.error(err);
      setError("Erro ao carregar rádios.");
    } finally {
      setLoadingPopular(false);
    }
  }, []);

  const searchRadios = useCallback(async (text) => {
    const value = text?.trim();
    if (!value) {
      setRadios([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const stations = await api.searchStations({
        name: value,
        countryCode: "BR", // ← só Brasil
        order: "clickcount",
        reverse: true,
        limit: 50,
        hideBroken: true,
      });
      const formatted = stations
        .filter((s) => s.urlResolved || s.url)
        .map(normalizeRadio);
      setRadios(formatted);
      if (formatted.length === 0) setError("Nenhuma rádio encontrada.");
    } catch (err) {
      console.error(err);
      setError("Erro ao buscar rádios.");
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleFavorite = useCallback((radio) => {
    setFavorites((prev) =>
      prev.some((item) => item.id === radio.id)
        ? prev.filter((item) => item.id !== radio.id)
        : [...prev, radio],
    );
  }, []);

  const isFavorite = useCallback(
    (id) => favorites.some((radio) => radio.id === id),
    [favorites],
  );

  useEffect(() => {
    fetchPopularRadios();
  }, [fetchPopularRadios]);

  return {
    query,
    setQuery,
    searchRadios,
    radios,
    popularRadios,
    favorites,
    loading,
    loadingPopular,
    error,
    toggleFavorite,
    isFavorite,
  };
}
