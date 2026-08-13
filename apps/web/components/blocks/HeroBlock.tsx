'use client';

import { useEffect, useRef } from 'react';
import { SmartLink } from '@/components/ui/SmartLink';
import { motion } from 'framer-motion';
import type { HeroBlock } from '@kentslsc/shared';
import VideoOverlay from '@/components/ui/VideoOverlay';
import type { OverlayStyle } from '@/components/ui/VideoOverlay';
import { getVideoMimeType } from '@/lib/utils';

interface Props {
  block: HeroBlock;
}

export default function HeroBlockComponent({ block }: Props) {
  const {
    title,
    subtitle,
    buttonText,
    buttonUrl,
    mediaType,
    imageUrl,
    videoUrl,
    overlayStyle,
    overlayOpacity,
    videoPlaybackRate
  } = block;

  const isVideo = mediaType === 'video' && videoUrl;
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = videoPlaybackRate ?? 1;
    }
  }, [videoPlaybackRate]);

  return (
    <section className="relative flex min-h-[calc(100vh-68px)] items-center overflow-hidden px-4 py-24 md:px-6 md:py-20">
      {isVideo ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            muted
            loop
            playsInline
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover"
            style={{ backgroundColor: 'transparent' }}
          >
            <source src={videoUrl} type={getVideoMimeType(videoUrl)} />
            {/* Fallback to the default hero video if the configured file is missing */}
            <source src="/videos/kslsc-hero.mp4" type="video/mp4" />
            <source src="/videos/kslsc-hero.webm" type="video/webm" />
          </video>
          <VideoOverlay style={overlayStyle as OverlayStyle} opacity={overlayOpacity} />
          {/* Fade the video into the neon lava header */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-56 bg-gradient-to-b from-slate-950/80 via-slate-950/40 to-transparent" />
        </>
      ) : imageUrl ? (
        <>
          <div
            className="pointer-events-none absolute inset-0 -z-10 bg-cover bg-center"
            style={{ backgroundImage: `url(${imageUrl})` }}
          />
          <VideoOverlay style={overlayStyle as OverlayStyle} opacity={overlayOpacity} />
        </>
      ) : (
        <div className="pointer-events-none absolute inset-0 -z-10 bg-slate-900" />
      )}
      <div className="relative z-10 mx-auto max-w-5xl text-center text-slate-100">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-5xl font-extrabold leading-tight tracking-tight drop-shadow-lg md:text-7xl"
        >
          {title}
        </motion.h1>
        {subtitle && (
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mx-auto mt-6 max-w-2xl text-lg text-slate-200 drop-shadow"
          >
            {subtitle}
          </motion.p>
        )}
        {buttonText && buttonUrl && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-8"
          >
            <SmartLink href={buttonUrl} className="btn-primary">
              {buttonText}
            </SmartLink>
          </motion.div>
        )}
      </div>
    </section>
  );
}
