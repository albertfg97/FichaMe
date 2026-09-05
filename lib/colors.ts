function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === gn
      ? (bn - rn) / d + 4
      : max === bn
      ? (gn - rn) / d + 2
      : (bn - gn) / d;
  return [(h + 6) % 6, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color);
  };
  return [f(0), f(8), f(4)];
}

export function hexToRgbString(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  return `${r} ${g} ${b}`;
}

export function deriveBrand(hex: string) {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  return {
    DEFAULT: `${r} ${g} ${b}`,
    dark: hslToRgbStr(h, s, Math.max(0, l - 0.12)),
    light: hslToRgbStr(h, s, Math.min(1, l + 0.1)),
    muted: hslToRgbStr(h, Math.max(0, s - 0.25), Math.min(1, l + 0.2)),
  };
}

function hslToRgbStr(h: number, s: number, l: number): string {
  const [r, g, b] = hslToRgb(h, s, l);
  return `${r} ${g} ${b}`;
}
