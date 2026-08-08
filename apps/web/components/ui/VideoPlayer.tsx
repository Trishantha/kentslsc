'use client';

import { useEffect, useRef, type VideoHTMLAttributes, type ReactNode } from 'react';

interface VideoPlayerProps extends VideoHTMLAttributes<HTMLVideoElement> {
  playbackRate?: number;
  children?: ReactNode;
}

export default function VideoPlayer({ playbackRate = 1, children, ...props }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  return (
    <video ref={videoRef} {...props}>
      {children}
    </video>
  );
}
