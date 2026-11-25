'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'

import styles from './DeskCat.module.css'

export default function DeskCat() {
  const [visible, setVisible] = useState(false)
  const scene = useRef<HTMLElement>(null)

  useEffect(() => {
    let inView = false
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => {
      setVisible(inView && !document.hidden && !motionPreference.matches)
    }
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting ?? false
      update()
    })
    if (scene.current) observer.observe(scene.current)
    document.addEventListener('visibilitychange', update)
    motionPreference.addEventListener('change', update)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', update)
      motionPreference.removeEventListener('change', update)
    }
  }, [])

  const animated = visible
  return (
    <figure ref={scene} className={styles.scene} data-coding-cat="true">
      <Image
        src={animated ? '/images/desk-cat/coding.gif' : '/images/desk-cat/coding-poster.webp'}
        width={400}
        height={400}
        unoptimized
        className={styles.image}
        alt="CC 猫在电脑前，一只手操作鼠标，另一只手敲键盘"
      />
      <figcaption className={styles.caption}>认真敲代码，努力工作中</figcaption>
    </figure>
  )
}
