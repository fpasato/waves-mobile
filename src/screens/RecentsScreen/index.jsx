import { useEffect, useState } from "react";
import { Header } from "../../components/Header";
import { Button } from "../../components/Button";
import { api } from "../../database/database"; // ajuste o caminho se necessário
import styles from "./style.module.css";

// Substitua sua função groupByDay e o timeBadge pelo código abaixo

function parseDate(str) {
  if (!str) return new Date(NaN);
  return new Date(str.replace(" ", "T"));
}

function groupByDay(recents) {
  const groups = {};
  for (const song of recents) {
    const date = parseDate(song.played_at);
    const key = date.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
    if (!groups[key]) groups[key] = [];
    groups[key].push(song);
  }
  return Object.entries(groups);
}

export function RecentScreen({ setScreen }) {
  const [recents, setRecents] = useState([]);
  const [expandedDays, setExpandedDays] = useState({});

  const toggleDay = (day) => {
    setExpandedDays((prev) => ({ ...prev, [day]: !prev[day] }));
  };

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
      <Header title="Recentes" />

      <div className={styles.topActions}>
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
              <div 
                className={styles.dayHeaderAccordion} 
                onClick={() => toggleDay(day)}
                style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', padding: '0.5rem 0' }}
              >
                <div className={styles.dayHeader} style={{ marginBottom: 0 }}>
                  <span className={styles.dayDot} />
                  <h2 className={styles.dayLabel}>{day}</h2>
                </div>
                <span style={{ color: 'var(--text)', opacity: 0.7 }}>
                  {expandedDays[day] ? "▼" : "▲"}
                </span>
              </div>
              
              {!expandedDays[day] && (
                <div className={styles.songs}>
                  {songs.map((song, i) => (
                    <div className={styles.songRow} key={`${song.id}-${i}`}>
                      <div className={styles.timelineDot} />
                      <div className={styles.songCard}>
                        <div className={styles.timeBadge}>
                          {parseDate(song.played_at).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
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
              )}
            </div>
          ))}
        </div>
      )}

      <div className={styles.backButtonWrapper}>
        <button
          onClick={() => setScreen("player")}
          className={styles.backButton}
        >
          Voltar
        </button>
      </div>
    </div>
  );
}
