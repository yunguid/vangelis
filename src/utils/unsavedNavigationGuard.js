let activeGuard = null;

/** Register the one workspace that currently owns unsaved navigation state. */
export const registerUnsavedNavigationGuard = (guard) => {
  activeGuard = typeof guard === 'function' ? guard : null;
  return () => {
    if (activeGuard === guard) activeGuard = null;
  };
};

/** Return false when the active workspace asks navigation to stay put. */
export const confirmUnsavedNavigation = () => (
  activeGuard ? activeGuard() !== false : true
);
