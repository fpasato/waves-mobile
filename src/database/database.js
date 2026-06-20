/**
 * database.js
 * Camada SQLite para Capacitor — substitui window.api.db do Electron.
 *
 * Dependências:
 *   npm install @capacitor-community/sqlite
 *   npx cap sync android
 */

import { CapacitorSQLite, SQLiteConnection } from "@capacitor-community/sqlite";

const sqliteConnection = new SQLiteConnection(CapacitorSQLite);
let db = null;

// ---------------------------------------------------------------------------
// Inicialização
// ---------------------------------------------------------------------------
export async function initDatabase() {
  if (db) return db;

  try {
    db = await sqliteConnection.createConnection(
      "musicapp",
      false,
      "no-encryption",
      1,
      false,
    );
  } catch (e) {
    if (e?.message?.includes("already exists")) {
      db = await sqliteConnection.retrieveConnection("musicapp", false);
    } else {
      throw e;
    }
  }

  await db.open();
  await runMigrations();
  return db;
}

export async function getDb() {
  if (!db) await initDatabase();
  return db;
}

async function runMigrations() {
  await db.execute(`
      CREATE TABLE IF NOT EXISTS directories (
        id   INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS songs (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        title        TEXT,
        artist       TEXT,
        duration     REAL,
        path         TEXT NOT NULL UNIQUE,
        cover        TEXT,
        directory_id INTEGER,
        file_mtime   INTEGER DEFAULT 0,   -- <== NOVA COLUNA
        play_count   INTEGER DEFAULT 0,
        last_played  DATETIME,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (directory_id) REFERENCES directories(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS favorites (
        song_id INTEGER PRIMARY KEY,
        added_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS recents (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        song_id  INTEGER NOT NULL,
        played_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS playlists (
        id    INTEGER PRIMARY KEY AUTOINCREMENT,
        name  TEXT NOT NULL,
        cover TEXT
      );

      CREATE TABLE IF NOT EXISTS playlist_songs (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        playlist_id INTEGER NOT NULL,
        song_id     INTEGER NOT NULL,
        position    INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT
      );
    `);
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

async function query(sql, params = []) {
  const database = await getDb();
  const result = await database.query(sql, params);
  return result.values ?? [];
}

async function run(sql, params = []) {
  const database = await getDb();
  return database.run(sql, params);
}

// ---------------------------------------------------------------------------
// API pública — mesma forma que window.api.db no Electron
// ---------------------------------------------------------------------------

export const api = {
  // ── Settings ──────────────────────────────────────────────────────────────
  settings: {
    async get(key) {
      const rows = await query("SELECT value FROM settings WHERE key = ?", [
        key,
      ]);
      return rows[0]?.value ?? null;
    },
    async set(key, value) {
      await run(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [key, String(value)],
      );
    },
  },

  db: {
    // ── Directories ──────────────────────────────────────────────────────────
    directories: {
      async add(path) {
        const result = await run(
          "INSERT OR IGNORE INTO directories (path) VALUES (?)",
          [path],
        );
        const rows = await query("SELECT * FROM directories WHERE path = ?", [
          path,
        ]);
        return rows[0] ?? null;
      },
      async remove(id) {
        await run("DELETE FROM directories WHERE id = ?", [id]);
      },
      async list() {
        return query("SELECT * FROM directories ORDER BY id ASC");
      },
    },

    // ── Songs ────────────────────────────────────────────────────────────────
    songs: {
      async getAll() {
        return query("SELECT * FROM songs ORDER BY title ASC");
      },

      async deleteAll() {
        await run("DELETE FROM songs"); // Apaga tabela songs
      },

      async getByDirectory(dirId) {
        return query(
          "SELECT * FROM songs WHERE directory_id = ? ORDER BY title ASC",
          [dirId],
        );
      },

      async delete(id) {
        await run("DELETE FROM songs WHERE id = ?", [id]);
      },

      async getSongsWithoutDuration() {
        return query(
          "SELECT * FROM songs WHERE duration IS NULL OR duration = 0",
        );
      },

      async update(song) {
        await run(
          `UPDATE songs SET title = ?, artist = ?, duration = ?, cover = ?, file_mtime = ?
      WHERE id = ?`,
          [
            song.title,
            song.artist,
            song.duration,
            song.cover ?? null,
            song.file_mtime ?? 0,
            song.id,
          ],
        );
      },
      async resetSongsTable() {
        await run("DROP TABLE IF EXISTS songs");
        // Recria com a estrutura correta (incluindo file_mtime)
        await db.execute(`
              CREATE TABLE songs (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                title        TEXT,
                artist       TEXT,
                duration     REAL,
                path         TEXT NOT NULL UNIQUE,
                cover        TEXT,
                directory_id INTEGER,
                file_mtime   INTEGER DEFAULT 0,
                play_count   INTEGER DEFAULT 0,
                last_played  DATETIME,
                created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (directory_id) REFERENCES directories(id) ON DELETE CASCADE
              );
          `);
      },
      async deleteNotIn(paths) {
        if (!paths || paths.length === 0) {
          // Se a lista estiver vazia, apaga tudo (use com cuidado)
          await run("DELETE FROM songs");
          return;
        }
        // Cria placeholders dinamicamente: ?,?,?
        const placeholders = paths.map(() => "?").join(",");
        await run(
          `DELETE FROM songs WHERE path NOT IN (${placeholders})`,
          paths,
        );
      },
      async getByPath(filePath) {
        const rows = await query("SELECT * FROM songs WHERE path = ?", [
          filePath,
        ]);
        return rows[0] || null;
      },

      async upsertMany(songs) {
        const database = await getDb();
        await database.executeTransaction(
          songs.map((s) => ({
            statement: `
          INSERT INTO songs (title, artist, duration, path, cover, directory_id, file_mtime)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(path) DO UPDATE SET
            title        = excluded.title,
            artist       = CASE
                            WHEN excluded.artist != 'Desconhecido' THEN excluded.artist
                            WHEN songs.artist IS NOT NULL AND songs.artist != '' THEN songs.artist
                            ELSE excluded.artist
                          END,
            duration     = CASE
                            WHEN excluded.duration > 0 THEN excluded.duration
                            ELSE songs.duration
                          END,
            cover        = CASE
                            WHEN excluded.cover IS NOT NULL THEN excluded.cover
                            ELSE songs.cover
                          END,
            directory_id = excluded.directory_id,
            file_mtime   = excluded.file_mtime
        `,
            values: [
              s.title,
              s.artist,
              s.duration,
              s.path,
              s.cover ?? null,
              s.directory_id,
              s.file_mtime ?? 0,
            ],
          })),
        );
      },

      async deleteByDurationBelow(seconds) {
        await run(
          "DELETE FROM songs WHERE duration IS NOT NULL AND duration < ?",
          [seconds],
        );
      },

      async deleteByDirectory(dirId) {
        await run("DELETE FROM songs WHERE directory_id = ?", [dirId]);
      },

      getAllPaths: async () => {
        const db = await getDb();
        const result = await db.query("SELECT path FROM songs");
        return result.values?.map((row) => row.path) ?? [];
      },
    },

    // ── Favorites ────────────────────────────────────────────────────────────
    favorites: {
      async add(songId) {
        await run("INSERT OR IGNORE INTO favorites (song_id) VALUES (?)", [
          songId,
        ]);
      },
      async remove(songId) {
        await run("DELETE FROM favorites WHERE song_id = ?", [songId]);
      },
      async isFavorite(songId) {
        const rows = await query("SELECT 1 FROM favorites WHERE song_id = ?", [
          songId,
        ]);
        return rows.length > 0;
      },
      async list() {
        return query(`
            SELECT s.* FROM songs s
            INNER JOIN favorites f ON f.song_id = s.id
            ORDER BY f.added_at DESC
          `);
      },
    },

    // ── Recents ──────────────────────────────────────────────────────────────
    recents: {
      async add(songId) {
        await run("DELETE FROM recents WHERE song_id = ?", [songId]);
        await run(
          "INSERT INTO recents (song_id, played_at) VALUES (?, datetime('now', 'localtime'))",
          [songId],
        );
      },

      async list(limit = 20) {
        return query(
          `
      SELECT s.*, r.played_at
      FROM songs s
      INNER JOIN recents r ON r.song_id = s.id
      ORDER BY r.played_at DESC
      LIMIT ?
    `,
          [limit],
        );
      },
      async clear() {
        await run("DELETE FROM recents");
      },
    },

    // ---------------------------------------------------------------------------
    // Playlists (dentro de api.db)
    // ---------------------------------------------------------------------------
    playlists: {
      async create(name, cover = null) {
        const result = await run(
          "INSERT INTO playlists (name, cover) VALUES (?, ?)",
          [name, cover],
        );
        const rows = await query("SELECT * FROM playlists WHERE id = ?", [
          result.changes?.lastId,
        ]);
        return rows[0] ?? null;
      },

      async rename(id, name) {
        await run("UPDATE playlists SET name = ? WHERE id = ?", [name, id]);
      },

      async remove(id) {
        await run("DELETE FROM playlists WHERE id = ?", [id]);
      },

      async list() {
        const sql = `
      SELECT p.id, p.name, p.cover,
             COUNT(ps.song_id) as song_count,
             COALESCE(SUM(s.duration), 0) as total_duration
      FROM playlists p
      LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id
      LEFT JOIN songs s ON ps.song_id = s.id
      GROUP BY p.id, p.name, p.cover
      ORDER BY p.id DESC
    `;
        const result = await db.query(sql);
        return result.values ?? [];
      },

      async getSongs(playlistId) {
        return query(
          `
        SELECT s.* FROM songs s
        INNER JOIN playlist_songs ps ON ps.song_id = s.id
        WHERE ps.playlist_id = ?
        ORDER BY ps.position ASC
      `,
          [playlistId],
        );
      },

      async addSong(playlistId, songId) {
        const rows = await query(
          "SELECT COALESCE(MAX(position), -1) + 1 AS next FROM playlist_songs WHERE playlist_id = ?",
          [playlistId],
        );
        const position = rows[0]?.next ?? 0;
        await run(
          "INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)",
          [playlistId, songId, position],
        );
      },

      async removeSong(playlistId, songId) {
        await run(
          "DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?",
          [playlistId, songId],
        );
      },

      async reorder(playlistId, songIds) {
        const database = await getDb();
        await database.executeTransaction(
          songIds.map((songId, position) => ({
            statement:
              "UPDATE playlist_songs SET position = ? WHERE playlist_id = ? AND song_id = ?",
            values: [position, playlistId, songId],
          })),
        );
      },
    },
  },
};
