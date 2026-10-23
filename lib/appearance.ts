import type { CSSProperties } from "react";

export const defaultAccent = "#059669";
export const accentPresets = [
  { name: "Emerald", color: defaultAccent },
  { name: "Ocean", color: "#0284c7" },
  { name: "Violet", color: "#7c3aed" },
  { name: "Rose", color: "#e11d48" },
  { name: "Amber", color: "#d97706" },
] as const;

export function isAccentColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

// Keep the user's chosen hue. Derive light/dark shades with readable contrast,
// even for very pale, yellow, white or black custom colors.
export function accentVariables(color: string): CSSProperties {
  if (!isAccentColor(color) || color.toLowerCase() === defaultAccent) return {};
  const channels = [1, 3, 5].map(
    (index) => parseInt(color.slice(index, index + 2), 16) / 255,
  );
  const max = Math.max(...channels),
    min = Math.min(...channels),
    delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0;
  if (delta) {
    if (max === channels[0]) hue = ((channels[1] - channels[2]) / delta) % 6;
    else if (max === channels[1]) hue = (channels[2] - channels[0]) / delta + 2;
    else hue = (channels[0] - channels[1]) / delta + 4;
    hue = (hue * 60 + 360) % 360;
  }
  const saturation =
    delta === 0
      ? 0
      : Math.min(
          85,
          Math.max(30, (delta / (1 - Math.abs(2 * lightness - 1))) * 100),
        );
  const shades: Record<number, number> = {
    50: 97,
    100: 93,
    200: 85,
    300: 75,
    400: 60,
    500: 38,
    600: 28,
    700: 23,
    800: 18,
    900: 13,
    950: 8,
  };
  return Object.fromEntries(
    Object.entries(shades).map(([shade, level]) => [
      `--color-emerald-${shade}`,
      `hsl(${hue.toFixed(1)} ${saturation.toFixed(1)}% ${level}%)`,
    ]),
  ) as CSSProperties;
}
