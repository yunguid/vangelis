import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SidebarNavigation, { BrandHeader } from './SidebarNavigation.jsx';

describe('BrandHeader', () => {
  it('renders the shared brand masthead without studio actions', () => {
    render(<BrandHeader className="route-header" />);

    const header = screen.getByRole('banner', { name: 'Branding' });
    expect(header).toHaveClass('zone-top', 'tier-subtle', 'content-tertiary', 'route-header');
    expect(screen.getByText('Vangelis')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('SidebarNavigation', () => {
  it('preserves the passive rail without mounting expandable panel machinery', () => {
    render(<SidebarNavigation />);

    expect(screen.getByRole('button', { name: 'Sound panel unavailable on this page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'MIDI panel unavailable on this page' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Open the pattern editor' }))
      .toHaveAttribute('href', '#/editor');
    expect(screen.queryByRole('link', { name: 'Open the sound design workspace' })).not.toBeInTheDocument();
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('uses the same hidden dock, revealed from the left edge', () => {
    const { container } = render(<SidebarNavigation currentView="studies" />);
    const dock = container.querySelector('.sidebar-rail');
    expect(dock).toHaveAttribute('data-dock', 'hidden');

    fireEvent.pointerEnter(dock.querySelector('.dock__edge'));
    expect(dock).toHaveAttribute('data-dock', 'shown');
  });
});
