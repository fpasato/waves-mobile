// components/SongsArea/index.jsx
import { useBottomSheetDrag } from "../../hooks/useBottomSheetDrag";
import { Overlay } from "./Overlay";
import styles from "./style.module.css";
import { usePlayerStore } from "../../store/playerStore";
import { Button } from "../../components/Button";

import { FaMinusCircle } from "react-icons/fa";
import { useEffect } from "react";
import { App as CapacitorApp } from "@capacitor/app";

export function SongsArea({ open, onOpenChange }) {
  const { queue, clearQueue, stop, removeFromQueue } = usePlayerStore();
  const { handleDragStart, getTransform, transition } = useBottomSheetDrag({
    open,
    onOpenChange,
    closeThreshold: 120,
  });

  const isSheetOpen = usePlayerStore((state) => state.isSheetOpen);
  const setSheetOpen = usePlayerStore((state) => state.setSheetOpen);

  const toggleSheet = () => {
    setSheetOpen(!isSheetOpen);
    onOpenChange?.(!isSheetOpen);
  };

  useEffect(() => {
    if (!open) return; // só escuta quando o sheet está aberto

    const handler = CapacitorApp.addListener("backButton", () => {
      onOpenChange(false); // fecha o sheet
      // Não chama mais nada – impede que o evento propague para o PlayerApp
    });

    return () => {
      handler.remove();
    };
  }, [open, onOpenChange]);

  
  const commonProps = {
    className: styles.songsArea,
    style: {
      transform: getTransform(),
      transition,
    },
  };

  const content = (
    <div {...commonProps}>
      <div
        className={styles.handle}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        onClick={toggleSheet}
      />
      <h1>Fila de Reprodução</h1>
      {queue.length === 0 ? (
        <div className={styles.emptyState}>
          <p>A fila está vazia</p>
        </div>
      ) : (
        <>
          <div className={styles.songsList}>
            {queue.map((track, index) => (
              <div key={track.id ?? index} className={styles.songItem}>
                <h2 className={styles.songTitle}>{track.title}</h2>
                <Button
                  title={<FaMinusCircle />}
                  onClick={() => {
                    stop();
                    removeFromQueue(index);
                  }}
                />
              </div>
            ))}
          </div>

          <div className={styles.clearButton}>
            <Button
              title="Limpar Fila e Parar Música"
              onClick={() => {
                clearQueue();
                stop();
              }}
            />
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      <Overlay open={open} onClose={() => onOpenChange(false)} />
      {content}
    </>
  );
}
