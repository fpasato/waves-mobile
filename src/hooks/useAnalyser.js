import { useEffect, useRef } from "react";
import { usePlayer } from "../store/PlayerContext";
import { usePlayerStore } from "../store/playerStore";

export function useAnalyser() {
  const { audioRef, crossfadeAudioRef, analyserRef, audioContextRef } =
    usePlayer();
  const radioSrcRef = useRef(null); // MediaElementSource da rádio

  const playerType = usePlayerStore((state) => state.playerType);
  const _radioAudio = usePlayerStore((state) => state._radioAudio);

  // resume no clique/tecla
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

  // setup roda UMA vez no mount — conecta os dois áudios de música
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

  // conecta o _radioAudio ao analyser quando ele é criado
  useEffect(() => {
    if (!_radioAudio || !analyserRef.current || !audioContextRef.current) return;
    if (radioSrcRef.current) return; // já conectado

    try {
      const src = audioContextRef.current.createMediaElementSource(_radioAudio);
      src.connect(analyserRef.current);
      radioSrcRef.current = src;
    } catch (e) {
      // MediaElementSource já foi criado para este elemento — ignora
      console.warn("radioAudio source:", e);
    }
  }, [_radioAudio]);

  return { analyserRef };
}