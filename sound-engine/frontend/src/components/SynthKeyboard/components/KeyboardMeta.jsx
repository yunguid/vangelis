import React from 'react';

const KeyboardMeta = React.memo(function KeyboardMeta({ octaveOffset, velocityDisplay }) {
  return (
    <div className="keyboard-meta">
      Keys A-; | Sharps W-P | Z/X octave ({octaveOffset}) | Velocity {velocityDisplay}
    </div>
  );
});

export default KeyboardMeta;
