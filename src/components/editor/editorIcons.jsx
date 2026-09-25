/* The editor's icons: 24-unit line drawings, stroked in the current colour. */
import React from 'react';

const Icon = ({ size = 18, children, fill = 'none', className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill={fill}
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const ICON_PLAY = <Icon size={16}><path d="M7.5 5.5 18.5 12 7.5 18.5Z" fill="currentColor" /></Icon>;
export const ICON_STOP = <Icon size={16}><rect x="6.5" y="6.5" width="11" height="11" fill="currentColor" /></Icon>;
export const ICON_RECORD = <Icon size={16}><circle cx="12" cy="12" r="5.5" fill="currentColor" /></Icon>;

// Tools: an arrow, a pencil, a brush, a knife and an eraser.
export const ICON_SELECT = (
  <Icon>
    <path d="M6 3.5v15l4-3.8 2.6 6 2.5-1.1-2.6-5.9H18Z" />
  </Icon>
);
export const ICON_DRAW = (
  <Icon>
    <path d="M4.5 19.5 5.6 15 16 4.6a1.6 1.6 0 0 1 2.3 0l1.1 1.1a1.6 1.6 0 0 1 0 2.3L9 18.4Z" />
    <path d="m14.2 6.4 3.4 3.4" />
    <path d="m5.6 15 3.4 3.4" />
  </Icon>
);
export const ICON_PAINT = (
  <Icon>
    <path d="M19.8 4.2c-.8-.8-2.1-.7-2.9.1l-6.6 7.4 2 2 7.4-6.6c.8-.8.9-2.1.1-2.9Z" />
    <path d="M10.3 11.7c-2.2-.3-3.9 1.1-4.2 3.2-.3 2.2-1 3.2-2.6 3.6 3.1 1.9 7.6 1.4 8.6-2.3.3-1.1.2-2 -.2-2.7" />
  </Icon>
);
export const ICON_SLICE = (
  <Icon>
    <path d="M14.5 3.5 20.5 9.5 9 21a3 3 0 0 1-4.2-4.2Z" />
    <path d="m14.5 3.5-3.2 3.2 6 6" />
    <path d="M3.5 12h4" strokeDasharray="1.4 2" />
  </Icon>
);
export const ICON_ERASE = (
  <Icon>
    <path d="m8.2 20 -4.6-4.6a1.6 1.6 0 0 1 0-2.3L13.8 2.9a1.6 1.6 0 0 1 2.3 0l4.6 4.6a1.6 1.6 0 0 1 0 2.3L10.5 20Z" />
    <path d="m9.2 7.5 7.1 7.1" />
    <path d="M10.5 20h9.5" />
  </Icon>
);

// Chrome: projects are stacked slabs; the account is a head and shoulders.
export const ICON_PROJECTS = (
  <Icon>
    <path d="M3.5 7.5 12 3.5l8.5 4-8.5 4Z" />
    <path d="m3.5 12 8.5 4 8.5-4" />
    <path d="m3.5 16.5 8.5 4 8.5-4" />
  </Icon>
);
export const ICON_ACCOUNT = (
  <Icon>
    <circle cx="12" cy="8.5" r="3.8" />
    <path d="M4.5 20.5c.9-3.8 3.9-6 7.5-6s6.6 2.2 7.5 6" />
  </Icon>
);
export const ICON_PLUS = <Icon size={16}><path d="M12 5.5v13M5.5 12h13" /></Icon>;
export const ICON_MORE = (
  <Icon fill="currentColor">
    <circle cx="5.6" cy="12" r="1.4" stroke="none" />
    <circle cx="12" cy="12" r="1.4" stroke="none" />
    <circle cx="18.4" cy="12" r="1.4" stroke="none" />
  </Icon>
);
export const ICON_HELP = (
  <Icon>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.6 9.3a2.5 2.5 0 1 1 3.3 2.4c-.7.3-1 .9-1 1.6v.3" />
    <path d="M12 17.1h.01" />
  </Icon>
);
export const ICON_CHEVRON = <Icon size={13}><path d="M6.5 9.5 12 15l5.5-5.5" /></Icon>;
export const ICON_POWER = (
  <Icon className="piano-roll-deck__power-icon" size={15}>
    <path d="M12 3v9" />
    <path d="M6.3 7.2a8 8 0 1 0 11.4 0" />
  </Icon>
);
// Velocity lane: three stems of different heights.
export const ICON_VELOCITY = (
  <Icon>
    <path d="M5.5 20.5v-6M12 20.5V6.5M18.5 20.5v-9.5" />
    <path d="M4 14.5h3M10.5 6.5h3M17 11h3" />
  </Icon>
);
