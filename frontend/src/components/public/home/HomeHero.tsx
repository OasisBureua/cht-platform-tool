import styles from "../../../pages/public/home.module.css";
import { Link } from "react-router-dom";

export default function HomeHero() {
  return (
    <section className={styles.hero}>
      {/* Overlay */}
      <div className={styles.heroOverlay} />

      <div className={styles.heroInner}>
        <h1 className={styles.heroTitle}>
          Innovating the next phase of
          <br />
          Healthcare through Information
        </h1>

        <p className={styles.heroSubtitle}>
          Community Health Media (CHM) is your full service healthcare communications partner,
          combining our production expertise with targeted multi-channel campaigns.
        </p>

        <div className={styles.heroCtas}>
          <Link to="/catalog" className={styles.heroBtnLight}>
            View content
          </Link>

          <Link to="/join" className={styles.heroBtnDark}>
            Join Now
          </Link>
        </div>
      </div>
    </section>
  );
}
