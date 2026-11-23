/** Address of a file in public/, valid in the extension, the dev server and a sub-path deploy. */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/'; // '/' in the extension and tests, './' in the demo
  return base + path.replace(/^\/+/, '');
}
