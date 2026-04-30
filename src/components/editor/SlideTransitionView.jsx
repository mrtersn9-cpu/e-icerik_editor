import React, { useState, useEffect } from 'react';

const _injectedTransitionKeyframes = new Set();
function injectTransitionKeyframes(name, from, to) {
  if (_injectedTransitionKeyframes.has(name)) return name;
  _injectedTransitionKeyframes.add(name);
  const style = document.createElement('style');
  style.textContent = `@keyframes ${name}{from{${from}}to{${to}}}`;
  document.head.appendChild(style);
  return name;
}

const TTKB_SAFE_TRANSITION_EFFECT_ALIASES = {
  morph: 'fade',
  dissolve: 'fade',
  pixelate: 'fade',
  glitter: 'fade',
  shatter: 'fade',
  vortex: 'fade',
  newspaper: 'fade',
  spin: 'fade',
  bounce: 'fade',
  swing: 'slide-down',
  drop: 'slide-down',
  'zoom-rotate': 'zoom-in',
  'flip-horizontal': 'fade',
  'flip-vertical': 'fade',
  checkerboard: 'fade',
  'random-bars-h': 'wipe-left',
  'random-bars-v': 'wipe-down',
  'blinds-horizontal': 'wipe-down',
  'blinds-vertical': 'wipe-left',
  'star-in': 'fade',
  'star-out': 'fade',
  'heart-in': 'fade',
  'heart-out': 'fade',
  'cube-left': 'slide-left',
  'cube-right': 'slide-right',
  'cube-up': 'slide-up',
  'cube-down': 'slide-down',
  'rotate-left': 'slide-left',
  'rotate-right': 'slide-right',
  'doors-horizontal': 'fade',
  'doors-vertical': 'fade',
  'page-curl': 'fade',
  ripple: 'fade',
  honeycomb: 'fade',
};

function normalizeTtkbSafeTransitionEffect(effect = 'fade') {
  const key = String(effect || 'fade');
  return TTKB_SAFE_TRANSITION_EFFECT_ALIASES[key] || key;
}

function getTransitionStyle(effect, entered, duration) {
  effect = normalizeTtkbSafeTransitionEffect(effect);
  const d = `${Math.max(0.1, Number(duration) || 0.45)}s`;
  const ease = 'cubic-bezier(.4,0,.2,1)';

  // ── None / Cut ──
  if (effect === 'none' || effect === 'cut') return {};

  // ── Fade variants ──
  if (effect === 'fade') return { opacity: entered ? 1 : 0, transition: `opacity ${d} ${ease}` };
  if (effect === 'fade-black') {
    injectTransitionKeyframes(
      '_trFadeBlack',
      'opacity:0; background:#000',
      'opacity:1; background:transparent'
    );
    return entered
      ? { animation: `_trFadeBlack ${d} ${ease} forwards` }
      : { opacity: 0, background: '#000' };
  }
  if (effect === 'fade-white') {
    injectTransitionKeyframes(
      '_trFadeWhite',
      'opacity:0; background:#fff',
      'opacity:1; background:transparent'
    );
    return entered
      ? { animation: `_trFadeWhite ${d} ${ease} forwards` }
      : { opacity: 0, background: '#fff' };
  }

  // ── Slide / Push ──
  const slideMap = {
    slide: [-100, 0],
    'slide-left': [-100, 0],
    'slide-right': [100, 0],
    'slide-up': [0, -100],
    'slide-down': [0, 100],
  };
  if (slideMap[effect]) {
    const [tx, ty] = slideMap[effect];
    return {
      transform: entered ? 'translate(0,0)' : `translate(${tx}%,${ty}%)`,
      opacity: entered ? 1 : 0,
      transition: `transform ${d} ${ease}, opacity ${d} ${ease}`,
    };
  }

  // ── Cover ──
  const coverMap = {
    'cover-left': [-100, 0],
    'cover-right': [100, 0],
    'cover-up': [0, -100],
    'cover-down': [0, 100],
  };
  if (coverMap[effect]) {
    const [tx, ty] = coverMap[effect];
    return {
      transform: entered ? 'translate(0,0)' : `translate(${tx}%,${ty}%)`,
      transition: `transform ${d} ${ease}`,
    };
  }

  // ── Uncover ──
  const uncoverMap = {
    'uncover-left': [100, 0],
    'uncover-right': [-100, 0],
    'uncover-up': [0, 100],
    'uncover-down': [0, -100],
  };
  if (uncoverMap[effect]) {
    const [tx, ty] = uncoverMap[effect];
    return {
      transform: entered ? `translate(${tx}%,${ty}%)` : 'translate(0,0)',
      opacity: entered ? 0 : 1,
      transition: `transform ${d} ${ease}, opacity ${d} ${ease}`,
    };
  }

  // ── Reveal ──
  if (effect === 'reveal')
    return {
      clipPath: entered ? 'inset(0 0 0 0)' : 'inset(0 100% 0 0)',
      transition: `clip-path ${d} ${ease}`,
    };

  // ── Morph ──
  if (effect === 'morph')
    return {
      transform: entered ? 'scale(1)' : 'scale(0.95)',
      opacity: entered ? 1 : 0.5,
      filter: entered ? 'blur(0px)' : 'blur(4px)',
      transition: `all ${d} ${ease}`,
    };

  // ── Zoom ──
  if (effect === 'zoom-in')
    return {
      transform: entered ? 'scale(1)' : 'scale(0.3)',
      opacity: entered ? 1 : 0,
      transition: `transform ${d} ${ease}, opacity ${d} ${ease}`,
    };
  if (effect === 'zoom-out')
    return {
      transform: entered ? 'scale(1)' : 'scale(2)',
      opacity: entered ? 1 : 0,
      transition: `transform ${d} ${ease}, opacity ${d} ${ease}`,
    };
  if (effect === 'zoom-rotate')
    return {
      transform: entered ? 'scale(1) rotate(0deg)' : 'scale(0.3) rotate(180deg)',
      opacity: entered ? 1 : 0,
      transition: `transform ${d} ${ease}, opacity ${d} ${ease}`,
    };

  // ── Spin ──
  if (effect === 'spin')
    return {
      transform: entered ? 'rotate(0deg) scale(1)' : 'rotate(540deg) scale(0)',
      opacity: entered ? 1 : 0,
      transition: `transform ${d} ${ease}, opacity ${d} ${ease}`,
    };

  // ── Flip ──
  if (effect === 'flip-horizontal')
    return {
      transform: entered
        ? 'perspective(800px) rotateY(0deg)'
        : 'perspective(800px) rotateY(-90deg)',
      opacity: entered ? 1 : 0.2,
      transition: `transform ${d} ${ease}, opacity ${d} ${ease}`,
      backfaceVisibility: 'hidden',
    };
  if (effect === 'flip-vertical')
    return {
      transform: entered ? 'perspective(800px) rotateX(0deg)' : 'perspective(800px) rotateX(90deg)',
      opacity: entered ? 1 : 0.2,
      transition: `transform ${d} ${ease}, opacity ${d} ${ease}`,
      backfaceVisibility: 'hidden',
    };

  // ── Bounce ──
  if (effect === 'bounce') {
    injectTransitionKeyframes(
      '_trBounce',
      'transform:scale(0);opacity:0',
      'transform:scale(1);opacity:1'
    );
    return entered
      ? { animation: `_trBounce ${d} cubic-bezier(.34,1.56,.64,1) forwards` }
      : { transform: 'scale(0)', opacity: 0 };
  }

  // ── Swing ──
  if (effect === 'swing') {
    injectTransitionKeyframes(
      '_trSwing',
      'transform:rotate(-12deg) translateY(-30px);opacity:0',
      'transform:rotate(0deg) translateY(0);opacity:1'
    );
    return entered
      ? { animation: `_trSwing ${d} ${ease} forwards`, transformOrigin: 'top center' }
      : { transform: 'rotate(-12deg) translateY(-30px)', opacity: 0 };
  }

  // ── Drop ──
  if (effect === 'drop') {
    injectTransitionKeyframes(
      '_trDrop',
      'transform:translateY(-100%) scale(.8);opacity:0',
      'transform:translateY(0) scale(1);opacity:1'
    );
    return entered
      ? { animation: `_trDrop ${d} cubic-bezier(.34,1.56,.64,1) forwards` }
      : { transform: 'translateY(-100%) scale(.8)', opacity: 0 };
  }

  // ── Fly-in ──
  const flyMap = {
    'fly-in-left': '-120%,0',
    'fly-in-right': '120%,0',
    'fly-in-top': '0,-120%',
    'fly-in-bottom': '0,120%',
  };
  if (flyMap[effect])
    return {
      transform: entered ? 'translate(0,0)' : `translate(${flyMap[effect]})`,
      opacity: entered ? 1 : 0,
      transition: `transform ${d} ${ease}, opacity ${d} ${ease}`,
    };

  // ── Wipe ──
  const wipeMap = {
    'wipe-left': ['inset(0 100% 0 0)', 'inset(0 0 0 0)'],
    'wipe-right': ['inset(0 0 0 100%)', 'inset(0 0 0 0)'],
    'wipe-up': ['inset(100% 0 0 0)', 'inset(0 0 0 0)'],
    'wipe-down': ['inset(0 0 100% 0)', 'inset(0 0 0 0)'],
  };
  if (wipeMap[effect])
    return {
      clipPath: entered ? wipeMap[effect][1] : wipeMap[effect][0],
      transition: `clip-path ${d} ${ease}`,
    };

  // ── Barn ──
  if (effect === 'barn-in')
    return {
      clipPath: entered ? 'inset(0 0 0 0)' : 'inset(0 50% 0 50%)',
      transition: `clip-path ${d} ${ease}`,
    };
  if (effect === 'barn-out')
    return {
      clipPath: entered ? 'inset(0 0 0 0)' : 'inset(50% 0 50% 0)',
      transition: `clip-path ${d} ${ease}`,
    };

  // ── Blinds ──
  if (effect === 'blinds-horizontal') {
    const n = 8;
    const stops = Array.from({ length: n }, (_, i) => {
      const s = (i / n) * 100;
      const e = ((i + 1) / n) * 100;
      const mid = entered ? e : s + (e - s) * 0.1;
      return `transparent ${s}%, transparent ${mid}%, black ${mid}%, black ${e}%`;
    }).join(',');
    return {
      WebkitMaskImage: `linear-gradient(to bottom,${stops})`,
      maskImage: `linear-gradient(to bottom,${stops})`,
      transition: `all ${d} ${ease}`,
      opacity: entered ? 1 : 0.5,
    };
  }
  if (effect === 'blinds-vertical') {
    const n = 8;
    const stops = Array.from({ length: n }, (_, i) => {
      const s = (i / n) * 100;
      const e = ((i + 1) / n) * 100;
      const mid = entered ? e : s + (e - s) * 0.1;
      return `transparent ${s}%, transparent ${mid}%, black ${mid}%, black ${e}%`;
    }).join(',');
    return {
      WebkitMaskImage: `linear-gradient(to right,${stops})`,
      maskImage: `linear-gradient(to right,${stops})`,
      transition: `all ${d} ${ease}`,
      opacity: entered ? 1 : 0.5,
    };
  }

  // ── Checkerboard ──
  if (effect === 'checkerboard')
    return {
      opacity: entered ? 1 : 0,
      filter: entered ? 'none' : 'contrast(200%) brightness(0.5)',
      transition: `opacity ${d} ${ease}, filter ${d} ${ease}`,
    };

  // ── Random bars ──
  if (effect === 'random-bars-h')
    return {
      clipPath: entered ? 'inset(0 0 0 0)' : 'inset(0 0 0 100%)',
      transition: `clip-path ${d} steps(12,end)`,
    };
  if (effect === 'random-bars-v')
    return {
      clipPath: entered ? 'inset(0 0 0 0)' : 'inset(100% 0 0 0)',
      transition: `clip-path ${d} steps(12,end)`,
    };

  // ── Shape (circle, diamond, box, plus, star, heart) ──
  const shapeInOut = {
    'circle-in': ['circle(0% at 50% 50%)', 'circle(75% at 50% 50%)'],
    'circle-out': ['circle(75% at 50% 50%)', 'circle(0% at 50% 50%)'],
    'diamond-in': [
      'polygon(50% 50%,50% 50%,50% 50%,50% 50%)',
      'polygon(50% 0%,100% 50%,50% 100%,0% 50%)',
    ],
    'diamond-out': [
      'polygon(50% 0%,100% 50%,50% 100%,0% 50%)',
      'polygon(50% 50%,50% 50%,50% 50%,50% 50%)',
    ],
    'box-in': ['inset(50% 50% 50% 50%)', 'inset(0 0 0 0)'],
    'box-out': ['inset(0 0 0 0)', 'inset(50% 50% 50% 50%)'],
    'plus-in': [
      'polygon(40% 40%,60% 40%,60% 40%,60% 60%,60% 60%,40% 60%,40% 60%,40% 40%)',
      'polygon(40% 0%,60% 0%,60% 40%,100% 40%,100% 60%,60% 60%,60% 100%,40% 100%,40% 60%,0% 60%,0% 40%,40% 40%)',
    ],
    'plus-out': [
      'polygon(40% 0%,60% 0%,60% 40%,100% 40%,100% 60%,60% 60%,60% 100%,40% 100%,40% 60%,0% 60%,0% 40%,40% 40%)',
      'polygon(40% 40%,60% 40%,60% 40%,60% 60%,60% 60%,40% 60%,40% 60%,40% 40%)',
    ],
    'star-in': [
      'polygon(50% 50%,50% 50%,50% 50%,50% 50%,50% 50%)',
      'polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)',
    ],
    'star-out': [
      'polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)',
      'polygon(50% 50%,50% 50%,50% 50%,50% 50%,50% 50%)',
    ],
    'heart-in': [
      'polygon(50% 50%,50% 50%,50% 50%,50% 50%)',
      'polygon(50% 100%,0% 35%,25% 0%,50% 20%,75% 0%,100% 35%)',
    ],
    'heart-out': [
      'polygon(50% 100%,0% 35%,25% 0%,50% 20%,75% 0%,100% 35%)',
      'polygon(50% 50%,50% 50%,50% 50%,50% 50%)',
    ],
  };
  if (shapeInOut[effect])
    return {
      clipPath: entered ? shapeInOut[effect][1] : shapeInOut[effect][0],
      transition: `clip-path ${d} ${ease}`,
    };

  // ── Split ──
  if (effect === 'split-horizontal-in')
    return {
      clipPath: entered ? 'inset(0 0 0 0)' : 'inset(50% 0)',
      transition: `clip-path ${d} ${ease}`,
    };
  if (effect === 'split-horizontal-out')
    return {
      clipPath: entered ? 'inset(0 0 0 0)' : 'inset(0 50%)',
      transition: `clip-path ${d} ${ease}`,
    };
  if (effect === 'split-vertical-in')
    return {
      clipPath: entered ? 'inset(0 0 0 0)' : 'inset(0 50% 0 50%)',
      transition: `clip-path ${d} ${ease}`,
    };
  if (effect === 'split-vertical-out')
    return {
      clipPath: entered ? 'inset(0 0 0 0)' : 'inset(50% 0 50% 0)',
      transition: `clip-path ${d} ${ease}`,
    };

  // ── Dissolve / Pixelate ──
  if (effect === 'dissolve')
    return {
      opacity: entered ? 1 : 0,
      filter: entered ? 'blur(0px)' : 'blur(8px)',
      transition: `opacity ${d} ${ease}, filter ${d} ${ease}`,
    };
  if (effect === 'pixelate')
    return {
      opacity: entered ? 1 : 0,
      filter: entered ? 'blur(0px)' : 'blur(12px) contrast(4)',
      transition: `opacity ${d} ${ease}, filter ${d} ${ease}`,
    };

  // ── Clock / Wheel ──
  if (effect === 'clock-cw') {
    injectTransitionKeyframes(
      '_trClockCW',
      'clip-path:polygon(50% 50%,50% 0%,50% 0%,50% 0%,50% 0%,50% 0%)',
      'clip-path:polygon(50% 50%,50% 0%,100% 0%,100% 100%,0% 100%,0% 0%)'
    );
    return entered
      ? { animation: `_trClockCW ${d} ${ease} forwards` }
      : { clipPath: 'polygon(50% 50%,50% 0%,50% 0%,50% 0%,50% 0%,50% 0%)' };
  }
  if (effect === 'clock-ccw') {
    injectTransitionKeyframes(
      '_trClockCCW',
      'clip-path:polygon(50% 50%,50% 0%,50% 0%,50% 0%,50% 0%,50% 0%)',
      'clip-path:polygon(50% 50%,50% 0%,0% 0%,0% 100%,100% 100%,100% 0%)'
    );
    return entered
      ? { animation: `_trClockCCW ${d} ${ease} forwards` }
      : { clipPath: 'polygon(50% 50%,50% 0%,50% 0%,50% 0%,50% 0%,50% 0%)' };
  }
  if (effect === 'wheel-2')
    return {
      clipPath: entered ? 'inset(0 0 0 0)' : 'inset(0 50% 0 0)',
      opacity: entered ? 1 : 0.4,
      transition: `clip-path ${d} ${ease}, opacity ${d} ${ease}`,
    };
  if (effect === 'wheel-4')
    return {
      clipPath: entered ? 'inset(0 0 0 0)' : 'inset(25% 25% 25% 25%)',
      opacity: entered ? 1 : 0.4,
      transition: `clip-path ${d} ${ease}, opacity ${d} ${ease}`,
    };
  if (effect === 'wheel-8')
    return {
      clipPath: entered ? 'inset(0 0 0 0)' : 'inset(12.5% 12.5% 12.5% 12.5%)',
      opacity: entered ? 1 : 0.4,
      transition: `clip-path ${d} ${ease}, opacity ${d} ${ease}`,
    };

  // ── 3D Cube ──
  const cubeMap = {
    'cube-left': 'rotateY(90deg)',
    'cube-right': 'rotateY(-90deg)',
    'cube-up': 'rotateX(-90deg)',
    'cube-down': 'rotateX(90deg)',
  };
  if (cubeMap[effect])
    return {
      transform: entered
        ? 'perspective(800px) rotateY(0) rotateX(0)'
        : `perspective(800px) ${cubeMap[effect]}`,
      opacity: entered ? 1 : 0.3,
      transition: `transform ${d} ${ease}, opacity ${d} ${ease}`,
      transformOrigin: effect.includes('left')
        ? 'left center'
        : effect.includes('right')
          ? 'right center'
          : effect.includes('up')
            ? 'center top'
            : 'center bottom',
    };

  // ── 3D Rotate ──
  if (effect === 'rotate-left')
    return {
      transform: entered ? 'perspective(800px) rotateY(0)' : 'perspective(800px) rotateY(-45deg)',
      opacity: entered ? 1 : 0.4,
      transition: `transform ${d} ${ease}, opacity ${d} ${ease}`,
      transformOrigin: 'left center',
    };
  if (effect === 'rotate-right')
    return {
      transform: entered ? 'perspective(800px) rotateY(0)' : 'perspective(800px) rotateY(45deg)',
      opacity: entered ? 1 : 0.4,
      transition: `transform ${d} ${ease}, opacity ${d} ${ease}`,
      transformOrigin: 'right center',
    };

  // ── 3D Doors ──
  if (effect === 'doors-horizontal')
    return {
      transform: entered ? 'perspective(800px) rotateY(0)' : 'perspective(800px) rotateY(90deg)',
      opacity: entered ? 1 : 0.2,
      transition: `transform ${d} ${ease}, opacity ${d} ${ease}`,
      transformOrigin: 'center center',
    };
  if (effect === 'doors-vertical')
    return {
      transform: entered ? 'perspective(800px) rotateX(0)' : 'perspective(800px) rotateX(90deg)',
      opacity: entered ? 1 : 0.2,
      transition: `transform ${d} ${ease}, opacity ${d} ${ease}`,
      transformOrigin: 'center center',
    };

  // ── Page curl ──
  if (effect === 'page-curl')
    return {
      transform: entered ? 'perspective(800px) rotateY(0)' : 'perspective(800px) rotateY(-120deg)',
      opacity: entered ? 1 : 0.1,
      transition: `transform ${d} ${ease}, opacity ${d} ${ease}`,
      transformOrigin: 'left center',
    };

  // ── Conveyor ──
  if (effect === 'conveyor-left')
    return {
      transform: entered ? 'translateX(0) scale(1)' : 'translateX(-110%) scale(0.85)',
      opacity: entered ? 1 : 0.3,
      transition: `transform ${d} ${ease}, opacity ${d} ${ease}`,
    };
  if (effect === 'conveyor-right')
    return {
      transform: entered ? 'translateX(0) scale(1)' : 'translateX(110%) scale(0.85)',
      opacity: entered ? 1 : 0.3,
      transition: `transform ${d} ${ease}, opacity ${d} ${ease}`,
    };

  // ── Special: Glitter ──
  if (effect === 'glitter') {
    injectTransitionKeyframes(
      '_trGlitter',
      'opacity:0;filter:brightness(3) blur(6px)',
      'opacity:1;filter:brightness(1) blur(0px)'
    );
    return entered
      ? { animation: `_trGlitter ${d} ${ease} forwards` }
      : { opacity: 0, filter: 'brightness(3) blur(6px)' };
  }

  // ── Special: Shatter ──
  if (effect === 'shatter') {
    injectTransitionKeyframes(
      '_trShatter',
      'opacity:0;transform:scale(1.3) rotate(5deg);filter:blur(10px)',
      'opacity:1;transform:scale(1) rotate(0);filter:blur(0)'
    );
    return entered
      ? { animation: `_trShatter ${d} ${ease} forwards` }
      : { opacity: 0, transform: 'scale(1.3) rotate(5deg)', filter: 'blur(10px)' };
  }

  // ── Special: Curtain ──
  if (effect === 'curtain')
    return {
      clipPath: entered ? 'inset(0 0 0 0)' : 'inset(0 50% 0 50%)',
      transform: entered ? 'scaleX(1)' : 'scaleX(0.7)',
      transition: `clip-path ${d} ${ease}, transform ${d} ${ease}`,
    };

  // ── Special: Newspaper ──
  if (effect === 'newspaper') {
    injectTransitionKeyframes(
      '_trNewspaper',
      'transform:rotate(720deg) scale(0);opacity:0',
      'transform:rotate(0) scale(1);opacity:1'
    );
    return entered
      ? { animation: `_trNewspaper ${d} ${ease} forwards` }
      : { transform: 'rotate(720deg) scale(0)', opacity: 0 };
  }

  // ── Special: Vortex ──
  if (effect === 'vortex') {
    injectTransitionKeyframes(
      '_trVortex',
      'transform:rotate(360deg) scale(0);opacity:0;filter:blur(8px)',
      'transform:rotate(0) scale(1);opacity:1;filter:blur(0)'
    );
    return entered
      ? { animation: `_trVortex ${d} ${ease} forwards` }
      : { transform: 'rotate(360deg) scale(0)', opacity: 0, filter: 'blur(8px)' };
  }

  // ── Special: Ripple ──
  if (effect === 'ripple') {
    injectTransitionKeyframes(
      '_trRipple',
      'clip-path:circle(0% at 50% 50%);transform:scale(1.1)',
      'clip-path:circle(75% at 50% 50%);transform:scale(1)'
    );
    return entered
      ? { animation: `_trRipple ${d} ${ease} forwards` }
      : { clipPath: 'circle(0% at 50% 50%)', transform: 'scale(1.1)' };
  }

  // ── Special: Honeycomb ──
  if (effect === 'honeycomb')
    return {
      clipPath: entered
        ? 'polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%)'
        : 'polygon(50% 50%,50% 50%,50% 50%,50% 50%,50% 50%,50% 50%)',
      opacity: entered ? 1 : 0,
      transition: `clip-path ${d} ${ease}, opacity ${d} ${ease}`,
    };

  // ── Fallback: fade ──
  return { opacity: entered ? 1 : 0, transition: `opacity ${d} ${ease}` };
}

export default function SlideTransitionView({
  transitionKey,
  effect = 'fade',
  direction = 'left',
  duration = 0.45,
  children,
}) {
  const [entered, setEntered] = useState(effect === 'none' || effect === 'cut' || duration <= 0);

  useEffect(() => {
    if (effect === 'none' || effect === 'cut' || duration <= 0) {
      setEntered(true);
      return undefined;
    }
    setEntered(false);
    const raf = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(raf);
  }, [transitionKey, effect, direction, duration]);

  const style = getTransitionStyle(effect, entered, duration);

  return (
    <div style={{ willChange: 'transform, opacity, clip-path, filter', ...style }}>{children}</div>
  );
}
