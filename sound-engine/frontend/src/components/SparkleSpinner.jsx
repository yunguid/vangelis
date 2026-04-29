import React from 'react';

const SPARKLE_PATH = 'M50 6 C54 28 72 46 94 50 C72 54 54 72 50 94 C46 72 28 54 6 50 C28 46 46 28 50 6 Z';

const SparkleSpinner = ({ className = '', spinning = false, complete = false }) => {
  const classes = [
    'sparkle-spinner',
    spinning ? 'is-spinning' : '',
    complete ? 'is-complete' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <svg
      className={classes}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
    >
      <path
        className="sparkle-spinner__track"
        d={SPARKLE_PATH}
        pathLength="100"
      />
      <path
        className="sparkle-spinner__dash"
        d={SPARKLE_PATH}
        pathLength="100"
      />
    </svg>
  );
};

export default SparkleSpinner;
