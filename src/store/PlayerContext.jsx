/**
 * PlayerContext.jsx
 * Contexto de player de áudio — mesma API que antes.
 *
 * No Android via Capacitor, o <audio> do navegador funciona normalmente
 * dentro da WebView para arquivos locais acessíveis via URI (file:// ou
 * content://). Para caminhos do sistema de arquivos, converta para URI
 * com Filesystem.getUri() antes de atribuir ao src do Audio.
 *
 * Exemplo de uso ao tocar uma música:
 *   import { Filesystem } from "@capacitor/filesystem";
 *   const { uri } = await Filesystem.getUri({ path: song.path });
 *   audioRef.current.src = uri;
 *   audioRef.current.play();
 */

import { createContext, useContext, useRef } from "react";

const PlayerContext = createContext(null);

export function PlayerProvider({ children }) {
  // Elemento de áudio principal
  const audioRef          = useRef(new Audio());

  // Elemento de áudio para crossfade
  const crossfadeAudioRef = useRef(new Audio());

  // Último src carregado (evita recarregar o mesmo arquivo)
  const currentSrcRef     = useRef(null);

  // Web Audio API — analyser para visualizações
  const analyserRef       = useRef(null);

  // Web Audio API — contexto (criado lazily na primeira interação)
  const audioContextRef   = useRef(null);

  // Qual dos dois Audio está ativo no momento (audioRef ou crossfadeAudioRef)
  const activeAudioRef    = useRef(null);

  // Flag para evitar sobreposição de fades
  const fadingRef         = useRef(false);

  // Flag para indicar que o crossfade já terminou
  const crossfadeDoneRef  = useRef(false);

  // Ref para seek pendente (posição em segundos a setar após metadata carregada)
  const seekRef           = useRef(null);

  return (
    <PlayerContext.Provider
      value={{
        audioRef,
        crossfadeAudioRef,
        currentSrcRef,
        analyserRef,
        audioContextRef,
        activeAudioRef,
        fadingRef,
        crossfadeDoneRef,
        seekRef,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  return useContext(PlayerContext);
}