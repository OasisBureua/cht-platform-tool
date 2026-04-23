import logoSrc from '../../assets/logo/LOGO.svg';

type Props = {
  className?: string;
};

/** CHM wordmark for headers and footers (uses bundled logo asset). */
export default function ChmWordmarkOption2({ className }: Props) {
  return (
    <img src={logoSrc} alt="Community Health Media" className={className} />
  );
}
