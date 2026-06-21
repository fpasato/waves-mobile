// src/lib/mediaMetadata.js
import { registerPlugin } from "@capacitor/core";

const MediaMetadata = registerPlugin("MediaMetadata");

export async function getNativeMetadata(filePath) {
  try {
    // filePath deve ser o caminho absoluto: /storage/emulated/0/...
    const path = filePath.replace("file://", "");
    const result = await MediaMetadata.getDuration({ path });
    return {
      duration: result.duration ?? 0,
      title: result.title || null,
      artist: result.artist || null,
    };
  } catch {
    return { duration: 0, title: null, artist: null };
  }
}