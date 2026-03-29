// ─── HeroBanner ───────────────────────────────────────────────────────────────
// Navigation bar used on the Home page (non-sticky, sits above the carousel).
// Delegates entirely to Header with sticky=false to avoid duplication.
import Header from '../Header/Header'

export default function HeroBanner() {
  return <Header sticky={false} />
}
