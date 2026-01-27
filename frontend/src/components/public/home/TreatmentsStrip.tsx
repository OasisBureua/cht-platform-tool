import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import styles from "../../../pages/public/home.module.css";

import leftBg from "../../../assets/home/treatment-left.jpg";
import centerBg from "../../../assets/home/treatment-center.jpg";
import rightBg from "../../../assets/home/treatment-right.jpg";

export default function TreatmentsStrip() {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState<0 | 1 | 2>(1);

  const treatments = [
    { title: "Breast Cancer", bg: leftBg },
    { title: "Breast Cancer", bg: centerBg },
    { title: "Breast Cancer", bg: rightBg },
  ];

  function scrollToIndex(idx: 0 | 1 | 2) {
    const el = viewportRef.current;
    if (!el) return;

    const slides = Array.from(
      el.querySelectorAll<HTMLElement>(`[data-slide]`)
    );

    const node = slides[idx];
    if (!node) return;

    const target = node.offsetLeft - (el.clientWidth / 2 - node.clientWidth / 2);
    el.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }

  // Active dot follows scroll
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const slides = Array.from(
      el.querySelectorAll<HTMLElement>(`[data-slide]`)
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
  }, []);

  // Auto-center on middle card on load
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      scrollToIndex(1);
      setActive(1);
    });

    const t = window.setTimeout(() => {
      scrollToIndex(1);
      setActive(1);
    }, 120);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className={styles.treatments}>
      <div className={styles.treatmentsInner}>
        <h2 className={styles.treatmentsTitle}>Treatments</h2>
        <p className={styles.treatmentsSubtitle}>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit.
        </p>

        <div className={styles.treatmentsViewport} ref={viewportRef}>
          <div className={styles.treatmentsRow}>
            {treatments.map((t, idx) => (
              <div
                key={idx}
                data-slide
                className={styles.treatmentCard}
                style={{ backgroundImage: `url(${t.bg})` }}
              >
                <div className={styles.treatmentCardOverlay} />

                <div className={styles.treatmentCardContent}>
                  <p className={styles.treatmentName}>{t.title}</p>
                  <Link to="/catalog" className={styles.treatmentExplore}>
                    Explore treatments
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.treatmentsControls}>
          <button
            className={`${styles.ctrlDot} ${active === 0 ? styles.ctrlDotActive : ""}`}
            onClick={() => scrollToIndex(0)}
          />
          <button
            className={`${styles.ctrlDot} ${active === 1 ? styles.ctrlDotActive : ""}`}
            onClick={() => scrollToIndex(1)}
          />
          <button
            className={`${styles.ctrlDot} ${active === 2 ? styles.ctrlDotActive : ""}`}
            onClick={() => scrollToIndex(2)}
          />
        </div>
      </div>
    </section>
  );
}
