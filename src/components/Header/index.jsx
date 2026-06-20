import styles from './style.module.css'


export function Header({ title }) {
    return (
        <header className={styles.header} >
            <h1>{title}</h1>
        </header>
    )
}