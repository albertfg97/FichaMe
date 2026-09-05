function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === g
      ? (b - r) / d + 4
      : max === b
      ? (g - r) / d + 2
      : (b - g) / d;
  return [(h + 6) % 6, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function deriveBrand(hex: string) {
  const [h, s, l] = hexToHsl(hex);
  return {
    DEFAULT: hex,
    dark: hslToHex(h, s, Math.max(0, l - 0.12)),
    light: hslToHex(h, s, Math.min(1, l + 0.1)),
    muted: hslToHex(h, Math.max(0, s - 0.25), Math.min(1, l + 0.2)),
  };
}
