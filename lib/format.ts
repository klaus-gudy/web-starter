const count = new Intl.NumberFormat()

export function formatCount(value: number) {
  return count.format(value)
}
