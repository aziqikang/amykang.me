const KEY = 'amykang.cabo.name'

export function loadName(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveName(name: string) {
  try {
    localStorage.setItem(KEY, name.trim())
  } catch {
    // Only saves retyping it next time.
  }
}
