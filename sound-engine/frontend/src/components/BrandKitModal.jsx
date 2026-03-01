import React from 'react';
import logoSvg from '../assets/vangelis-logo.svg?raw';

const BRAND_COLORS = [
  { name: 'Ink', value: '#10151F' },
  { name: 'Paper', value: '#F4F1E8' },
  { name: 'Accent', value: '#FF7A3D' }
];

const BrandKitModal = ({ open, onClose, onNotice }) => {
  if (!open) return null;

  const copyText = async (content, successMessage) => {
    try {
      await navigator.clipboard.writeText(content);
      onNotice(successMessage);
    } catch {
      onNotice('Clipboard blocked.');
    }
  };

  const colorTokens = BRAND_COLORS
    .map((color) => `${color.name}: ${color.value}`)
    .join('\n');

  return (
    <div className="shortcuts-overlay" role="dialog" aria-modal="true" aria-label="Brand kit">
      <div className="shortcuts-card tier-support brandkit-card">
        <div className="shortcuts-header">
          <span>Brand kit</span>
          <button
            type="button"
            className="button-icon"
            aria-label="Close brand kit"
            onClick={onClose}
          >
            <span aria-hidden="true">x</span>
          </button>
        </div>

        <div className="brandkit-preview" dangerouslySetInnerHTML={{ __html: logoSvg }} />

        <div className="brandkit-actions">
          <button
            type="button"
            className="button-primary"
            onClick={() => copyText(logoSvg, 'SVG copied.')}
          >
            Copy logo SVG
          </button>
          <button
            type="button"
            className="button-primary"
            onClick={() => copyText(colorTokens, 'Colors copied.')}
          >
            Copy color tokens
          </button>
        </div>

        <ul className="brandkit-colors">
          {BRAND_COLORS.map((color) => (
            <li key={color.name} className="brandkit-color">
              <span className="brandkit-swatch" style={{ backgroundColor: color.value }} />
              <span>{color.name}</span>
              <code>{color.value}</code>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default BrandKitModal;
