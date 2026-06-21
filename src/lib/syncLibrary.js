import { Filesystem, Directory } from "@capacitor/filesystem";
import { Capacitor } from "@capacitor/core";
import { parseBlob } from "music-metadata-browser";
import { api } from "../database/database";
import { getNativeMetadata } from "./mediaMetadata";
import { registerPlugin } from "@capacitor/core";

const MediaMetadata = registerPlugin("MediaMetadata");
// ─── Constantes ──────────────────────────────────────────────────────────────

const AUDIO_EXTENSIONS = [
  ".mp3",
  ".flac",
  ".m4a",
  ".ogg",
  ".wav",
  ".aac",
  ".opus",
];

/** Bytes lidos para extrair tags + duração (128 KB é suficiente para ID3/Vorbis). */
const META_FETCH_SIZE = 131_072;

/** Músicas mais curtas que isso são ignoradas (toques, efeitos, etc.). */
const MIN_DURATION_SECONDS = 30;

/** Leituras de metadata em paralelo. Dois é mais seguro no storage Android. */
const MAX_PARALLEL_META = 1;

// ─── Helpers básicos ─────────────────────────────────────────────────────────

function isAudioFile(name) {
  const lower = name.toLowerCase();
  return AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function fileNameWithoutExt(filePath) {
  const name = filePath.split("/").pop() ?? filePath;
  return name.replace(/\.[^.]+$/, "");
}

function base64ToBlob(base64, mimeType = "audio/mpeg") {
  const raw = base64.includes(",") ? base64.split(",")[1] : base64;
  const byteArrays = [];
  for (let offset = 0; offset < raw.length; offset += 8192) {
    const chunk = raw.slice(offset, offset + 8192);
    const binary = atob(chunk);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    byteArrays.push(bytes);
  }
  return new Blob(byteArrays, { type: mimeType });
}

// ─── Resolução de src ────────────────────────────────────────────────────────

export function resolveAudioSrc(fileUri) {
  if (!fileUri) return Promise.resolve(fileUri);
  return Promise.resolve(Capacitor.convertFileSrc(fileUri));
}

export function preloadAudioSrc(fileUri) {
  if (!fileUri) return;
  resolveAudioSrc(fileUri).catch(console.error);
}

// ─── Leitura parcial do arquivo ──────────────────────────────────────────────

/**
 * Tenta buscar apenas os primeiros META_FETCH_SIZE bytes via Range Request.
 * Cai para leitura completa via Filesystem se o servidor não suportar Range.
 */
async function fetchPartialBlob(relativePath) {
  const url = Capacitor.convertFileSrc(
    `file:///storage/emulated/0/${relativePath}`,
  );
  const isM4a = /\.(m4a|aac|mp4)$/i.test(relativePath);

  try {
    const res = await fetch(url, {
      headers: isM4a ? {} : { Range: `bytes=0-${META_FETCH_SIZE - 1}` },
    });
    if (res.ok || res.status === 206) {
      const blob = await res.blob();
      // define o mimeType correto para o parser entender
      return isM4a ? new Blob([blob], { type: "audio/mp4" }) : blob;
    }
  } catch {
    // fallback abaixo
  }

  try {
    const result = await Filesystem.readFile({
      path: relativePath,
      directory: Directory.ExternalStorage,
    });
    return base64ToBlob(result.data, isM4a ? "audio/mp4" : "audio/mpeg");
  } catch {
    return null;
  }
}

// ─── Extração de metadata ────────────────────────────────────────────────────

/**
 * Extrai título, artista e duração via music-metadata-browser.
 * Capas são ignoradas completamente (skipCovers: true).
 *
 * @param {string} relativePath - Caminho relativo a /storage/emulated/0/
 * @returns {{ title, artist, duration }}
 */
async function extractMetadata(relativePath) {
  const fallback = {
    title: fileNameWithoutExt(relativePath),
    artist: "Desconhecido",
    duration: 0,
  };

  const blob = await fetchPartialBlob(relativePath);
  if (!blob) return fallback;

  try {
    const { common, format } = await parseBlob(blob, { skipCovers: true });

    return {
      title: common.title || fallback.title,
      artist: common.artist || fallback.artist,
      duration: Math.floor(format.duration ?? 0),
    };
  } catch {
    return fallback;
  }
}

// ─── Enriquecimento de faixas ────────────────────────────────────────────────

/**
 * Enriquece uma única faixa: lê metadata, filtra por duração mínima e
 * persiste no banco. Retorna null se a faixa for muito curta.
 */
async function enrichTrack(track) {
  const metadata = await getNativeMetadata(track.path);

  if (metadata.duration > 0 && metadata.duration < MIN_DURATION_SECONDS) {
    await api.db.songs.delete(track.id);
    console.log(`🗑️ Removido: ${track.title} (${metadata.duration}s)`);
    return null;
  }

  const enriched = {
    id: track.id,
    title: metadata.title || track.title,
    artist: metadata.artist || track.artist,
    duration: metadata.duration,
    file_mtime: track.file_mtime,
  };

  await api.db.songs.update(enriched);
  console.log(`✅ ${enriched.title} (${enriched.duration}s)`);
  return enriched;
}

// ─── Concorrência controlada ─────────────────────────────────────────────────

/**
 * Executa um array de funções assíncronas com limite de paralelismo.
 * Evita disparar todas as tarefas de uma vez para não sobrecarregar o
 * storage do Android.
 */
async function runWithConcurrency(tasks, limit, signal) {
  const results = [];
  const executing = new Set();

  for (const task of tasks) {
    if (signal?.aborted) throw new Error("Abortado");

    const p = task().then((res) => {
      executing.delete(p);
      return res;
    });
    executing.add(p);
    results.push(p);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}

// ─── Enriquecimento em background ────────────────────────────────────────────

let currentEnrichmentController = null;

/**
 * Enriquece todas as músicas sem duração registrada no banco.
 * Deve ser chamado **sem await** para não bloquear a UI.
 *
 * @param {(enriched: object) => void} [onTrackEnriched]
 * @param {AbortSignal} [signal]
 */
export async function startBackgroundEnrichment(onTrackEnriched, signal) {
  currentEnrichmentController?.abort();
  currentEnrichmentController = new AbortController();
  const effectiveSignal = signal ?? currentEnrichmentController.signal;

  try {
    const pending = await api.db.songs.getSongsWithoutDuration();

    if (pending.length === 0) {
      console.log("🎵 Nenhuma música pendente de enriquecimento.");
      return;
    }

    console.log(`📋 ${pending.length} músicas para enriquecer.`);

    const tasks = pending.map((track) => async () => {
      if (effectiveSignal.aborted) throw new Error("Abortado");

      const enriched = await enrichTrack(track);
      if (enriched) onTrackEnriched?.(enriched);
      return enriched;
    });

    await runWithConcurrency(tasks, MAX_PARALLEL_META, effectiveSignal);
    console.log("🏁 Enriquecimento concluído.");
  } catch (err) {
    if (err.message === "Abortado") {
      console.log("⏹️ Enriquecimento cancelado.");
    } else {
      console.error("❌ Erro no enriquecimento:", err);
    }
  } finally {
    if (currentEnrichmentController?.signal === effectiveSignal) {
      currentEnrichmentController = null;
    }
  }
}

// ─── Varredura de diretórios ─────────────────────────────────────────────────

async function walkDirectory(dirPath, audioFiles = []) {
  let entries;
  try {
    const result = await Filesystem.readdir({
      path: dirPath,
      directory: Directory.ExternalStorage,
    });
    entries = result.files;
  } catch (err) {
    console.warn(`⚠️ Não foi possível ler: ${dirPath}`, err);
    return audioFiles;
  }

  const subdirs = [];
  for (const entry of entries) {
    const fullPath = dirPath ? `${dirPath}/${entry.name}` : entry.name;
    if (entry.type === "directory") {
      subdirs.push(fullPath);
    } else if (isAudioFile(entry.name)) {
      audioFiles.push({
        path: `file:///storage/emulated/0/${fullPath}`,
        originalPath: fullPath,
        mtime: entry.mtime ?? 0,
      });
    }
  }

  for (let i = 0; i < subdirs.length; i += 5) {
    const chunk = subdirs.slice(i, i + 5);
    await Promise.all(chunk.map((d) => walkDirectory(d, audioFiles)));
  }

  return audioFiles;
}

/**
 * Escaneia uma pasta e retorna a lista de faixas com metadata mínima.
 * O enriquecimento completo acontece depois, em background.
 */
export async function scanFolder(folderPath) {
  console.log(`📂 scanFolder: "${folderPath}"`);
  const audioFiles = await walkDirectory(folderPath);
  console.log(`🎵 ${audioFiles.length} arquivos encontrados.`);

  return audioFiles.map((file) => ({
    title: fileNameWithoutExt(file.originalPath),
    artist: "Desconhecido",
    duration: 0,
    path: file.path,
    originalPath: file.originalPath,
    file_mtime: file.mtime,
  }));
}

export async function scanAllMusic() {
  console.log("📂 scanAllMusic via MediaStore");
  try {
    const result = await MediaMetadata.getAllAudioFiles();
    console.log(`🎵 ${result.tracks.length} arquivos encontrados via MediaStore.`);
    return result.tracks;
  } catch (err) {
    console.error("Erro no scan via MediaStore", err);
    throw err;
  }
}

// ─── Mapeamento para o banco ─────────────────────────────────────────────────

export function mapTracksForDb(tracks, directoryId) {
  return tracks.map((t) => ({
    title: t.title,
    artist: t.artist,
    duration: t.duration ?? 0,
    path: t.path,
    directory_id: directoryId,
    file_mtime: t.file_mtime ?? 0,
  }));
}

// ─── API pública de biblioteca ───────────────────────────────────────────────

export async function reloadLibraryFromDb() {
  const songs = await api.db.songs.getAll();
  return songs.map((s) => ({ ...s, src: Capacitor.convertFileSrc(s.path) }));
}
/**
 * Escaneia todos os diretórios cadastrados, persiste no banco e
 * dispara o enriquecimento em background.
 */

export function toAudioSrc(path) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return Capacitor.convertFileSrc(path);
}

export async function refreshLibraryFromDisk(onTrackEnriched) {
  console.log("🔄 refreshLibraryFromDisk");
  const dirs = await api.db.directories.list();

  for (const dir of dirs) {
    const tracks = await scanFolder(dir.path);
    if (tracks.length === 0) continue;

    await api.db.songs.upsertMany(mapTracksForDb(tracks, dir.id));
    console.log(`💾 ${tracks.length} músicas salvas (banco).`);
  }

  startBackgroundEnrichment(onTrackEnriched);

  const songs = await api.db.songs.getAll();
  return songs.map((s) => ({ ...s, src: Capacitor.convertFileSrc(s.path) }));
}

/**
 * Sincroniza apenas arquivos novos (não presentes no banco).
 * Usa o mtime do readdir, sem chamadas extras de Filesystem.stat().
 *
 * @param {(enriched: object) => void} [onTrackEnriched]
 */
export async function syncNewFilesFromDisk(onTrackEnriched) {
  const dirs = await api.db.directories.list();
  if (!dirs.length) return;

  const existingPaths = new Set(await api.db.songs.getAllPaths());

  for (const dir of dirs) {
    // ← itera por dir
    const files = await scanFolder(dir.path);
    const newTracks = files.filter((t) => !existingPaths.has(t.path));

    if (newTracks.length === 0) continue;

    console.log(`🆕 ${newTracks.length} novos em ${dir.path}`);
    await api.db.songs.upsertMany(mapTracksForDb(newTracks, dir.id)); // ← dir.id correto
  }

  startBackgroundEnrichment(onTrackEnriched);
}

// ─── Permissões ──────────────────────────────────────────────────────────────
export async function requestStoragePermission() {
  if (!Capacitor.isNativePlatform()) return true;

  try {
    const result = await MediaMetadata.requestAudioPermission();
    console.log("🎵 permissão:", result.granted, "permanente:", result.permanentlyDenied);

    if (!result.granted && result.permanentlyDenied) {
      // negado permanentemente: não adianta pedir de novo, manda pras configurações
      await MediaMetadata.openAppSettings();
    }

    return result.granted;
  } catch (e) {
    console.error("Erro permissão:", e);
    return false;
  }
}

export async function requestNotificationPermission() {
  if (!Capacitor.isNativePlatform()) return true;

  try {
    const result = await MediaMetadata.requestNotificationPermission();
    console.log("🔔 permissão notificação:", result.granted, "permanente:", result.permanentlyDenied);

    if (!result.granted && result.permanentlyDenied) {
      // negado permanentemente: não adianta pedir de novo, manda pras configurações
      await MediaMetadata.openAppSettings();
    }

    return result.granted;
  } catch (e) {
    console.error("Erro permissão notificação:", e);
    return false;
  }
}