import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KolPublications } from '../../components/kol/KolPublications';
import type { KolPublication } from '../../api/kol-network';

function pubs(n: number): KolPublication[] {
  return Array.from({ length: n }, (_, i) => ({
    title: `Paper ${i + 1}`,
    journal: 'J Clin Oncol',
    year: 2026 - i,
    url: `https://pubmed.ncbi.nlm.nih.gov/${i + 1}/`,
  }));
}

describe('KolPublications', () => {
  it('renders nothing without publications', () => {
    const { container } = render(<KolPublications publications={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('links each title to PubMed and shows journal and year', () => {
    render(<KolPublications publications={pubs(2)} />);
    const link = screen.getByRole('link', { name: /Paper 1/ });
    expect(link).toHaveAttribute('href', 'https://pubmed.ncbi.nlm.nih.gov/1/');
    expect(screen.getByText('J Clin Oncol · 2026')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows the first ten and expands to all', () => {
    render(<KolPublications publications={pubs(12)} />);
    expect(screen.getAllByRole('link')).toHaveLength(10);
    fireEvent.click(screen.getByRole('button', { name: 'Show all 12' }));
    expect(screen.getAllByRole('link')).toHaveLength(12);
    expect(screen.getByRole('button', { name: 'Show fewer' })).toBeInTheDocument();
  });
});
