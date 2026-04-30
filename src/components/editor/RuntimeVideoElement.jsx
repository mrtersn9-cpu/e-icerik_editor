import React, { useRef, useEffect } from 'react';

export default function RuntimeVideoElement({ obj, accessibility, captionsEnabled = false }) {
  const videoRef = useRef(null);
  const captionTracks = (obj.closedCaptions || []).filter((cc) => cc.src);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const syncTrackModes = () => {
      Array.from(video.textTracks || []).forEach((track, index) => {
        track.mode = captionsEnabled && index === 0 ? 'showing' : 'hidden';
      });
    };

    syncTrackModes();
    video.addEventListener('loadedmetadata', syncTrackModes);
    return () => video.removeEventListener('loadedmetadata', syncTrackModes);
  }, [captionsEnabled, captionTracks.length, obj.id]);

  return (
    <video
      ref={videoRef}
      data-object-id={obj.id}
      src={obj.mediaUrl}
      controls={obj.showPlayerControls !== false}
      autoPlay={!!obj.autoPlay}
      muted={!!obj.muted}
      loop={!!obj.loop}
      playsInline
      preload="metadata"
      crossOrigin="anonymous"
      aria-label={accessibility.ariaLabel || obj.label || 'Video'}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        pointerEvents: 'auto',
        background: '#020617',
      }}
    >
      {captionTracks.map((cc, ci) => (
        <track
          key={ci}
          kind="captions"
          src={cc.src}
          srcLang={cc.lang}
          label={cc.label || cc.lang}
          default={captionsEnabled && ci === 0}
        />
      ))}
    </video>
  );
}
