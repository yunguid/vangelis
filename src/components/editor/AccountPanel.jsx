import React from 'react';
import './AccountPanel.css';

/**
 * The app's one account. Signed out it is a sign-in form (the browser's
 * password manager can fill it); signed in it says where projects go and
 * offers sign-out. Loaded lazily; the page owns every call to the cloud.
 */
const AccountPanel = ({ session, syncNote, onSignIn, onSignOut }) => {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [status, setStatus] = React.useState('idle');
  const emailRef = React.useRef(null);

  // Focus by hand: Preact leaves an inserted autoFocus input unfocused.
  React.useEffect(() => {
    if (!session) emailRef.current?.focus();
  }, [session]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email.trim() || !password) return;
    setStatus('signing-in');
    const { error } = await onSignIn(email.trim(), password);
    if (error) {
      // Supabase answers a wrong password with "Invalid login credentials";
      // anything else means the service could not be reached or refused.
      setStatus(/invalid login/i.test(error.message || '') ? 'rejected' : 'unreachable');
      return;
    }
    setPassword('');
    setStatus('idle');
  };

  if (session) {
    return (
      <section className="account-panel" aria-label="Account">
        <h2 className="account-panel__title">Account</h2>
        <p className="account-panel__who">{session.user?.email}</p>
        {syncNote && <p className="account-panel__note">{syncNote}</p>}
        <button type="button" className="account-panel__button" onClick={onSignOut}>
          Sign out
        </button>
      </section>
    );
  }

  return (
    <section className="account-panel" aria-label="Account">
      <h2 className="account-panel__title">Sign in</h2>
      <p className="account-panel__note">Projects save to your account once you are in.</p>
      <form className="account-panel__form" onSubmit={handleSubmit}>
        <input
          ref={emailRef}
          type="email"
          name="email"
          autoComplete="username"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setStatus('idle');
          }}
          placeholder="Email"
          aria-label="Email"
        />
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setStatus('idle');
          }}
          placeholder="Password"
          aria-label="Password"
        />
        <button
          type="submit"
          className="account-panel__button account-panel__button--primary"
          disabled={!email.trim() || !password || status === 'signing-in'}
        >
          {status === 'signing-in' ? 'Signing in…' : 'Sign in'}
        </button>
        {status === 'rejected' && (
          <p className="account-panel__error" role="alert">That email and password did not match.</p>
        )}
        {status === 'unreachable' && (
          <p className="account-panel__error" role="alert">Could not reach the account service. Try again.</p>
        )}
      </form>
    </section>
  );
};

export default AccountPanel;
