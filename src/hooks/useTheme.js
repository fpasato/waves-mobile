import { useState, useEffect } from "react";

export const TEMAS = [
  { accent1: "#2ECC71", accent2: "#27AE60" }, // verde
  { accent1: "#F1C40F", accent2: "#F39C12" }, // amarelo
  { accent1: "#E74C3C", accent2: "#C0392B" }, // vermelho
  { accent1: "#3498DB", accent2: "#2980B9" }, // azul
  { accent1: "#9B59B6", accent2: "#8E44AD" }, // roxo
  { accent1: "#141414ff", accent2: "#818287ff" }, // roxo

  // Combinações variadas
  { accent1: "#00E5FF", accent2: "#7B2FF7" }, // ciano & violeta
  { accent1: "#FF4D6D", accent2: "#00C896" }, // coral & jade
  { accent1: "#FFDFB9", accent2: "#A4193D" }, // pink & púrpura
  { accent1: "#06D6A0", accent2: "#FFD60A" }, // menta & amarelo
  { accent1: "#00B4D8", accent2: "#FF5400" }, // oceano & laranja queimado
  { accent1: "#8AC926", accent2: "#6A00F4" }, // lima & roxo
];

const STORAGE_KEY = "tema-ativo";
const STYLE_TAG_ID = "tema-dinamico";

function aplicarCSSVariaveis(tema) {
  let tag = document.getElementById(STYLE_TAG_ID);
  if (!tag) {
    tag = document.createElement("style");
    tag.id = STYLE_TAG_ID;
    document.head.appendChild(tag);
  }
  tag.textContent = `
    .dark {
      --accent1: ${tema.accent1} !important;
      --accent2: ${tema.accent2} !important;
    }
  `;
}

export function useTheme() {
  const [temaAtivo, setTemaAtivo] = useState(() => {
    const salvo = localStorage.getItem(STORAGE_KEY);
    const index = salvo !== null ? Number(salvo) : 0;
    // Garante que o índice salvo ainda existe no array
    return index >= 0 && index < TEMAS.length ? index : 0;
  });

  useEffect(() => {
    aplicarCSSVariaveis(TEMAS[temaAtivo]);
  }, []);

  function mudarTema(index) {
    aplicarCSSVariaveis(TEMAS[index]);
    setTemaAtivo(index);
    localStorage.setItem(STORAGE_KEY, String(index));
    window.dispatchEvent(new CustomEvent("tema-mudou"));
  }

  return { temaAtivo, mudarTema, temas: TEMAS };
}
