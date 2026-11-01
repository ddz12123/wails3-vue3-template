import { describe, expect, it } from 'vitest';
import { hexToRgbString, mixColor } from '@/utils/color';

describe('color utils', () => {
  it('mixes two colors by weight', () => {
    expect(mixColor('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('keeps the base color for invalid input', () => {
    expect(mixColor('not-a-color', '#ffffff', 0.5)).toBe('not-a-color');
  });

  it('converts hex to an rgb string', () => {
    expect(hexToRgbString('#409eff')).toBe('64, 158, 255');
  });
});
