import { useEffect, useState } from "react";
import { Header } from "../../components/Header";
import { Button } from "../../components/Button";
import { api } from "../../database/database"; // ajuste o caminho se necessário
import styles from "./style.module.css";

function groupByDay(recents) {
  const groups = {};
  for (const song of recents) {
    const date = new Date(song.played_at + "Z");
    const key = date.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long"
    });
    if (!groups[key]) groups[key] = [];
    groups[key].push(song);
  }
  return Object.entries(groups);
}

export function RecentScreen({ setScreen }) {
  const [recents, setRecents] = useState([]);

  const fetchRecents = async () => {
    const data = await api.db.recents.list(100);
    setRecents(data);
  };

  useEffect(() => {
    fetchRecents();
  }, []);

  const handleClear = async () => {
    await api.db.recents.clear();
    setRecents([]);
  };

  const groups = groupByDay(recents);

  return (
    <div className={styles.container}>
      <Header title="Tocados Recentemente" />

      <div className={styles.topActions}>
        <Button
          title="Voltar"
          onClick={() => setScreen("player")}
          className={styles.actionButton}
        />
        <Button
          title="Limpar registros"
          onClick={handleClear}
          className={styles.actionButton}
        />
      </div>

      {groups.length === 0 ? (
        <p className={styles.empty}>Nenhuma música tocada ainda.</p>
      ) : (
        <div className={styles.timeline}>
          {groups.map(([day, songs]) => (
            <div key={day} className={styles.dayGroup}>
              <div className={styles.dayHeader}>
                <span className={styles.dayDot} />
                <h2 className={styles.dayLabel}>{day}</h2>
              </div>
              <div className={styles.songs}>
                {songs.map((song, i) => (
                  <div className={styles.songRow} key={`${song.id}-${i}`}>
                    <div className={styles.timelineDot} />
                    <div className={styles.songCard}>
                      <div className={styles.timeBadge}>
                        {new Date(song.played_at).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </div>
                      <div className={styles.meta}>
                        <h3 className={styles.title}>{song.title}</h3>
                        <p className={styles.artist}>{song.artist}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}