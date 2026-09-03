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

export function VideoPlaylist({ videos, initialVideoId }: { videos: PublicVideo[]; initialVideoId?: string }) {
  const initialIndex = initialVideoId ? videos.findIndex((video) => video.id === initialVideoId) : -1;
  const [activeIndex, setActiveIndex] = useState<number | null>(initialIndex >= 0 ? initialIndex : null);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);

  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (!video) return;
      if (index === activeIndex) void video.play().catch(() => undefined);
      else video.pause();
    });
  }, [activeIndex]);

  function playNext(currentIndex: number) {
    if (videos.length < 2) return;
    setActiveIndex((currentIndex + 1) % videos.length);
  }

  return (
    <details className={styles.videoSection} open={initialIndex >= 0 ? true : undefined}>
      <summary><span>Videos</span><small>{videos.length}</small></summary>
      <div className={styles.videoList}>
        {videos.map((entry, index) => {
          const isUploadedVideo = Boolean(entry.imageUrl && /\.(mp4|webm|mov)(\?|$)/i.test(entry.imageUrl));
          return (
            <details
              className={styles.videoItem}
              key={entry.id}
              id={`video-${entry.id}`}
              open={activeIndex === index}
              onToggle={(event) => {
                if (event.currentTarget.open) setActiveIndex(index);
                else if (activeIndex === index) setActiveIndex(null);
              }}
            >
              <summary>
                {isUploadedVideo && <video className={styles.videoSnapshot} src={entry.imageUrl} muted playsInline preload="metadata" aria-hidden="true" />}
                <span>{entry.title || `Video ${index + 1}`}</span>
                <small>{isUploadedVideo ? "Uploaded" : "Linked"}</small>
              </summary>
              <div className={styles.videoBody}>
                {isUploadedVideo ? (
                  <video
                    ref={(node) => { videoRefs.current[index] = node; }}
                    src={entry.imageUrl}
                    controls
                    muted
                    playsInline
                    preload="metadata"
                    onEnded={() => playNext(index)}
                  />
                ) : entry.embedUrl ? (
                  <iframe src={entry.embedUrl} title={entry.title || "Consultant video"} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                ) : entry.imageUrl ? <img src={entry.imageUrl} alt={entry.title} /> : null}
                {entry.description && <p>{entry.description}</p>}
                <div className={styles.videoActions}>
                  {entry.url && <a href={entry.url} target="_blank" rel="noopener noreferrer">Open video</a>}
                  <CopyCardLinkButton query={{ video: entry.id }} hash={`video-${entry.id}`} label="Copy video link" />
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </details>
  );
}
