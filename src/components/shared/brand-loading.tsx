import Image from 'next/image'
import styles from './brand-loading.module.css'

export function BrandLoading({ title }: { title: string }) {
  return (
    <div className={styles.screen} role="status" aria-live="polite" data-testid="public-brand-loading">
      <div className={styles.center}>
        <Image src="/logo new-athlete-school.jpg" alt="" width={76} height={76} className={styles.logo} />
        <div className={styles.name}>New Athlete <span>School</span></div>
        <div className={styles.subtitle}>BADMINTON SCHOOL</div>
        <div className={styles.track} aria-hidden="true"><span /></div>
        <p className={styles.caption}>{title}</p>
        <div className={styles.dots} aria-hidden="true"><span /><span /><span /></div>
      </div>
    </div>
  )
}
