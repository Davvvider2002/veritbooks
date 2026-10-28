import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { repo } from './data';
import type { Seal, SignedReport } from './data/repo';
import { currencyOf, jurisdictionOf } from './content/jurisdictions';
import { longDate } from './engine/report';
import { ErrorNote, message, useAction, useLoad } from './ui';

/** The address a seal is checked at. The QR code on the report opens it. */
export const verifyUrl = (code: string) => `${window.location.origin}/verify/${code}`;
/** The address printed under the QR code, short enough to type. */
export const verifyHost = () => `${window.location.host.replace(/^www\./, '')}/verify`;

const KIND: Record<string, string> = { audit: 'Audit', review: 'Review engagement', compilation: 'Compilation engagement' };
const OPINION: Record<string, string> = {
  unmodified: 'Unmodified',
  qualified: 'Qualified',
  adverse: 'Adverse',
  disclaimer: 'Disclaimer of opinion',
};

export const STATUS: Record<Seal['status'], { label: string; tone: 'ok' | 'warn' | 'bad'; text: string }> = {
  valid: { label: 'Valid', tone: 'ok', text: 'This report was signed as shown below and has not been changed since.' },
  reopened: {
    label: 'Reopened',
    tone: 'warn',
    text: 'The firm has reopened this file since signing, so this report may be amended. Ask the firm whether it still stands.',
  },
  superseded: { label: 'Superseded', tone: 'bad', text: 'A later signed report replaces this one. Rely on the later report, not this one.' },
  withdrawn: { label: 'Withdrawn', tone: 'bad', text: 'The firm has withdrawn this report. Do not rely on it.' },
};

/** A QR code for the seal's address, drawn as SVG so it prints sharply. */
export function SealQr({ code, size = 96 }: { code: string; size?: number }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    let live = true;
    QRCode.toString(verifyUrl(code), { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }).then((s) => live && setSvg(s), () => live && setSvg(''));
    return () => {
      live = false;
    };
  }, [code]);
  return <span className="seal-qr" role="img" aria-label={`QR code for verification code ${code}`} style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** The latest seal for a signed file, for the report sheet and the sign-off step. */
export function useSeal(engagementId: string, signedAt: string | null | undefined) {
  const { data, error, reload } = useLoad(() => (signedAt ? repo.listSeals(engagementId) : Promise.resolve([] as Seal[])), [engagementId, signedAt]);
  return { seal: data?.find((s) => s.status === 'valid') ?? null, all: data ?? [], error, reload };
}

/** The seal printed beside the signature on the report. */
export function SealMark({ seal }: { seal: Seal }) {
  return (
    <div className="seal-mark" aria-label="Verification seal">
      <SealQr code={seal.code} size={84} />
      <div className="small">
        <strong>Verification seal</strong>
        <br />
        Code {seal.code}
        <br />
        Check this report at {verifyHost()}
        <br />
        Sealed {new Date(seal.signedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
      </div>
    </div>
  );
}

async function downloadQr(code: string) {
  const url = await QRCode.toDataURL(verifyUrl(code), { width: 600, margin: 2, errorCorrectionLevel: 'M' });
  const a = document.createElement('a');
  a.href = url;
  a.download = `VeritBooks seal ${code}.png`;
  a.click();
}

/** On the Sign-off step: the seal issued at signing, and who may read the full report. */
export function SealCard({ engagementId, signedAt, partner }: { engagementId: string; signedAt: string | null; partner: boolean }) {
  const { seal, all, error, reload } = useSeal(engagementId, signedAt);
  const { busy, error: actError, run } = useAction();
  const [copied, setCopied] = useState('');
  if (!signedAt) return null;
  if (error) return <ErrorNote error={error} />;
  if (!seal)
    return (
      <div className="card">
        <h3>Verification seal</h3>
        <p className="small muted" style={{ marginBottom: 0 }}>
          {all.length ? 'No seal is valid for this file.' : 'This file was signed before seals were issued. Reopen and sign it again to issue one.'}
        </p>
      </div>
    );
  const copy = (text: string, what: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(what);
      setTimeout(() => setCopied(''), 2000);
    });
  };
  return (
    <div className="card stack" aria-label="Verification seal">
      <div className="between">
        <h3 style={{ margin: 0 }}>Verification seal</h3>
        <span className="tag ok">Valid</span>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        VeritBooks sealed the report when it was signed. The QR code and code are printed beside the signature. Anyone holding the report can scan it, or enter the code at {verifyHost()}, to confirm who signed it, when, and the headline figures. If you reopen the file, the seal shows as reopened. Signing again issues a new seal and marks this one superseded.
      </p>
      <div className="row" style={{ alignItems: 'flex-start', gap: 20 }}>
        <SealQr code={seal.code} size={132} />
        <div className="stack" style={{ gap: 6 }}>
          <div>
            <span className="small muted">Code</span>
            <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: 1 }}>{seal.code}</div>
          </div>
          <div className="small">
            <a href={verifyUrl(seal.code)} target="_blank" rel="noreferrer">
              {verifyUrl(seal.code)}
            </a>
          </div>
          <div className="row small">
            <button onClick={() => copy(verifyUrl(seal.code), 'link')}>{copied === 'link' ? 'Copied' : 'Copy link'}</button>
            <button onClick={() => void downloadQr(seal.code)}>Download QR code</button>
          </div>
          <div className="small muted">Fingerprint (SHA-256): <code style={{ wordBreak: 'break-all' }}>{seal.hash}</code></div>
        </div>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <h4 style={{ margin: 0 }}>Who may read the full report</h4>
        <p className="small muted" style={{ margin: 0 }}>
          With the code, anyone sees the summary: firm, partner, client, year end, engagement, opinion and headline figures. The full report opens only with the access code, which you give the client to pass to a bank, embassy or regulator, unless you open it to anyone with the code.
        </p>
        <div className="row">
          <span>
            Access code <strong style={{ letterSpacing: 1 }}>{seal.accessCode}</strong>
          </span>
          <button className="link" onClick={() => copy(seal.accessCode ?? '', 'access')}>
            {copied === 'access' ? 'Copied' : 'Copy'}
          </button>
        </div>
        <label className="row small">
          <input
            type="checkbox"
            checked={seal.reportOpen}
            disabled={!partner || busy}
            onChange={(e) => {
              const open = e.target.checked;
              void run(async () => {
                await repo.setSealSharing(seal.id!, open);
                reload();
              });
            }}
          />
          Anyone with the code may read the full report, without the access code
        </label>
        {!partner && <span className="small muted">Only a partner can change this.</span>}
        <ErrorNote error={actError} />
      </div>
      {all.length > 1 && (
        <div className="small muted">
          Earlier seals for this file:{' '}
          {all
            .filter((s) => s.code !== seal.code)
            .map((s) => `${s.code} (${STATUS[s.status].label.toLowerCase()})`)
            .join(', ')}
          .
        </div>
      )}
    </div>
  );
}

const money = (minor: number | undefined, currency: string | null) => {
  if (minor === undefined || minor === null) return '–';
  const v = Math.round(Math.abs(minor) / 100).toLocaleString('en-GB');
  return `${currencyOf(currency).symbol}${minor < 0 ? `(${v})` : v}`;
};

/** The public page. Reached from the QR code or by typing the code, with no sign-in. */
export function VerifyPage({ code }: { code?: string }) {
  const [input, setInput] = useState(code ?? '');
  const go = (c: string) => {
    const v = c.trim().toUpperCase();
    if (v) window.location.assign(`/verify/${encodeURIComponent(v)}`);
  };
  return (
    <div className="page verify" style={{ maxWidth: 760 }}>
      <h1 style={{ marginBottom: 4 }}>Verify a report</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Financial statements signed on VeritBooks carry a verification seal: a QR code and a code such as VB-7KQ4-M2XD beside the signature. Enter the code to confirm the report is genuine and see what was signed.
      </p>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          go(input);
        }}
      >
        <input type="text" aria-label="Verification code" placeholder="VB-XXXX-XXXX" value={input} onChange={(e) => setInput(e.target.value)} style={{ maxWidth: 220, textTransform: 'uppercase' }} />
        <button className="primary" type="submit">
          Verify
        </button>
      </form>
      {code && <SealResult code={code} />}
      <p className="small muted" style={{ marginTop: 32 }}>
        A seal confirms who signed the report, when, and that the details below match what was signed. It does not, by itself, speak to the quality of the work. For that, rely on the firm and its professional body.
      </p>
    </div>
  );
}

function SealResult({ code }: { code: string }) {
  const { data, error } = useLoad(() => repo.verifySeal(code), [code]);
  const [access, setAccess] = useState('');
  const [report, setReport] = useState<SignedReport | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const open = async (key: string) => {
    setBusy(true);
    setFailed(null);
    try {
      setReport(await repo.verifySealReport(code, key));
    } catch (e) {
      setFailed(message(e));
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorNote error={`The check could not be completed: ${error}`} />;
  if (data === undefined) return <p className="muted">Checking…</p>;
  if (data === null)
    return (
      <div className="banner bad" role="status" style={{ marginTop: 16 }}>
        <strong>No report carries the code {code.toUpperCase()}.</strong> Check the code against the report. If it is right, the report was not sealed on VeritBooks, and you should ask the firm named on it to confirm it.
      </div>
    );

  const s = data;
  const st = STATUS[s.status];
  const f = s.figures;
  const npo = !!f.npo;
  const country = s.country ? jurisdictionOf(s.country) : null;
  const rows: [string, string | null][] = [
    ['Entity', s.clientName + (s.clientNumber ? ` (${s.clientNumber})` : '')],
    ['Financial year ended', longDate(s.yearEnd)],
    ['Engagement', KIND[s.type] ?? s.type],
    ['Opinion', s.type === 'audit' && s.opinion ? (OPINION[s.opinion] ?? s.opinion) : s.type === 'review' ? 'Review conclusion' : null],
    ['Signed by', s.partnerName ? `${s.partnerName}${s.partnerLicence ? ` (${s.partnerLicence})` : ''}` : null],
    ['For', s.firmName + (s.firmLicence ? ` (${s.firmLicence})` : '') + (country ? `, ${country.name}` : '')],
    ['Signed on', new Date(s.signedAt).toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' })],
    ['Reopened on', s.reopenedAt ? new Date(s.reopenedAt).toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' }) : null],
    ['Replaced by', s.supersededBy],
  ];
  const figures: [string, number | undefined][] = [
    [npo ? 'Total income' : 'Revenue', f.revenue],
    [npo ? 'Surplus (deficit) for the year' : 'Profit (loss) for the year', f.result],
    ['Total assets', f.totalAssets],
    [npo ? 'Net assets (fund balances)' : 'Total equity', f.netAssets],
  ];
  return (
    <div className="stack" style={{ marginTop: 20 }}>
      <div className={`banner ${st.tone === 'ok' ? 'info' : st.tone}`} role="status">
        <strong>
          {s.code}: {st.label}.
        </strong>{' '}
        {st.text}
        {s.supersededBy && (
          <>
            {' '}
            <a href={`/verify/${s.supersededBy}`}>See the later report, {s.supersededBy}.</a>
          </>
        )}
      </div>
      <div className="card">
        <table className="data verify-table">
          <tbody>
            {rows
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <tr key={k}>
                  <th style={{ width: '38%' }}>{k}</th>
                  <td>{v}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {f.revenue !== undefined && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Headline figures, as signed</h3>
          <p className="small muted">Compare these with the statements you hold. They should agree exactly.</p>
          <table className="data">
            <tbody>
              {figures.map(([k, v]) => (
                <tr key={k}>
                  <th style={{ width: '60%' }}>{k}</th>
                  <td className="num">{money(v, s.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="card stack">
        <h3 style={{ margin: 0 }}>The report as signed</h3>
        {report ? (
          <div className="sheet verify-report">
            <h2>{report.title}</h2>
            <div className="sub">{report.addressee}</div>
            {report.sections.map((sec, i) => (
              <div key={i}>
                {sec.heading && <h3>{sec.heading}</h3>}
                {sec.paragraphs.map((p, j) => (
                  <p key={j}>{p}</p>
                ))}
              </div>
            ))}
            <p className="small muted">
              Signed by {s.partnerName} for {s.firmName} on {longDate(s.signedAt.slice(0, 10))}.
            </p>
          </div>
        ) : s.reportOpen ? (
          <div>
            <button disabled={busy} onClick={() => void open('')}>
              Show the report
            </button>
          </div>
        ) : (
          <>
            <p className="small muted" style={{ margin: 0 }}>
              The firm has kept the full report private. Enter the access code the company gave you to read it.
            </p>
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                void open(access);
              }}
            >
              <input type="text" aria-label="Access code" placeholder="Access code" maxLength={6} value={access} onChange={(e) => setAccess(e.target.value)} style={{ maxWidth: 160, textTransform: 'uppercase' }} />
              <button disabled={busy || access.trim().length < 6} type="submit">
                Show the report
              </button>
            </form>
          </>
        )}
        <ErrorNote error={failed} />
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        Fingerprint (SHA-256): <code style={{ wordBreak: 'break-all' }}>{s.hash}</code>
      </p>
    </div>
  );
}
