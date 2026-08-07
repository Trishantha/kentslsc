'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import type { HeroBlock } from '@kentslsc/shared';
import VideoOverlay from '@/components/ui/VideoOverlay';
import type { OverlayStyle } from '@/components/ui/VideoOverlay';

interface Props {
  block: HeroBlock;
}

export default function HeroBlockComponent({ block }: Props) {
  const { title, subtitle, buttonText, buttonUrl, mediaType, imageUrl, videoUrl, overlayStyle, overlayOpacity } = block;

  const isVideo = mediaType === 'video' && videoUrl;
  const videoExt = isVideo ? videoUrl.split('.').pop()?.toLowerCase() : null;
  const videoBase = isVideo ? videoUrl.replace(/\.[^.]+$/, '') : null;
  const mp4Fallback = videoBase && videoExt !== 'mp4' ? `${videoBase}.mp4` : null;

  return (
    <section className="relative overflow-hidden px-4 pb-20 pt-24 md:px-6 md:pt-36">
      {isVideo ? (
        <>
          <video
            autoPlay
            muted
            loop
            playsInline
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover"
            style={{ backgroundColor: 'transparent' }}
          >
            {videoExt === 'webm' && <source src={videoUrl} type="video/webm" />}
            {videoExt === 'mp4' && <source src={videoUrl} type="video/mp4" />}
            {mp4Fallback && <source src={mp4Fallback} type="video/mp4" />}
          </video>
          <VideoOverlay style={overlayStyle as OverlayStyle} opacity={overlayOpacity} />
        </>
      ) : imageUrl ? (
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-cover bg-center opacity-20"
          style={{ backgroundImage: `url(${imageUrl})` }}
        />
      ) : null}
      <div className="mx-auto max-w-5xl text-center">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-5xl font-extrabold leading-tight tracking-tight md:text-7xl"
        >
          {title}
        </motion.h1>
        {subtitle && (
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-300"
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
            <Link href={buttonUrl} className="btn-primary">
              {buttonText}
            </Link>
          </motion.div>
        )}
      </div>
    </section>
  );
}
