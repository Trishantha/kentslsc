export function nanoid(size = 8): string {
  return Array.from({ length: size }, () => Math.random().toString(36).charAt(2)).join('');
}
