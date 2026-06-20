// src/renderer/src/utils/randomCover.js

const covers = import.meta.glob('../assets/images/*.{jpg,jpeg,png,webp}', { eager: true })
const coverList = Object.values(covers).map(m => m.default)

export function randomCover(seed) {
  const index = seed
    ? [...seed].reduce((acc, c) => acc + c.charCodeAt(0), 0) % coverList.length
    : Math.floor(Math.random() * coverList.length)
  return coverList[index]
}