import { DEFAULT_PRIMARY_COLOR_RGB } from '@/constant/theme';

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

type Rgb = [number, number, number];

function parseHex(color: string): Rgb | null {
  const match = HEX_PATTERN.exec(color.trim());
  if (!match) {
    return null;
  }

  const short = match[1];
  if (!short) {
    return null;
  }

  let hex = short;
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((char) => char + char)
      .join('');
  }

  const value = Number.parseInt(hex, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function toHex(rgb: Rgb): string {
  return `#${rgb.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function clamp(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

/**
 * 按权重混合两种颜色。
 * @param color 基础色
 * @param target 目标色
 * @param weight 目标色占比（0 ~ 1）
 */
export function mixColor(color: string, target: string, weight: number): string {
  const from = parseHex(color);
  const to = parseHex(target);
  if (!from || !to) {
    return color;
  }

  const ratio = Math.min(1, Math.max(0, weight));
  const mixed: Rgb = [
    clamp(from[0] + (to[0] - from[0]) * ratio),
    clamp(from[1] + (to[1] - from[1]) * ratio),
    clamp(from[2] + (to[2] - from[2]) * ratio),
  ];

  return toHex(mixed);
}

/** 十六进制颜色转 "r, g, b" 字符串，供 rgba() 使用 */
export function hexToRgbString(color: string): string {
  const rgb = parseHex(color);
  return rgb ? rgb.join(', ') : DEFAULT_PRIMARY_COLOR_RGB;
}

/**
 * 将主色写入 CSS 变量。
 *
 * Element Plus 的浅色梯度（light-3/5/7/8/9）默认来自 SCSS 编译产物，
 * 运行时切换主题色时必须同步覆盖这些变量，否则按钮 hover/disabled 等状态仍是旧颜色。
 */
export function applyPrimaryColor(color: string, isDark = false): void {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  const mixTarget = isDark ? '#141414' : '#ffffff';

  root.style.setProperty('--el-color-primary', color);
  root.style.setProperty('--el-color-primary-dark-2', mixColor(color, '#000000', 0.2));

  (
    [
      ['light-3', 0.3],
      ['light-5', 0.5],
      ['light-7', 0.7],
      ['light-8', 0.8],
      ['light-9', 0.9],
    ] as const
  ).forEach(([level, weight]) => {
    root.style.setProperty(`--el-color-primary-${level}`, mixColor(color, mixTarget, weight));
  });

  // 供业务样式使用的自定义变量
  root.style.setProperty('--app-primary-color', color);
  root.style.setProperty('--app-primary-color-rgb', hexToRgbString(color));
}
