import styles from './style.module.css'

export function Button({ title, onClick, className = '' }) {
  return (
    <button
      className={`${styles.buttonpattern} ${className}`}
      onClick={onClick}
    >
      {title}
    </button>
  )
}