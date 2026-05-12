import DolNetwork from './public/DolNetwork';

/**
 * In-app CHM Docs matches the public “CHM Docs” experience (DOL Network at /kol-network):
 * same directory, filters, and profile links.
 */
export default function ChmDocs() {
  return <DolNetwork embedded />;
}
