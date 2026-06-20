import { useState } from "react";
import { Header } from "../../components/Header";
import { PlaybackSettings } from "../../components/PlaybackSettings";
import { DirectoriesSettings } from "../../components/DirectoriesSettings";
import { Tema } from "../../components/Tema";
import styles from "./style.module.css";

export function SettingsScreen({ setScreen }) {
  const [tab, setTab] = useState("directories");

  // Lista de abas — adicione mais conforme necessário
  const tabs = [
    { key: "directories", label: "Diretórios" },
    { key: "crossfade", label: "Crossfade" },
    { key: "tema", label: "Tema" },
    // ...
  ];

  return (
    <div className={styles.settingsScreen}>
      <Header title="Configurações" />

      <div className={styles.container}>
        <nav className={styles.nav}>
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`${styles.tab} ${tab === key ? styles.active : ""}`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className={styles.content}>
          {tab === "directories" && <DirectoriesSettings />}
          {tab === "crossfade" && <PlaybackSettings />}
          {tab === "tema" && <Tema />}
        </div>

        <div className={styles.backButtonWrapper}>
          <button
            onClick={() => setScreen("player")}
            className={`${styles.tab} ${styles.backButton}`}
          >
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}
