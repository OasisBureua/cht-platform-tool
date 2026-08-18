import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ZoomWebinarSettingsFields, {
  DEFAULT_ZOOM_WEBINAR_SETTINGS,
} from '../../components/admin/ZoomWebinarSettingsFields';

describe('ZoomWebinarSettingsFields', () => {
  it('shows Zoom webinar toggles including Backstage (not Practice session)', () => {
    render(
      <ZoomWebinarSettingsFields
        value={DEFAULT_ZOOM_WEBINAR_SETTINGS}
        onChange={() => {}}
      />,
    );

    expect(screen.getByText('Q&A')).toBeInTheDocument();
    expect(
      screen.getByText('Before webinar starts, hosts and panelists can access Backstage'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/practice session/i)).not.toBeInTheDocument();
    expect(screen.getByText('Enable HD Video for screen shared video')).toBeInTheDocument();
    expect(screen.getByText('Webinar — HD Video quality (1080P)')).toBeInTheDocument();
    expect(screen.getByText('Include email address in attendee report')).toBeInTheDocument();
    expect(screen.getByText('Automatically record webinar in the cloud')).toBeInTheDocument();

    const backstage = screen.getByRole('switch', {
      name: /hosts and panelists can access Backstage/i,
    });
    expect(backstage).toHaveAttribute('aria-checked', 'false');
    expect(backstage).not.toBeDisabled();
  });

  it('lets admins turn Backstage on', () => {
    const onChange = vi.fn();
    render(
      <ZoomWebinarSettingsFields
        value={DEFAULT_ZOOM_WEBINAR_SETTINGS}
        onChange={onChange}
      />,
    );

    fireEvent.click(
      screen.getByRole('switch', {
        name: /hosts and panelists can access Backstage/i,
      }),
    );
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_ZOOM_WEBINAR_SETTINGS,
      backstage: true,
    });
  });
});
