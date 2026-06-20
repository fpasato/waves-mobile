import styles from "./style.module.css";
import { useTheme } from "../../hooks/useTheme";

export function Tema() {
  const { temaAtivo, mudarTema, temas } = useTheme();

  return (
    <div className={styles.TemaContainer}>
      {temas.map((tema, index) => (
        <button
          key={index}
          className={`${styles.TemaQuadrado} ${temaAtivo === index ? styles.ativo : ""}`}
          onClick={() => mudarTema(index)}
          aria-label={`Tema ${index + 1}: ${tema.accent1} e ${tema.accent2}`}
          title={`${tema.accent1} / ${tema.accent2}`}
        >
          <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
            <polygon points="0,0 40,0 0,40" fill={tema.accent1} />
            <polygon points="40,0 40,40 0,40" fill={tema.accent2} />
          </svg>
        </button>
      ))}
    </div>
  );
}