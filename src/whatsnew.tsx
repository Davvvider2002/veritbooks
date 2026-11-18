import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { latestRelease, RELEASES, type Release } from './content/releases';
import { longDate } from './engine/report';

// Which release each user last read is kept in this browser only. It is a convenience: if the
// browser forgets, the newest release simply shows as unread again.
const key = (userId: string) => `veritbooks.whatsnew.${userId}`;
const SEEN_EVENT = 'veritbooks:whatsnew-seen';

function readSeen(userId: string): string | null {
  try {
    return localStorage.getItem(key(userId));
  } catch {
    return null;
  }
}

export function markSeen(userId: string) {
  try {
    localStorage.setItem(key(userId), latestRelease.id);
  } catch {
    // Storage blocked: nothing to remember.
  }
  window.dispatchEvent(new Event(SEEN_EVENT));
}

/** Whether the newest release is unread for this user. */
export function useUnseen(userId: string): boolean {
  const [seen, setSeen] = useState(() => readSeen(userId));
  useEffect(() => {
    const update = () => setSeen(readSeen(userId));
    window.addEventListener(SEEN_EVENT, update);
    return () => window.removeEventListener(SEEN_EVENT, update);
  }, [userId]);
  return seen !== latestRelease.id;
}

/** The link in the top bar, with a dot while the newest release is unread. */
export function WhatsNewLink({ userId }: { userId: string }) {
  const unseen = useUnseen(userId);
  return (
    <Link to="/whats-new" className="small whatsnew-link" aria-label={unseen ? 'What’s new, unread release' : 'What’s new'}>
      What’s new
      {unseen && <span className="whatsnew-dot" aria-hidden="true" />}
    </Link>
  );
}

/** On the engagements page, while the newest release is unread. */
export function WhatsNewBanner({ userId }: { userId: string }) {
  const unseen = useUnseen(userId);
  if (!unseen) return null;
  return (
    <div className="banner info whatsnew-banner" role="status">
      <span className="whatsnew-tag">New</span>
      <span>
        <strong>{latestRelease.title}.</strong> <span className="muted">{longDate(latestRelease.date)}</span>
      </span>
      <span className="spacer" />
      <Link to="/whats-new" className="button-link">
        See how it works
      </Link>
      <button className="link" onClick={() => markSeen(userId)}>
        Dismiss
      </button>
    </div>
  );
}

function ReleaseArticle({ r }: { r: Release }) {
  return (
    <article className="card stack release" id={`release-${r.id}`} aria-labelledby={`release-${r.id}-title`}>
      <div className="release-meta small muted">
        <time dateTime={r.date}>{longDate(r.date)}</time> · Release {r.id}
        {r.id === latestRelease.id && <span className="whatsnew-tag">Latest</span>}
      </div>
      <h2 id={`release-${r.id}-title`} style={{ margin: 0 }}>
        {r.title}
      </h2>
      <p style={{ margin: 0 }}>{r.summary}</p>
      <div>
        <h3 className="release-h">What’s new</h3>
        <ul className="release-list">
          {r.highlights.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="release-h">How to use it</h3>
        <ol className="release-steps">
          {r.steps.map((s, i) => (
            <li key={i}>
              <span className="release-num" aria-hidden="true">
                {i + 1}
              </span>
              <div className="stack" style={{ gap: 8 }}>
                <strong>{s.title}</strong>
                <p style={{ margin: 0 }}>{s.text}</p>
                {s.image && (
                  <a href={s.image} target="_blank" rel="noreferrer" className="release-shot" title="Open full size">
                    <img src={s.image} alt={s.alt ?? s.title} loading="lazy" decoding="async" />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
      {r.note && <div className="banner warn small">{r.note}</div>}
    </article>
  );
}

/** Every release, newest first, with how to use each. Opening it marks the newest as read. */
export function WhatsNewPage({ userId }: { userId: string }) {
  useEffect(() => {
    markSeen(userId);
    window.scrollTo(0, 0);
  }, [userId]);
  return (
    <div className="page whatsnew">
      <div className="stack" style={{ gap: 6, marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>What’s new in VeritBooks</h1>
        <p className="muted" style={{ margin: 0 }}>
          New features and improvements, newest first, with a short guide to using each one.
        </p>
      </div>
      <div className="whatsnew-layout">
        <nav className="whatsnew-index small" aria-label="Releases">
          {RELEASES.map((r) => (
            <a key={r.id} href={`#release-${r.id}`}>
              <span className="muted">{longDate(r.date)}</span>
              <br />
              {r.title}
            </a>
          ))}
        </nav>
        <div className="stack" style={{ gap: 24 }}>
          {RELEASES.map((r) => (
            <ReleaseArticle key={r.id} r={r} />
          ))}
        </div>
      </div>
    </div>
  );
}
