import HomeHero from "../../components/public/home/HomeHero";
import FeaturedVideos from "../../components/public/home/FeaturedVideos";
import TreatmentsStrip from "../../components/public/home/TreatmentsStrip";
import styles from "./home.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      {/* HERO */}
      <HomeHero />

      {/* FEATURED VIDEOS */}
      <FeaturedVideos />

      {/* TREATMENTS */}
      <TreatmentsStrip />

      {/* WEBINAR FEATURE */}
      <section style={{ height: 520 }} aria-label="Webinar Feature">
        WEBINAR
      </section>

      {/* RESOURCES */}
      <section style={{ height: 420 }} aria-label="Resources">
        RESOURCES
      </section>

      {/* FAQ */}
      <section style={{ height: 420 }} aria-label="FAQ">
        FAQ
      </section>

      {/* CTA */}
      <section style={{ height: 320 }} aria-label="Call to Action">
        CTA
      </section>
    </div>
  );
}
