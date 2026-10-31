/** Generate UUIDs on HTTPS and on plain HTTP used for local network testing. */
export function createId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()

  // getRandomValues is also available outside secure contexts.
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte, index) => {
    if (index === 6) return ((byte & 0x0f) | 0x40).toString(16)
    if (index === 8) return ((byte & 0x3f) | 0x80).toString(16)
    return byte.toString(16).padStart(2, '0')
  }).join('')

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
