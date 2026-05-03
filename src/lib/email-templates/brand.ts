/**
 * Shared brand styles for all email templates (auth + transactional).
 * Body must always be white (#ffffff). Accents use the terminal's amber
 * primary and slate text palette to match the in-app aesthetic.
 */
export const SITE_NAME = 'Global Equity Terminal'

export const main = {
  backgroundColor: '#ffffff',
  fontFamily: 'Inter, Arial, sans-serif',
}
export const container = { padding: '32px 28px', maxWidth: '560px' }
export const brand = {
  fontFamily: 'JetBrains Mono, ui-monospace, monospace',
  fontSize: '11px',
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  color: '#b45309', // amber-700
  margin: '0 0 18px',
}
export const h1 = {
  fontSize: '22px',
  fontWeight: 700 as const,
  color: '#0f172a',
  margin: '0 0 16px',
  lineHeight: '1.3',
}
export const text = {
  fontSize: '14px',
  color: '#334155',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
export const link = { color: '#b45309', textDecoration: 'underline' }
export const button = {
  backgroundColor: '#f59e0b', // amber-500 — terminal primary
  color: '#0f172a',
  fontSize: '14px',
  fontWeight: 600 as const,
  borderRadius: '6px',
  padding: '12px 22px',
  textDecoration: 'none',
  display: 'inline-block',
}
export const code = {
  fontFamily: 'JetBrains Mono, ui-monospace, monospace',
  fontSize: '24px',
  fontWeight: 700 as const,
  letterSpacing: '0.18em',
  color: '#0f172a',
  background: '#fef3c7', // amber-100
  borderRadius: '6px',
  padding: '14px 18px',
  display: 'inline-block',
  margin: '0 0 24px',
}
export const hr = {
  borderColor: '#e2e8f0',
  borderStyle: 'solid' as const,
  borderWidth: '0 0 1px 0',
  margin: '24px 0',
}
export const footer = {
  fontSize: '11px',
  color: '#94a3b8',
  lineHeight: '1.5',
  margin: '24px 0 0',
}
