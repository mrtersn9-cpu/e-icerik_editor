import { getDeviceMode, isTouchDevice, DEVICE_BREAKPOINTS } from '../mobile/useDeviceMode';

describe('getDeviceMode', () => {
  test('phone at or below 640px', () => {
    expect(getDeviceMode(320)).toBe('phone');
    expect(getDeviceMode(390)).toBe('phone');
    expect(getDeviceMode(DEVICE_BREAKPOINTS.phone)).toBe('phone');
  });

  test('tablet between 641 and 1024px', () => {
    expect(getDeviceMode(641)).toBe('tablet');
    expect(getDeviceMode(820)).toBe('tablet');
    expect(getDeviceMode(DEVICE_BREAKPOINTS.tablet)).toBe('tablet');
  });

  test('desktop above 1024px (masaüstü kod yolu)', () => {
    expect(getDeviceMode(1025)).toBe('desktop');
    expect(getDeviceMode(1440)).toBe('desktop');
    expect(getDeviceMode(1920)).toBe('desktop');
  });

  test('isTouchDevice yalnızca telefon/tablet için true', () => {
    expect(isTouchDevice('phone')).toBe(true);
    expect(isTouchDevice('tablet')).toBe(true);
    expect(isTouchDevice('desktop')).toBe(false);
  });
});
