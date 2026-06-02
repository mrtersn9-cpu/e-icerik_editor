import { useEffect, useState } from 'react';

/**
 * Cihaz modu semantiği — masaüstü düzenini bozmadan mobil/tablet kabuğa dallanmak için.
 *
 * Eşikler:
 *   phone   : <= 640px   (tek-el, sade Canva benzeri)
 *   tablet  : 641–1024px (canvas + daraltılabilir sağ sheet)
 *   desktop : > 1024px   (mevcut çok panelli düzen — DEĞİŞMEZ)
 *
 * Not: Masaüstü davranışı yalnızca > 1024px'te geçerlidir; bu, eski
 * `isMobileViewport <= 980` eşiğinden farklıdır ama masaüstü kod yolunu etkilemez.
 */
export const DEVICE_BREAKPOINTS = {
  phone: 640,
  tablet: 1024,
};

export function getDeviceMode(width) {
  const w = Number(width) || 0;
  if (w <= DEVICE_BREAKPOINTS.phone) return 'phone';
  if (w <= DEVICE_BREAKPOINTS.tablet) return 'tablet';
  return 'desktop';
}

export function isTouchDevice(mode) {
  return mode === 'phone' || mode === 'tablet';
}

/*
 * Bağımsız, kendi kendini izleyen hook. EIcerikEditor zaten `viewportWidth`
 * tuttuğu için orada `getDeviceMode(viewportWidth)` tercih edilir (çift dinleyici
 * olmaz). Bu hook, mobil bileşenlerin tek başına kullanması içindir.
 */
export default function useDeviceMode() {
  const [mode, setMode] = useState(() =>
    typeof window === 'undefined' ? 'desktop' : getDeviceMode(window.innerWidth)
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handle = () => setMode(getDeviceMode(window.innerWidth));
    handle();
    window.addEventListener('resize', handle, { passive: true });
    window.addEventListener('orientationchange', handle, { passive: true });
    return () => {
      window.removeEventListener('resize', handle);
      window.removeEventListener('orientationchange', handle);
    };
  }, []);

  return mode;
}
