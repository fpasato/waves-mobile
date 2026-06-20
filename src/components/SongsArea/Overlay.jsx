
import styles from "./style.module.css";

export function Overlay({ open, onClose }) {
  if (!open) return null;
  return <div className={styles.overlay} onClick={onClose} />;
}
