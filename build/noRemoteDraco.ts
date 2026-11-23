/**
 * drei's useGLTF has a default Draco decoder address on gstatic.com. Extensions cannot load remote
 * code, and no Tabpire model uses Draco, so the address is replaced with a local path that is
 * never requested (every useGLTF call turns Draco off).
 */
export const noRemoteDraco = {
  name: 'tabpire-no-remote-draco',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    if (!id.includes('@react-three/drei') || !code.includes('gstatic.com/draco')) return null;
    return { code: code.replace(/https:\/\/www\.gstatic\.com\/draco\/[^'"`]*/g, '/draco-disabled/'), map: null };
  },
};
