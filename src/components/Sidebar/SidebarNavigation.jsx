import React from 'react';
import SidebarRail from './SidebarRail.jsx';

export const BrandHeader = React.memo(({ className = '' }) => {
  const headerClassName = ['zone-top', 'tier-subtle', 'content-tertiary', className]
    .filter(Boolean)
    .join(' ');

  return (
    <header className={headerClassName} aria-label="Branding">
      <div className="brand-block">
        <div className="brand-title">Vangelis</div>
      </div>
    </header>
  );
});

const SidebarNavigation = ({ currentView = 'keyboard' }) => (
  <div className="sidebar-container sidebar-container--disabled">
    <SidebarRail disabled currentView={currentView} />
  </div>
);

export default React.memo(SidebarNavigation);
