const PREFIX = 'glucomap-artifact:'

export async function get(key) {
  try {
    const value = window.localStorage.getItem(PREFIX + key)
    return value === null ? null : { value }
  } catch {
    return null
  }
}

export async function set(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, value)
    return { ok: true }
  } catch {
    return { ok: false }
  }
}
