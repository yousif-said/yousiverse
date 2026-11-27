/** A hue (0 to 359) that is always the same for the same text: for avatars and other marks. */
export function hueOf(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // The low bits of this hash barely change between similar names; mix them before use.
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 2246822507);
  hash ^= hash >>> 13;
  return (hash >>> 0) % 360;
}
