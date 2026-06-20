import styles from './style.module.css'

import { IoSettings } from "react-icons/io5";
import { VscMusic } from "react-icons/vsc";
import { LuListEnd } from "react-icons/lu";
import { PiPlaylistBold } from "react-icons/pi";
import { MdOutlineRadio } from "react-icons/md";

export function TopBar({ setScreen }) {
  return (
    <div className={styles.topBar}>
      <button className={styles.navButton} onClick={() => setScreen('settings')}>
        <IoSettings />
        <span className={styles.navLabel}>Ajustes</span>
      </button>

      <button className={styles.navButton} onClick={() => setScreen('library')}>
        <VscMusic  />
        <span className={styles.navLabel}>Biblioteca</span>
      </button>

      <button className={styles.navButton} onClick={() => setScreen('radio')}>
        <MdOutlineRadio />
        <span className={styles.navLabel}>Radio</span>
      </button>

      <button className={styles.navButton} onClick={() => setScreen('recents')}>
        <LuListEnd />
        <span className={styles.navLabel}>Recentes</span>
      </button>

      <button className={styles.navButton} onClick={() => setScreen('playlists')}>
        <PiPlaylistBold />
        <span className={styles.navLabel}>Playlists</span>
      </button>
    </div>
  )
}