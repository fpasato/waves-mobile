import { useRef, useEffect, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Mousewheel } from "swiper/modules";
import { usePlayerStore } from "../../store/playerStore";
import styles from "./style.module.css";
import "swiper/css";

export function SongQueueStack() {
  const currentSong = usePlayerStore((s) => s.currentSong);
  const queue       = usePlayerStore((s) => s.queue);
  const queueIndex  = usePlayerStore((s) => s.queueIndex);
  const repeat      = usePlayerStore((s) => s.repeat);
  const playSong    = usePlayerStore((s) => s.playSong);

  const queueKey     = queue.map((s) => s.id).join(",");
  const swiperRef    = useRef(null);
  const userSwiped   = useRef(false); // true quando foi o usuário que moveu
  const initialSlide = repeat ? queue.length + queueIndex : queueIndex;

  const [activeSlide, setActiveSlide] = useState(initialSlide);
  const slides = repeat ? [...queue, ...queue, ...queue] : queue;

  // Só sincroniza quando a mudança veio de FORA (next/prev/shuffle)
  useEffect(() => {
    const swiper = swiperRef.current;
    if (!swiper) return;
    if (userSwiped.current) {
      userSwiped.current = false;
      return;
    }
    const target = repeat ? queue.length + queueIndex : queueIndex;
    swiper.slideTo(target, 0);
    setActiveSlide(target);
  }, [queueIndex]); // eslint-disable-line

  const handleSlideChange = (swiper) => {
    const active = swiper.activeIndex;
    const n      = queue.length;

    setActiveSlide(active);

    if (repeat) {
      if (active < Math.floor(n / 2)) {
        const corrected = active + n;
        swiper.slideTo(corrected, 0);
        setActiveSlide(corrected);
        return;
      }
      if (active >= Math.ceil(n * 2.5)) {
        const corrected = active - n;
        swiper.slideTo(corrected, 0);
        setActiveSlide(corrected);
        return;
      }

      const realIndex = active % n;
      const song = queue[realIndex];
      if (song && song.id !== currentSong?.id) {
        userSwiped.current = true; // sinaliza que foi o usuário
        playSong(song, queue);
      }
    } else {
      const song = queue[active];
      if (song && song.id !== currentSong?.id) {
        userSwiped.current = true;
        playSong(song, queue);
      }
    }
  };

  if (!currentSong || queue.length === 0) {
    return (
      <div className={styles.stack}>
        <div className={styles.empty}>
          <svg className={styles.emptyIcon} viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
          <span className={styles.emptyTitle}>Nenhuma música tocando</span>
          <span className={styles.emptySubtitle}>Escolha uma música para começar</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.stack}>
      <Swiper
        key={`${repeat ? "loop" : "linear"}-${queueKey}`}
        onSwiper={(swiper) => {
          swiperRef.current = swiper;
          setActiveSlide(initialSlide);
        }}
        direction="vertical"
        centeredSlides={true}
        slidesPerView={3}
        initialSlide={initialSlide}
        mousewheel={{ sensitivity: 1, forceToAxis: true }}
        modules={[Mousewheel]}
        className={styles.track}
        onSlideChange={handleSlideChange}
      >
        {slides.map((song, i) => {
          const isCurrent = i === activeSlide;
          return (
            <SwiperSlide key={`${song.id}-${i}`} className={styles.slideWrapper}>
              <div className={`${styles.card} ${isCurrent ? styles.current : styles.neighbor}`}>
                <span className={styles.title}>{song.title}</span>
                {song.artist && (
                  <span className={styles.artist}>{song.artist}</span>
                )}
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
}