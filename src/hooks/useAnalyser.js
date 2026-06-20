import { useEffect, useRef } from "react";
import { usePlayer } from "../store/PlayerContext";
import { usePlayerStore } from "../store/playerStore";

export function useAnalyser() {
  const { audioRef, crossfadeAudioRef, analyserRef, audioContextRef } =
    usePlayer();
  const _radioAudio = usePlayerStore((state) => state._radioAudio);
  const radioSrcRef = useRef(null);

  // 1️⃣ PRIMEIRO: cria o AudioContext
  useEffect(() => {
    if (analyserRef.current) return;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    const srcA = ctx.createMediaElementSource(audioRef.current);
    const srcB = ctx.createMediaElementSource(crossfadeAudioRef.current);
    srcA.connect(analyser);
    srcB.connect(analyser);
    analyser.connect(ctx.destination);
    audioContextRef.current = ctx;
    analyserRef.current = analyser;
  }, []);

  // 2️⃣ SEGUNDO: conecta o rádio (só roda depois que o ctx existe)
  // No useEffect do rádio:
  useEffect(() => {
    console.log(
      "🎙️ radio effect | _radioAudio:",
      !!_radioAudio,
      "| analyser:",
      !!analyserRef.current,
      "| ctx:",
      !!audioContextRef.current,
    );
    if (!_radioAudio || !analyserRef.current || !audioContextRef.current)
      return;
    if (radioSrcRef.current) {
      console.log("🎙️ já conectado, skip");
      return;
    }

    try {
      const ctx = audioContextRef.current;
      console.log("🎙️ ctx.state:", ctx.state);
      const src = ctx.createMediaElementSource(_radioAudio);
      const gain = ctx.createGain();
      gain.gain.value = 1;
      src.connect(analyserRef.current);
      src.connect(gain);
      gain.connect(ctx.destination);
      radioSrcRef.current = src;
      console.log("🎙️ rádio conectado ao analyser + destination ✅");
    } catch (e) {
      console.error("🎙️ ERRO ao conectar rádio:", e.message);
    }
  }, [_radioAudio]);

  // 3️⃣ TERCEIRO: resume no clique/tecla
  useEffect(() => {
    const resume = () =>
      audioContextRef.current?.state === "suspended" &&
      audioContextRef.current.resume();
    document.addEventListener("click", resume);
    document.addEventListener("keydown", resume);
    return () => {
      document.removeEventListener("click", resume);
      document.removeEventListener("keydown", resume);
    };
  }, []);

  return { analyserRef };
}
