/** Maps backend lucide-style icon names to emoji (keeps the app dependency-free). */
const ICONS: Record<string, string> = {
  users: '👥', shield: '🛡️', key: '🔑', history: '🕘',
  school: '🏫', calendar: '📅', 'calendar-range': '🗓️', 'calendar-days': '📆',
  book: '📘', 'book-open': '📖', 'layout-grid': '🔳', 'door-open': '🚪',
  archive: '🗄️', 'graduation-cap': '🎓', 'file-text': '📄', briefcase: '💼',
  link: '🔗', 'user-plus': '➕', clock: '🕐', folder: '📁', 'check-square': '✅',
  pencil: '✏️', 'file-badge': '🪪', 'book-marked': '📑', 'list-checks': '🗒️',
  receipt: '🧾', 'credit-card': '💳', wallet: '👛', 'book-text': '📚',
  fingerprint: '🔏', plane: '✈️', package: '📦', bell: '🔔',
  'layout-dashboard': '📊',
}

export function icon(name: string): string {
  return ICONS[name] ?? '•'
}
