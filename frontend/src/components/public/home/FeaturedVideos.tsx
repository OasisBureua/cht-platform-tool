import { useEffect, useRef, useState } from "react";
import styles from "../../../pages/public/home.module.css";

import leftThumb from "../../../assets/home/featured-left.jpg";
import rightThumb from "../../../assets/home/featured-right.jpg";
import mainThumb from "../../../assets/home/featured-main.jpg";

export default function FeaturedVideos() {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState<0 | 1 | 2>(1);

  const GAP = 11;
  const SIDE_W = 668;
  const MAIN_W = 875;
  const STEP = MAIN_W + GAP;

  function scrollByDir(dir: -1 | 1) {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * STEP, behavior: "smooth" });
  }

  function scrollToStart() {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTo({ left: 0, behavior: "smooth" });
  }

  function scrollToMiddle() {
    const el = viewportRef.current;
    if (!el) return;

    const mainStart = SIDE_W + GAP;
    const target = mainStart - (el.clientWidth / 2 - MAIN_W / 2);
    el.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }

  function scrollToEnd() {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
  }

  // Active dot follows scroll
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const slides = Array.from(
      el.querySelectorAll<HTMLElement>(
        `.${styles.videoCardSide}, .${styles.videoCardMain}`
      )
    );

    const onScroll = () => {
      const centerX = el.scrollLeft + el.clientWidth / 2;
      let best = 0;
      let bestDist = Infinity;

      slides.forEach((node, idx) => {
        const nodeCenter = node.offsetLeft + node.clientWidth / 2;
        const dist = Math.abs(nodeCenter - centerX);
        if (dist < bestDist) {
          bestDist = dist;
          best = idx;
        }
      });

      setActive(best as 0 | 1 | 2);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => el.removeEventListener("scroll", onScroll);
  }, [styles.videoCardMain, styles.videoCardSide]);

  // Auto-center on middle card on load
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      scrollToMiddle();
      setActive(1);
    });

    const t = window.setTimeout(() => {
      scrollToMiddle();
      setActive(1);
    }, 120);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className={styles.featured}>
      <div className={styles.featuredInner}>
        <h2 className={styles.featuredTitle}>Featured Videos</h2>

        <div className={styles.featuredViewport} ref={viewportRef}>
          <div className={styles.featuredRow}>
            {/* Left */}
            <div className={`${styles.videoCard} ${styles.videoCardSide}`}>
              <div
                className={styles.videoThumb}
                style={{ backgroundImage: `url(${leftThumb})` }}
              />
            </div>

            {/* Center */}
            <div className={`${styles.videoCard} ${styles.videoCardMain}`}>
              <div
                className={styles.videoThumbMain}
                style={{ backgroundImage: `url(${mainThumb})` }}
              >
                <div className={styles.playButton}>▶</div>
                <div className={styles.videoDuration}>04:12</div>
              </div>
            </div>

            {/* Right */}
            <div className={`${styles.videoCard} ${styles.videoCardSide}`}>
              <div
                className={styles.videoThumb}
                style={{ backgroundImage: `url(${rightThumb})` }}
              />
            </div>
          </div>
        </div>

        <div className={styles.featuredControls}>
          <button
            className={styles.ctrlBtn}
            aria-label="Previous"
            onClick={() => scrollByDir(-1)}
          >
            ‹
          </button>

          <div className={styles.ctrlDots}>
            <button
              className={`${styles.ctrlDot} ${active === 0 ? styles.ctrlDotActive : ""}`}
              onClick={scrollToStart}
            />
            <button
              className={`${styles.ctrlDot} ${active === 1 ? styles.ctrlDotActive : ""}`}
              onClick={scrollToMiddle}
            />
            <button
              className={`${styles.ctrlDot} ${active === 2 ? styles.ctrlDotActive : ""}`}
              onClick={scrollToEnd}
            />
          </div>

          <button
            className={styles.ctrlBtn}
            aria-label="Next"
            onClick={() => scrollByDir(1)}
          >
            ›
          </button>
        </div>
      </div>
    </section>
  );
}
