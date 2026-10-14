import { useEffect, useState } from 'react';
import { repo } from './data';
import { ErrorNote, Field, message, useAction } from './ui';

/** Ten backup codes, shown once, with a way to keep them. */
export function BackupCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [kept, setKept] = useState(false);
  const text = `VeritBooks backup codes\nEach code works once, if you lose your authenticator.\n\n${codes.join('\n')}\n`;
  return (
    <div className="stack" aria-label="Backup codes">
      <p style={{ margin: 0 }}>
        If you lose your phone, one of these codes lets you back in. Each works once. They are shown only now, so keep them somewhere safe, away from your phone.
      </p>
      <ol className="backup-codes">
        {codes.map((c) => (
          <li key={c}>
            <code>{c}</code>
          </li>
        ))}
      </ol>
      <div className="row">
        <button type="button" onClick={() => void navigator.clipboard?.writeText(text).then(() => setKept(true))}>
          Copy
        </button>
        <a
          className="btn-like"
          href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`}
          download="veritbooks-backup-codes.txt"
          onClick={() => setKept(true)}
        >
          Download
        </a>
        <button type="button" onClick={() => window.print()}>
          Print
        </button>
      </div>
      <label className="row small" style={{ flexWrap: 'nowrap' }}>
        <input type="checkbox" checked={kept} onChange={(e) => setKept(e.target.checked)} />
        <span>I have saved these codes.</span>
      </label>
      <div>
        <button className="primary" disabled={!kept} onClick={onDone}>
          Continue
        </button>
      </div>
    </div>
  );
}

/**
 * The second step of signing in, or setting it up. Shown full page at sign-in, or inside a card in
 * Firm details. required: the person cannot go on without it (admins).
 */
export function SecondFactor({ enrolled, onDone, required = false, inCard = false, onCancel }: { enrolled: boolean; onDone: () => void; required?: boolean; inCard?: boolean; onCancel?: () => void }) {
  const [setup, setSetup] = useState<{ factorId: string; qr: string | null; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<'code' | 'backup'>('code');
  const [backup, setBackup] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { busy, error, run } = useAction();
  useEffect(() => {
    if (!enrolled) void run(async () => setSetup(await repo.mfaEnroll()));
  }, []);

  const verify = () =>
    void run(async () => {
      await repo.mfaVerify(setup?.factorId ?? null, code);
      // A new authenticator gets its backup codes straight away.
      if (!enrolled) setCodes(await repo.createBackupCodes().catch(() => []));
      else onDone();
    });

  const title = codes ? 'Save your backup codes' : mode === 'backup' ? 'Use a backup code' : enrolled ? 'Enter your code' : 'Set up two-factor authentication';
  const body = codes ? (
    codes.length ? <BackupCodes codes={codes} onDone={onDone} /> : <div><button className="primary" onClick={onDone}>Continue</button></div>
  ) : mode === 'backup' ? (
    <form
      className={inCard ? 'stack' : 'card stack'}
      onSubmit={(e) => {
        e.preventDefault();
        void run(async () => {
          setNotice(await repo.recoverWithBackupCode(backup));
          setTimeout(onDone, 2500);
        });
      }}
    >
      <p className="small" style={{ margin: 0 }}>
        Enter one of the backup codes you saved when you set up two-factor. Your lost authenticator is removed, and you continue with your password.{required ? ' You then set up a new authenticator.' : ''}
      </p>
      <Field label="Backup code">
        <input type="text" required autoComplete="off" value={backup} onChange={(e) => setBackup(e.target.value)} placeholder="XXXX-XXXX" />
      </Field>
      <ErrorNote error={error} />
      {notice && <div className="banner info">{notice}</div>}
      <div className="row">
        <button className="primary" disabled={busy || !!notice}>Use backup code</button>
        <button type="button" className="link" onClick={() => setMode('code')}>Back</button>
      </div>
    </form>
  ) : (
    <form
      className={inCard ? 'stack' : 'card stack'}
      onSubmit={(e) => {
        e.preventDefault();
        verify();
      }}
    >
      {!enrolled && (
        <>
          <ol className="small" style={{ margin: 0, paddingLeft: 18 }}>
            <li>In your authenticator app, add an account.</li>
            <li>Scan this code, or type the key below.</li>
            <li>Enter the six-digit code the app shows.</li>
          </ol>
          {setup?.qr && <img src={setup.qr} alt="QR code to add VeritBooks to an authenticator app" className="mfa-qr" />}
          {setup && (
            <div>
              <div className="small muted">Key</div>
              <code className="mfa-secret" aria-label="Authenticator key">{setup.secret.replace(/(.{4})/g, '$1 ').trim()}</code>
            </div>
          )}
          {!setup && !error && <span className="muted">Preparing…</span>}
        </>
      )}
      <Field label="Six-digit code">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoFocus={!inCard}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        />
      </Field>
      <ErrorNote error={error} />
      <div className="row">
        <button className="primary" disabled={busy || code.length !== 6 || (!enrolled && !setup)}>
          {enrolled ? 'Verify' : 'Turn on'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
        {enrolled && (
          <button type="button" className="link" onClick={() => setMode('backup')}>
            Lost your phone? Use a backup code
          </button>
        )}
      </div>
    </form>
  );

  if (inCard) return <div className="stack">{body}</div>;
  return (
    <div className="narrow stack">
      <div>
        <h1>{title}</h1>
        {!codes && mode === 'code' && (
          <p className="muted" style={{ marginTop: 6 }}>
            {enrolled
              ? 'Open your authenticator app and enter the six-digit code shown for VeritBooks.'
              : `${required ? 'The admin console needs a second step at every sign-in. ' : ''}Use an authenticator app such as Google Authenticator, Microsoft Authenticator or 1Password.`}
          </p>
        )}
      </div>
      {body}
      {!codes && mode === 'code' && !enrolled && (
        <p className="small muted">Keep the key somewhere safe, such as a password manager. Anyone with it can produce your codes. You get backup codes next.</p>
      )}
      {!codes && mode === 'code' && enrolled && required && (
        <p className="small muted">No backup codes either? Another admin can reset your authenticator from the Sign-ups tab, or it can be cleared in the Supabase dashboard under Authentication.</p>
      )}
    </div>
  );
}

/** A partner's own two-factor setting, in Firm details. Optional. */
export function TwoFactorSetting() {
  const [state, setState] = useState<{ enrolled: boolean; left: number } | null>(null);
  const [mode, setMode] = useState<'idle' | 'setup' | 'codes' | 'off'>('idle');
  const [codes, setCodes] = useState<string[]>([]);
  const { busy, error, run, setError } = useAction();
  const load = () =>
    repo
      .mfaStatus()
      .then(async (m) => setState({ enrolled: m.enrolled, left: m.enrolled ? await repo.backupCodesLeft().catch(() => 0) : 0 }))
      .catch((e) => setError(message(e)));
  useEffect(() => {
    void load();
  }, []);
  if (!state) return null;
  return (
    <section className="card stack" aria-label="Two-factor authentication">
      <div className="between">
        <h3>Two-factor authentication</h3>
        <span className={`tag ${state.enrolled ? 'ok' : ''}`}>{state.enrolled ? 'On' : 'Off'}</span>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        Optional, and recommended for partners. With it on, signing in to your account also needs a six-digit code from an authenticator app on your phone, so a stolen password alone does not open your firm’s files. This applies to your account only.
      </p>
      <ErrorNote error={error} />
      {mode === 'setup' && (
        <SecondFactor
          enrolled={false}
          inCard
          onCancel={() => setMode('idle')}
          onDone={() => {
            setMode('idle');
            void load();
          }}
        />
      )}
      {mode === 'codes' && (
        <BackupCodes
          codes={codes}
          onDone={() => {
            setMode('idle');
            void load();
          }}
        />
      )}
      {mode === 'off' && (
        <div className="banner warn stack" style={{ gap: 10 }}>
          <span>Turn off two-factor authentication? Your account will be protected by your password alone, and your backup codes will stop working.</span>
          <div className="row">
            <button
              className="danger"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await repo.mfaDisable();
                  setMode('idle');
                  await load();
                })
              }
            >
              Turn off
            </button>
            <button onClick={() => setMode('idle')}>Keep it on</button>
          </div>
        </div>
      )}
      {mode === 'idle' &&
        (state.enrolled ? (
          <div className="stack" style={{ gap: 10 }}>
            <span className="small">
              {state.left} backup code{state.left === 1 ? '' : 's'} left.{state.left <= 3 ? ' Make new ones before you run out.' : ''}
            </span>
            <div className="row">
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    setCodes(await repo.createBackupCodes());
                    setMode('codes');
                  })
                }
              >
                Make new backup codes
              </button>
              <button className="link danger" onClick={() => setMode('off')}>
                Turn off two-factor
              </button>
            </div>
          </div>
        ) : (
          <div>
            <button className="primary" onClick={() => setMode('setup')}>
              Turn on two-factor
            </button>
          </div>
        ))}
    </section>
  );
}
