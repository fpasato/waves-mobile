/**
 * useDatabase.js
 * Hooks de acesso a dados — mesma API que antes, mas sem window.api.
 * Toda chamada vai para ./database.js (Capacitor SQLite).
 */

import { useCallback } from 'react';
import { api } from "../database/database";

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function useSettings() {
  return {
    get:  (key)        => api.settings.get(key),
    set:  (key, value) => api.settings.set(key, value),
  };
}

// ---------------------------------------------------------------------------
// Directories
// ---------------------------------------------------------------------------

export function useDirectories() {
  return {
    addDirectory:    (path) => api.db.directories.add(path),
    removeDirectory: (id)   => api.db.directories.remove(id),
    listDirectories: ()     => api.db.directories.list(),
  };
}

// ---------------------------------------------------------------------------
// Songs
// ---------------------------------------------------------------------------

export function useSongs() {
  return {
    getAllSongs:          ()       => api.db.songs.getAll(),
    getSongsByDirectory: (dirId)  => api.db.songs.getByDirectory(dirId),
    upsertManySongs:     (songs)  => api.db.songs.upsertMany(songs),
  };
}

// ---------------------------------------------------------------------------
// Favorites
// ---------------------------------------------------------------------------

export function useFavorites() {
  return {
    addFavorite:    (songId) => api.db.favorites.add(songId),
    removeFavorite: (songId) => api.db.favorites.remove(songId),
    isFavorite:     (songId) => api.db.favorites.isFavorite(songId),
    listFavorites:  ()       => api.db.favorites.list(),
  };
}

// ---------------------------------------------------------------------------
// Recents
// ---------------------------------------------------------------------------

export function useRecents() {
  return {
    addRecent:    (songId)        => api.db.recents.add(songId),
    listRecents:  (limit = 20)   => api.db.recents.list(limit),
    clearRecents: ()              => api.db.recents.clear(),
  };
}

// ---------------------------------------------------------------------------
// Playlists
// ---------------------------------------------------------------------------

export function usePlaylists() {
  const createPlaylist = useCallback((name, cover) => api.db.playlists.create(name, cover), []);
  const renamePlaylist = useCallback((id, name) => api.db.playlists.rename(id, name), []);
  const removePlaylist = useCallback((id) => api.db.playlists.remove(id), []);
  const listPlaylists = useCallback(() => api.db.playlists.list(), []);
  const getPlaylistSongs = useCallback((playlistId) => api.db.playlists.getSongs(playlistId), []);
  const addSongToPlaylist = useCallback((playlistId, songId) => api.db.playlists.addSong(playlistId, songId), []);
  const removeSongFromPlaylist = useCallback((playlistId, songId) => api.db.playlists.removeSong(playlistId, songId), []);
  const reorderPlaylist = useCallback((playlistId, songIds) => api.db.playlists.reorder(playlistId, songIds), []);

  return {
    createPlaylist,
    renamePlaylist,
    removePlaylist,
    listPlaylists,        // ← retorna a lista crua (sem duração total)
    getPlaylistSongs,
    addSongToPlaylist,
    removeSongFromPlaylist,
    reorderPlaylist,
  };
}