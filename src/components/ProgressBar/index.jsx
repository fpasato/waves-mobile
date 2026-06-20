import styles from "./style.module.css";
import { usePlayer } from "../../store/PlayerContext";
import { useRef, useState, useEffect, useCallback } from "react";
import { useAnalyser } from "../../hooks/useAnalyser";

export function ProgressBar() {
  const { audioRef, crossfadeAudioRef, analyserRef, activeAudioRef, seekRef } =
    usePlayer();

  const [time, setTime] = useState({ current: 0, duration: 0 });
  const barRef = useRef(null);
  const canvasRef = useRef(null);
  const draggingRef = useRef(false);
  const [dragPercent, setDragPercent] = useState(null);
  const displayPercentRef = useRef(0);

  // ── CACHE DAS CORES DO ACCENT (duas cores) ──
  const accentCacheRef = useRef({ accent1: "", accent2: "" });

  useEffect(() => {
    const update = () => {
      const style = getComputedStyle(document.body);
      accentCacheRef.current = {
        accent1: style.getPropertyValue("--accent1").trim() || "#FFDFB9",
        accent2: style.getPropertyValue("--accent2").trim() || "#A4193D",
      };
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    return () => observer.disconnect();
  }, []);

  // ── PERCENTUAL ATUAL (para barra e canvas) ──
  const localPercent =
    time.duration > 0 ? (time.current / time.duration) * 100 : 0;
  const displayPercent = dragPercent !== null ? dragPercent : localPercent;

  useEffect(() => {
    displayPercentRef.current = displayPercent;
  }, [displayPercent]);

  // ── TIMEUPDATE ──
  useEffect(() => {
    const onTime = () => {
      const active = activeAudioRef.current;
      if (!active) return;
      const dur = active.duration || 0;
      const ct = active.currentTime || 0;
      if (!isNaN(dur) && !isNaN(ct)) {
        setTime({ current: ct, duration: dur });
      }
    };
    const a = audioRef.current;
    const b = crossfadeAudioRef.current;
    a?.addEventListener("timeupdate", onTime);
    b?.addEventListener("timeupdate", onTime);
    return () => {
      a?.removeEventListener("timeupdate", onTime);
      b?.removeEventListener("timeupdate", onTime);
    };
  }, [activeAudioRef, audioRef, crossfadeAudioRef]);

  // ── CANVAS / WAVEBARS (com gradiente das duas cores) ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const totalBars = 90;
    const half = totalBars / 2;
    const maxIndex = 70;
    const smoothedHeights = new Float32Array(totalBars);
    const smoothing = 0.7;

    let canvasW = 0;
    let canvasH = 0;

    const resizeCanvas = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      canvasW = canvas.width;
      canvasH = canvas.height;
    };

    resizeCanvas();
    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas);

    const mapIndex = (pos, isLeft) => {
      const t = pos / (half - 1);
      const idx = isLeft ? (1 - t) * maxIndex : t * maxIndex;
      return Math.min(maxIndex, Math.max(0, Math.floor(idx)));
    };

    let rafId = null;

    const draw = () => {
      const w = canvasW;
      const h = canvasH;

      if (w < 10 || h < 10) {
        rafId = requestAnimationFrame(draw);
        return;
      }

      const analyser = analyserRef.current;
      ctx.clearRect(0, 0, w, h);

      let dataArray = null;
      if (analyser) {
        if (
          !analyser._buf ||
          analyser._buf.length !== analyser.frequencyBinCount
        ) {
          analyser._buf = new Uint8Array(analyser.frequencyBinCount);
        }
        dataArray = analyser._buf;
        analyser.getByteFrequencyData(dataArray);
      }

      const { accent1, accent2 } = accentCacheRef.current;
      const barWidth = w / totalBars;
      const actualBarWidth = Math.max(1, barWidth * 0.75);
      const maxBarHeight = h * 0.75;
      const currentPercent = displayPercentRef.current;

      // Gradiente horizontal entre as duas cores
      const gradient = ctx.createLinearGradient(0, 0, w, 0);
      gradient.addColorStop(0, accent1);
      gradient.addColorStop(1, accent2);

      ctx.shadowColor = accent1;
      ctx.shadowBlur = Math.max(10, Math.min(30, w * 0.04));

      for (let i = 0; i < totalBars; i++) {
        const isLeft = i < half;
        const idx = mapIndex(isLeft ? i : i - half, isLeft);
        const raw = dataArray ? dataArray[idx] : 0;
        const targetHeight = Math.max(4, (raw / 255) * maxBarHeight);

        smoothedHeights[i] =
          smoothedHeights[i] * smoothing + targetHeight * (1 - smoothing);

        const isPlayed = (i / totalBars) * 100 < currentPercent;
        ctx.globalAlpha = isPlayed ? 0.9 : 0.2;
        ctx.fillStyle = gradient;

        const xPos = i * barWidth + (barWidth - actualBarWidth) / 2;
        ctx.fillRect(
          xPos,
          h - smoothedHeights[i],
          actualBarWidth,
          smoothedHeights[i],
        );
      }

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      rafId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, [analyserRef]);

  // ── HELPERS ──
  function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  const getPercent = useCallback((clientX) => {
    const bar = barRef.current;
    if (!bar) return null;
    const rect = bar.getBoundingClientRect();
    let percent = ((clientX - rect.left) / rect.width) * 100;
    return Math.max(0, Math.min(100, percent));
  }, []);

  const commitSeek = useCallback(
    (percent) => {
      if (percent == null) return;
      const active = activeAudioRef.current;
      if (active && isFinite(active.duration) && active.duration > 0) {
        seekRef.current?.(percent);
      }
      setDragPercent(null);
      draggingRef.current = false;
    },
    [activeAudioRef, seekRef],
  );

  // ── MOUSE EVENTS ──
  function handleMouseDown(e) {
    e.preventDefault();
    draggingRef.current = true;
    const p = getPercent(e.clientX);
    setDragPercent(p);
  }

  function handleMouseMove(e) {
    if (!draggingRef.current) return;
    const p = getPercent(e.clientX);
    setDragPercent(p);
  }

  function handleMouseUp(e) {
    if (!draggingRef.current) return;
    const p = getPercent(e.clientX);
    commitSeek(p ?? dragPercent);
  }

  // ── TOUCH EVENTS ──
  function handleTouchStart(e) {
    draggingRef.current = true;
    const p = getPercent(e.touches[0].clientX);
    setDragPercent(p);
  }

  function handleTouchEnd(e) {
    if (!draggingRef.current) return;
    const touch = e.changedTouches[0];
    const p = touch ? getPercent(touch.clientX) : dragPercent;
    commitSeek(p ?? dragPercent);
  }

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const onTouchMove = (e) => {
      if (!draggingRef.current) return;
      e.preventDefault();
      const p = getPercent(e.touches[0].clientX);
      setDragPercent(p);
    };
    bar.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => bar.removeEventListener("touchmove", onTouchMove);
  }, [getPercent]);

  return (
    <div
      className={styles.progressBar}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchEnd={handleTouchEnd}
      data-swipe-ignore="true"
    >
      <canvas ref={canvasRef} className={styles.wavebars} />

      <div
        ref={barRef}
        className={styles.bar}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div className={styles.track}>
          <div
            className={styles.progress}
            style={{ width: `${displayPercent}%` }}
          />
          <div
            className={styles.thumb}
            style={{ left: `${displayPercent}%` }}
          />
        </div>
      </div>

      <div className={styles.time}>
        <span>{formatTime(time.current)}</span>
        <span>{formatTime(time.duration)}</span>
      </div>
    </div>
  );
}