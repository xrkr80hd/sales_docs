"use client";

import { useEffect, useRef, useState } from "react";
import { CopyCardLinkButton } from "./copy-card-link-button";
import styles from "../../app/card/trav/page.module.css";

export type PublicVideo = {
  id: string;
  title: string;
  description: string;
  url: string;
  imageUrl: string;
  embedUrl: string | null;
};

async function recordVideoView(slug: string, videoId: string) {
  const key = `nxtdocs.video-view.${slug}.${videoId}`;
  if (window.sessionStorage.getItem(key)) return;
  window.sessionStorage.setItem(key, "1");
  await fetch("/api/analytics", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ slug, eventType: "video_view", itemId: videoId }),
    keepalive: true,
  }).catch(() => undefined);
}

export function VideoPlaylist({
  videos,
  initialVideoId,
  consultantSlug,
}: {
  videos: PublicVideo[];
  initialVideoId?: string;
  consultantSlug: string;
}) {
  const initialIndex = initialVideoId ? videos.findIndex((video) => video.id === initialVideoId) : -1;
  const [muted, setMuted] = useState(true);
  const railRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    if (initialIndex < 0) return;
    window.requestAnimationFrame(() => {
      cardRefs.current[initialIndex]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    });
  }, [initialIndex]);

  useEffect(() => {
    const root = railRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.6) continue;
          const videoId = (entry.target as HTMLElement).dataset.videoId;
          if (videoId) void recordVideoView(consultantSlug, videoId);
        }
      },
      { root, threshold: [0.6] },
    );
    cardRefs.current.forEach((card) => card && observer.observe(card));
    return () => observer.disconnect();
  }, [consultantSlug, videos]);

  return (
    <details className={styles.videoSection} open={initialIndex >= 0 ? true : undefined}>
      <summary><span>Videos</span><small>{videos.length}</small></summary>
      <div ref={railRef} className={styles.videoRail} aria-label="Consultant videos">
        {videos.map((entry, index) => {
          const isUploadedVideo = Boolean(entry.imageUrl && /\.(mp4|webm|mov)(\?|$)/i.test(entry.imageUrl));
          return (
            <article
              className={styles.videoCard}
              key={entry.id}
              id={`video-${entry.id}`}
              data-video-id={entry.id}
              ref={(node) => { cardRefs.current[index] = node; }}
            >
              <div className={styles.videoFrame}>
                {isUploadedVideo ? (
                  <video
                    src={entry.imageUrl}
                    controls
                    muted={muted}
                    playsInline
                    preload="metadata"
                    onPlay={() => void recordVideoView(consultantSlug, entry.id)}
                  />
                ) : entry.embedUrl ? (
                  <iframe
                    src={entry.embedUrl}
                    title={entry.title || "Consultant video"}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : entry.imageUrl ? <img src={entry.imageUrl} alt={entry.title} /> : null}
                {isUploadedVideo && (
                  <button type="button" className={styles.videoMuteButton} onClick={() => setMuted((current) => !current)}>
                    {muted ? "🔇" : "🔊"} <span>{muted ? "Sound off" : "Sound on"}</span>
                  </button>
                )}
              </div>
              <div className={styles.videoCardBody}>
                <strong>{entry.title || `Video ${index + 1}`}</strong>
                {entry.description && <p>{entry.description}</p>}
                <div className={styles.videoActions}>
                  {entry.url && <a href={entry.url} target="_blank" rel="noopener noreferrer">Open video</a>}
                  <CopyCardLinkButton query={{ video: entry.id }} hash={`video-${entry.id}`} label="Copy video link" />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </details>
  );
}
