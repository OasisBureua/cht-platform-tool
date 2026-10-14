import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UserGuide from '../../pages/guide/UserGuide';

describe('UserGuide', () => {
  it('renders every section of the participant guide', () => {
    render(
      <MemoryRouter>
        <UserGuide />
      </MemoryRouter>,
    );
    for (const title of [
      'Sign in or create your account',
      'Find a webinar and submit your registration',
      'Understand the two emails',
      'Join the webinar through CHM',
      'Complete the survey after the webinar',
      'Track payment release',
      'Explore the rest of the platform',
      'Resolve common issues',
    ]) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
    expect(screen.queryAllByRole('img')).toHaveLength(0);
  });

  it('points support at the in-app Help & support tab', () => {
    render(
      <MemoryRouter>
        <UserGuide />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Help & support' })).toHaveAttribute(
      'href',
      '/app/contact',
    );
  });
});
