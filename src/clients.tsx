import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { repo } from './data';
import type { Client, Engagement, Workspace } from './data/repo';
import { longDate } from './engine/report';
import { readLogo } from './image';
import { TYPE_LABEL } from './pages';
import { ErrorNote, Field, useAction, useLoad } from './ui';

const PLACEMENT = { left: 'Left', centre: 'Centre', right: 'Right' } as const;

/** A partner changes a client's name, RC number and logo here. */
function ClientEditor({ client, engagements, canEdit, onSaved }: { client: Client; engagements: Engagement[]; canEdit: boolean; onSaved: () => void }) {
  const [f, setF] = useState({ name: client.name, rcNumber: client.rcNumber, logo: client.logo ?? null, logoPlacement: client.logoPlacement ?? 'centre' });
  const [saved, setSaved] = useState(false);
  const { busy, error, run, setError } = useAction();
  const signed = engagements.filter((e) => e.status === 'locked').length;
  const changed = f.name !== client.name || f.rcNumber !== client.rcNumber || f.logo !== (client.logo ?? null) || f.logoPlacement !== (client.logoPlacement ?? 'centre');
  return (
    <form
      className="stack client-edit"
      aria-label={`Details of ${client.name}`}
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        void run(async () => {
          await repo.updateClient(client.id, f);
          setSaved(true);
          onSaved();
        });
      }}
    >
      <div className="grid2">
        <Field label="Company name">
          <input type="text" required disabled={!canEdit} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Registration number" hint="RC number in Nigeria.">
          <input type="text" disabled={!canEdit} value={f.rcNumber} onChange={(e) => setF({ ...f, rcNumber: e.target.value })} />
        </Field>
      </div>
      <div className="grid2">
        <Field label="Client logo" hint="Shown on the cover of this client's financial statements.">
          <div className="row">
            {f.logo ? <img className="logo-preview" src={f.logo} alt={`${client.name} logo`} /> : <span className="small muted">No logo</span>}
            {canEdit && (
              <>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  aria-label={`Logo for ${client.name}`}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setError(null);
                    void readLogo(file).then((logo) => setF((x) => ({ ...x, logo })), (err) => setError(err instanceof Error ? err.message : String(err)));
                  }}
                />
                {f.logo && (
                  <button type="button" className="link danger" onClick={() => setF({ ...f, logo: null })}>
                    Remove logo
                  </button>
                )}
              </>
            )}
          </div>
        </Field>
        <Field label="Logo position on the cover">
          <select disabled={!canEdit} value={f.logoPlacement} onChange={(e) => setF({ ...f, logoPlacement: e.target.value as keyof typeof PLACEMENT })}>
            {Object.entries(PLACEMENT).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {canEdit && signed > 0 && f.name !== client.name && (
        <div className="banner warn">
          {signed} signed file{signed === 1 ? '' : 's'} for this client will also show the new name on screen and when printed again. The signed report wording keeps the name it was signed with.
        </div>
      )}
      <ErrorNote error={error} />
      {saved && !changed && <div className="banner info">Saved.</div>}
      {canEdit ? (
        <div>
          <button className="primary" disabled={busy || !changed}>
            Save client
          </button>
        </div>
      ) : (
        <span className="small muted">Only a partner can change a client’s details.</span>
      )}
    </form>
  );
}

/** Every client of the firm, with their engagements. */
export function ClientsPage({ ws }: { ws: Workspace }) {
  const [params, setParams] = useSearchParams();
  const openId = params.get('c');
  const [q, setQ] = useState('');
  const { data, error, reload } = useLoad(async () => ({ clients: await repo.listClients(), engagements: await repo.listEngagements() }), []);
  const partner = ws.me.role === 'partner';
  if (error) return <div className="page"><ErrorNote error={error} /></div>;
  if (!data) return <div className="page muted">Loading…</div>;
  const rows = data.clients.filter((c) => !q.trim() || `${c.name} ${c.rcNumber}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="page stack">
      <div className="between">
        <h1>Clients</h1>
        <Link to="/" className="small">
          New client or engagement
        </Link>
      </div>
      <input type="search" aria-label="Search clients" placeholder="Search by name or registration number" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 360 }} />
      {rows.length === 0 && <p className="muted">{data.clients.length ? 'No clients match.' : 'No clients yet. Add one from the Engagements page.'}</p>}
      {rows.map((c) => {
        const engs = data.engagements.filter((e) => e.clientId === c.id);
        const open = openId === c.id;
        return (
          <section key={c.id} className="card stack" aria-label={c.name}>
            <div className="between" style={{ alignItems: 'center' }}>
              <div className="row" style={{ gap: 14 }}>
                {c.logo && <img src={c.logo} alt="" style={{ maxHeight: 36, maxWidth: 90 }} />}
                <div>
                  <h3 style={{ margin: 0 }}>{c.name}</h3>
                  <div className="small muted">
                    {c.rcNumber ? `No. ${c.rcNumber} · ` : ''}
                    {engs.length} engagement{engs.length === 1 ? '' : 's'}
                  </div>
                </div>
              </div>
              <button aria-label={`${open ? 'Close' : partner ? 'Edit' : 'View'} ${c.name}`} onClick={() => setParams(open ? {} : { c: c.id })}>
                {open ? 'Close' : partner ? 'Edit details' : 'Details'}
              </button>
            </div>
            {engs.length > 0 && (
              <table className="data">
                <tbody>
                  {engs.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <Link to={`/engagements/${e.id}`}>
                          {TYPE_LABEL[e.type]}, year ended {longDate(e.yearEnd)}
                        </Link>
                      </td>
                      <td className="small muted">{e.fileNo ? `File no. ${e.fileNo}` : ''}</td>
                      <td style={{ textAlign: 'right' }}>{e.status === 'locked' ? <span className="tag ok">Signed</span> : <span className="tag">In progress</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {open && <ClientEditor client={c} engagements={engs} canEdit={partner} onSaved={reload} />}
          </section>
        );
      })}
    </div>
  );
}
