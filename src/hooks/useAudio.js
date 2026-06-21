import { useEffect, useRef } from "react";
import { usePlayer } from "../store/PlayerContext";
import { usePlayerStore } from "../store/playerStore";
import { updateMusicControlsElapsed } from "./musicControls";

function logWithTime(...args) {
  const now = new Date();
  const timestamp = `${now.getHours().toString().padStart(2, "0")}:${now
    .getMinutes()
    .toString()
    .padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}.${now
    .getMilliseconds()
    .toString()
    .padStart(3, "0")}`;
  console.log(`[${timestamp}]`, ...args);
}

export function useAudio() {
  const {
    audioRef,
    crossfadeAudioRef,
    currentSrcRef,
    audioContextRef,
    activeAudioRef,
    fadingRef,
    crossfadeDoneRef,
    seekRef,
  } = usePlayer();

  const currentSong = usePlayerStore((state) => state.currentSong);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const volume = usePlayerStore((state) => state.volume);
  const nextSong = usePlayerStore((state) => state.nextSong);
  const restartSignal = usePlayerStore((state) => state.restartSignal);
  const playerType = usePlayerStore((state) => state.playerType);
  const playerA = audioRef.current;
  const playerB = crossfadeAudioRef.current;

  const suppressCrossfadeRef = useRef(false);
  const crossfadeBlockedRef = useRef(false);
  const enteringAudioRef = useRef(null);
  const fadeIdRef = useRef(0);
  const seekSignal = usePlayerStore((state) => state.seekSignal);
  const seekTarget = usePlayerStore((state) => state.seekTarget);
  const seekingRef = useRef(false);

  if (!activeAudioRef.current) {
    activeAudioRef.current = playerA;
    logWithTime("🎬 [INIT] activeAudioRef definido como playerA");
  }

  // ---------- UTILITÁRIOS ----------
  function getActive() {
    const active = activeAudioRef.current;
    logWithTime(
      `📍 [getActive] retornando player ${active === playerA ? "A" : "B"}`,
    );
    return active;
  }

  function getInactive() {
    const inactive = activeAudioRef.current === playerA ? playerB : playerA;
    logWithTime(
      `📍 [getInactive] retornando player ${inactive === playerA ? "A" : "B"}`,
    );
    return inactive;
  }

  function resetElement(el, logLabel) {
    const label = logLabel || (el === playerA ? "A" : "B");
    logWithTime(`🧹 [RESET] ${label} | src antes: ${el.src || "none"}`);
    el.pause();
    el.removeAttribute("src");
    el.load();
    el.volume = usePlayerStore.getState().volume;
    logWithTime(
      `🧹 [RESET] ${label} concluído | volume setado para ${el.volume}`,
    );
  }

  function swapActive() {
    const oldActive = activeAudioRef.current === playerA ? "A" : "B";
    activeAudioRef.current =
      activeAudioRef.current === playerA ? playerB : playerA;
    const newActive = activeAudioRef.current === playerA ? "A" : "B";
    logWithTime(`🔄 [SWAP] active swapped: ${oldActive} -> ${newActive}`);
  }

  function abortCrossfade() {
    if (!fadingRef.current) {
      logWithTime(`⏭️ [ABORT] crossfade não estava ativo, ignorado`);
      return;
    }
    logWithTime(
      `⛔ [ABORT] crossfade aborted | fadeId antes: ${fadeIdRef.current}`,
    );
    fadeIdRef.current++;
    fadingRef.current = false;

    const entering = enteringAudioRef.current;
    if (entering) {
      logWithTime(
        `⛔ [ABORT] parando entering player | src: ${entering.src || "none"}`,
      );
      entering.pause();
      entering.currentTime = 0;
      entering.removeAttribute("src");
      entering.load();
    } else {
      logWithTime(`⛔ [ABORT] enteringAudioRef já era null`);
    }
    enteringAudioRef.current = null;

    const active = getActive();
    const newVolume = usePlayerStore.getState().volume;
    active.volume = newVolume;
    logWithTime(`⛔ [ABORT] volume do ativo restaurado para ${newVolume}`);
  }

  // ---------- EVENTO ENDED ----------
  const onEndedFnRef = useRef(null);
  onEndedFnRef.current = () => {
    if (crossfadeDoneRef.current) {
      console.log("🎵 [ENDED] ignorado – crossfade já completou este ciclo");
      crossfadeDoneRef.current = false;
      return;
    }

    crossfadeBlockedRef.current = false;

    if (fadingRef.current) {
      console.log(
        "🎵 [ENDED] durante crossfade – apenas limpando player sainte",
      );
      fadingRef.current = false;
      swapActive();
      resetElement(getInactive(), "inactive (ended)");
      enteringAudioRef.current = null;
      fadeIdRef.current++;
      return;
    }

    console.log("🎵 [ENDED] chamando nextSong()");
    nextSong();
  };

  useEffect(() => {
    const handler = () => onEndedFnRef.current();
    playerA.addEventListener("ended", handler);
    playerB.addEventListener("ended", handler);
    logWithTime(`🎧 [EVENT] addEventListener('ended') em ambos players`);
    return () => {
      playerA.removeEventListener("ended", handler);
      playerB.removeEventListener("ended", handler);
      logWithTime(`🧹 [EVENT] removeEventListener('ended')`);
    };
  }, [playerA, playerB]);

  // ---------- CROSSFADE ----------
  function startCrossfade(nextSrc) {
    logWithTime(`🎧 [CROSSFADE] startCrossfade chamado | nextSrc: ${nextSrc}`);
    if (crossfadeBlockedRef.current) {
      logWithTime(`🚫 [CROSSFADE] bloqueado (seek ocorreu)`);
      return false;
    }
    if (fadingRef.current) {
      logWithTime(`🚫 [CROSSFADE] já em andamento`);
      return false;
    }
    if (!usePlayerStore.getState().isPlaying) {
      logWithTime(`🚫 [CROSSFADE] não iniciado porque isPlaying = false`);
      return false;
    }

    logWithTime(`🎧 [CROSSFADE] START | fadeId antes: ${fadeIdRef.current}`);
    fadingRef.current = true;
    const fadeId = ++fadeIdRef.current;

    const entering = getInactive();
    enteringAudioRef.current = entering;

    entering.src = nextSrc;
    entering.currentTime = 0;
    entering.volume = 0;

    entering
      .play()
      .then(() => {
        if (
          fadeId !== fadeIdRef.current ||
          !usePlayerStore.getState().isPlaying
        ) {
          logWithTime(`⛔ stale fade play prevented`);
          entering.pause();
          entering.currentTime = 0;
          entering.removeAttribute("src");
          entering.load();
          enteringAudioRef.current = null;
          return;
        }
        logWithTime(
          `🎧 [CROSSFADE] entering.play() resolved | fadeId=${fadeId}`,
        );
      })
      .catch((e) => logWithTime(`🎧 [CROSSFADE] play error:`, e));

    return true;
  }

  function updateCrossfadeVolumes(remaining, fadeWindow) {
    const active = getActive();
    const entering = getInactive();
    const st = usePlayerStore.getState();

    const alpha = Math.min(1, Math.max(0, 1 - remaining / fadeWindow));
    active.volume = st.volume * (1 - alpha);
    entering.volume = st.volume * alpha;

    logWithTime(
      `🎚️ [VOLUMES] alpha=${alpha.toFixed(
        3,
      )} | active.vol=${active.volume.toFixed(
        3,
      )} | entering.vol=${entering.volume.toFixed(
        3,
      )} | remaining=${remaining.toFixed(2)}s`,
    );

    if (alpha >= 0.99) {
      logWithTime(`🎚️ [VOLUMES] alpha >= 0.99 -> completando crossfade`);
      completeCrossfade();
    }
  }

  function completeCrossfade() {
    logWithTime(`🎧 [CROSSFADE] COMPLETED`);
    fadingRef.current = false;
    crossfadeDoneRef.current = true;

    const leaving = getActive();
    swapActive();

    const nowActive = getActive();
    currentSrcRef.current = nowActive.src;
    logWithTime(
      `🎧 [CROSSFADE] currentSrcRef atualizado para ${currentSrcRef.current}`,
    );

    resetElement(leaving, "leaving (completed)");
    enteringAudioRef.current = null;
    logWithTime(`🎧 [CROSSFADE] chamando nextSong()`);
    nextSong();
  }

  // ---------- TIMEUPDATE ----------
  useEffect(() => {
    const onTimeUpdate = () => {
      const st = usePlayerStore.getState();
      const active = getActive();
      const dur = active.duration;
      const ct = active.currentTime;
      if (usePlayerStore.getState().playerType === "radio") return;

      if (!dur || isNaN(dur) || dur <= 0) return;

      st.setProgress((ct / dur) * 100);
      st.setCurrentTime(ct);
      if (Math.abs(st.duration - dur) > 0.1) st.setDuration(dur);

      const ctInt = Math.floor(ct);
      if (active.lastInt !== ctInt) {
        active.lastInt = ctInt;
        updateMusicControlsElapsed(ct);
      }

      if (crossfadeBlockedRef.current) {
        if (!fadingRef.current) active.volume = st.volume;
        return;
      }

      if (!st.fadeEnabled) {
        if (!fadingRef.current) active.volume = st.volume;
        return;
      }

      const next = st.peekNextSong();
      if (!next?.src || next.src === active.src) {
        if (!fadingRef.current) active.volume = st.volume;
        return;
      }

      // ── GUARD: cancela crossfade se duração da música < fadeDuration ──
      // Usa fadeDuration bruto (sem o cap de 50%) para a verificação —
      // se o usuário pediu 10s de fade e a música tem 8s, não faz fade.
      if (dur <= st.fadeDuration) {
        if (fadingRef.current) {
          logWithTime(
            `⛔ [CROSSFADE] duração (${dur.toFixed(2)}s) <= fadeDuration (${
              st.fadeDuration
            }s) – abortando`,
          );
          abortCrossfade();
        }
        active.volume = st.volume;
        return;
      }

      const fadeWindow = Math.min(st.fadeDuration, dur * 0.5);
      if (fadeWindow <= 0) return;
      const remaining = dur - ct;

      if (remaining > fadeWindow) {
        if (!fadingRef.current) active.volume = st.volume;
        return;
      }

      if (suppressCrossfadeRef.current) {
        logWithTime(
          `⏸️ [TIME] suppressCrossfade ativo – ignorando início de fade`,
        );
        if (!fadingRef.current) active.volume = st.volume;
        return;
      }

      if (!fadingRef.current) {
        logWithTime(
          `⏱️ [TIME] iniciando crossfade: remaining=${remaining.toFixed(
            2,
          )}s | fadeWindow=${fadeWindow}s`,
        );
        const started = startCrossfade(next.src);
        if (!started) return;
      }

      updateCrossfadeVolumes(remaining, fadeWindow);
    };

    playerA.addEventListener("timeupdate", onTimeUpdate);
    playerB.addEventListener("timeupdate", onTimeUpdate);
    logWithTime(`🎧 [EVENT] addEventListener('timeupdate') em ambos players`);
    return () => {
      playerA.removeEventListener("timeupdate", onTimeUpdate);
      playerB.removeEventListener("timeupdate", onTimeUpdate);
      logWithTime(`🧹 [EVENT] removeEventListener('timeupdate')`);
    };
  }, [playerA, playerB, nextSong]);

  // ---------- VOLUME ----------
  useEffect(() => {
    logWithTime(`🔊 [VOLUME] store.volume = ${volume}`);
    if (!fadingRef.current) {
      const active = getActive();
      active.volume = volume;
      logWithTime(`🔊 [VOLUME] volume aplicado no player ativo: ${volume}`);
    } else {
      logWithTime(`🔊 [VOLUME] em crossfade, volume não aplicado diretamente`);
    }
  }, [volume]);

  // ---------- LOAD SONG ----------
  useEffect(() => {
    if (playerType === "radio") {
      return;
    }

    if (crossfadeDoneRef.current) {
      logWithTime(
        `🎧 [LOAD] crossfadeDone ativo – reiniciando flag e ignorando load`,
      );
      crossfadeDoneRef.current = false;
      return;
    }

    if (!currentSong?.src) {
      logWithTime(`🎧 [LOAD] nenhuma música atual – limpando players`);
      abortCrossfade();
      playerA.pause();
      playerB.pause();
      playerA.removeAttribute("src");
      playerB.removeAttribute("src");
      playerA.load();
      playerB.load();
      currentSrcRef.current = null;
      return;
    }

    if (currentSong.src === currentSrcRef.current) {
      logWithTime(
        `🎧 [LOAD] mesma src mas restartSignal=${restartSignal} – reiniciando`,
      );
      abortCrossfade();
      const active = getActive();
      active.currentTime = 0;
      active.volume = usePlayerStore.getState().volume;
      if (isPlaying) active.play().catch(console.error);
      return;
    }

    logWithTime(
      `🎧 [LOAD] nova música | src anterior=${currentSrcRef.current} | nova src=${currentSong.src}`,
    );
    abortCrossfade();
    crossfadeBlockedRef.current = false;
    suppressCrossfadeRef.current = false;
    currentSrcRef.current = currentSong.src;

    const active = getActive();
    active.src = currentSong.src;
    active.load();
    logWithTime(
      `🎧 [LOAD] player ativo (${
        active === playerA ? "A" : "B"
      }) recebeu nova src`,
    );

    active.addEventListener(
      "loadeddata",
      async () => {
        logWithTime(
          `🎧 [LOAD] loadeddata disparado | duration=${active.duration}`,
        );
        if (audioContextRef.current?.state === "suspended") {
          logWithTime(`🎧 [LOAD] AudioContext suspended, tentando resume`);
          await audioContextRef.current.resume();
        }
        if (usePlayerStore.getState().isPlaying) {
          logWithTime(`🎧 [LOAD] autoplay ativo – chamando play()`);
          active.play().catch(console.error);
        }
      },
      { once: true },
    );

    resetElement(getInactive(), "inactive (load)");
  }, [currentSong?.id, currentSong?.src, restartSignal]);

  // ---------- PLAY / PAUSE ----------
  useEffect(() => {
    if (playerType === "radio") {
      return;
    }

    if (!currentSong) {
      logWithTime(`🎧 [PLAY/PAUSE] sem currentSong – ignorando`);
      return;
    }
    if (crossfadeDoneRef.current) {
      logWithTime(`🎧 [PLAY/PAUSE] crossfadeDone ativo – resetando flag`);
      crossfadeDoneRef.current = false;
      return;
    }

    if (isPlaying) {
      usePlayerStore.getState().stopRadioSilently();
      logWithTime(`🎧 [PLAY] solicitado`);
      getActive()
        .play()
        .catch((e) => console.error("🎧 [PLAY] erro:", e));
    } else {
      logWithTime(`🎧 [PAUSE] solicitado`);
      playerA.pause();
      playerB.pause();
    }
  }, [isPlaying, currentSong?.id]);

  // ---------- SEEK ----------
  function seek(percent) {
    logWithTime(
      `🎧 [SEEK] percent=${percent} | currentTime antes=${
        getActive().currentTime
      }`,
    );
    const active = getActive();
    if (!active.duration) {
      logWithTime(`🎧 [SEEK] duração inválida – ignorando`);
      return;
    }

    if (fadingRef.current) {
      logWithTime(
        `🎧 [SEEK] crossfade ativo – abortando e bloqueando temporariamente`,
      );
      abortCrossfade();
      crossfadeBlockedRef.current = true;
      setTimeout(() => {
        crossfadeBlockedRef.current = false;
        logWithTime(`🔓 [CROSSFADE] unblocked after seek (1s)`);
      }, 1000);
    }

    suppressCrossfadeRef.current = true;
    setTimeout(() => {
      suppressCrossfadeRef.current = false;
      logWithTime(`🔓 [SUPPRESS] suppressCrossfade desativado após seek`);
    }, 300);

    const newTime = (percent / 100) * active.duration;
    active.currentTime = newTime;
    const newVolume = usePlayerStore.getState().volume;
    active.volume = newVolume;
    updateMusicControlsElapsed(newTime);
    logWithTime(
      `🎧 [SEEK] novo currentTime=${newTime.toFixed(
        2,
      )}s | volume restaurado para ${newVolume}`,
    );
  }

  // no useAudio, no useEffect do seekSignal:
  useEffect(() => {
    if (seekSignal === 0) return;
    if (seekingRef.current) return;

    const active = getActive();
    if (!active.duration || isNaN(active.duration)) return;

    // CRÍTICO: só executa se o seekTarget é válido para a duração atual
    if (seekTarget >= active.duration) return;

    seekingRef.current = true;
    setTimeout(() => {
      seekingRef.current = false;
    }, 500);

    if (fadingRef.current) {
      abortCrossfade();
      crossfadeBlockedRef.current = true;
      setTimeout(() => {
        crossfadeBlockedRef.current = false;
      }, 1000);
    }

    suppressCrossfadeRef.current = true;
    setTimeout(() => {
      suppressCrossfadeRef.current = false;
    }, 300);

    active.currentTime = seekTarget;
    active.volume = usePlayerStore.getState().volume;
    updateMusicControlsElapsed(seekTarget);
    logWithTime(`⏩ [SEEK_SIGNAL] seekTarget=${seekTarget}s`);
  }, [seekSignal]);

  useEffect(() => {
    seekRef.current = seek;
    logWithTime(`🔗 [HOOK] seekRef.current atribuído`);
  }, []);

  return {};
}
