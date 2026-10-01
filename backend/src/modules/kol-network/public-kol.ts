import type { PublicKol, PublicKolList } from './kol-network.types';

// Content Hub's HCP record behind `intel` is overwritten by whatever anyone
// enters at platform registration (email, city/state, specialty, institution),
// and also carries industry-payment totals. Public surfaces only get the NPI
// number and the Hub AI brief.
export function toPublicKol(kol: PublicKol): PublicKol {
  if (!kol.intel) return kol;
  return {
    ...kol,
    intel: { npi: kol.intel.npi, ai_brief: kol.intel.ai_brief },
  };
}

export function toPublicKolList(list: PublicKolList): PublicKolList {
  return { ...list, items: list.items.map(toPublicKol) };
}
