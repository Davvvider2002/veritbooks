import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Repo } from './repo';

// Demo mode keeps its store in browser storage. A small stand-in lets it run here.
const mem = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
};

const fresh = async (): Promise<Repo> => {
  vi.resetModules();
  return (await import('./demo')).createDemoRepo();
};

describe('verification seal (demo store, as migration 0029)', () => {
  let repo: Repo;
  let engId = '';

  beforeAll(async () => {
    repo = await fresh();
    await repo.signUp('ada@seal.example', 'password123', '+234 803 123 4567');
    await repo.createFirm({ country: 'NG', name: 'Okafor & Bello', frcNumber: 'FRC/F/1', address: 'Lagos', fullName: 'Ada Okafor', memberFrc: 'FRC/P/1' });
    const client = await repo.createClient({ name: 'Adunni Foods Limited', rcNumber: 'RC 12345' } as any);
    const eng = await repo.createEngagement({ clientId: client.id, type: 'audit', yearEnd: '2025-12-31', programmeVersion: 'v1' });
    engId = eng.id;
    await repo.replaceLines(eng.id, [
      { code: '1000', name: 'Bank', balance: 500000, mapCode: 'cash' },
      { code: '4000', name: 'Sales', balance: -500000, mapCode: 'revenue' },
    ] as any);
    // Paid for on its own, so it can be signed outside a plan.
    const KEY = [...mem.keys()][0];
    const store = JSON.parse(mem.get(KEY)!);
    store.engagements.find((e: any) => e.id === engId).payPer = true;
    mem.set(KEY, JSON.stringify(store));
    repo = await fresh();
    const report = { title: 'Independent auditor’s report', addressee: 'To the members', sections: [{ heading: 'Opinion', paragraphs: ['True and fair.'] }] };
    await repo.updateEngagement(engId, { report: { opinion: 'unmodified', signedReport: report, signedFigures: { revenue: 500000, result: 500000, totalAssets: 500000, netAssets: 500000 } } });
    await repo.sign(engId);
  });

  it('issues a valid seal with a readable code, fingerprint and access code', async () => {
    const [seal] = await repo.listSeals(engId);
    expect(seal.code).toMatch(/^VB-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
    expect(seal.status).toBe('valid');
    expect(seal.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(seal.accessCode).toMatch(/^[A-Z2-9]{6}$/);
    expect(seal).toMatchObject({ partnerName: 'Ada Okafor', clientName: 'Adunni Foods Limited', clientNumber: 'RC 12345', opinion: 'unmodified', figures: { revenue: 500000 } });
  });

  it('shows the public the summary, never the access code', async () => {
    const [seal] = await repo.listSeals(engId);
    const pub = await repo.verifySeal(` ${seal.code.toLowerCase()} `);
    expect(pub?.status).toBe('valid');
    expect(pub).not.toHaveProperty('accessCode');
    expect(await repo.verifySeal('VB-ZZZZ-ZZZZ')).toBeNull();
  });

  it('opens the full report only with the access code, or once the partner allows it', async () => {
    const [seal] = await repo.listSeals(engId);
    await expect(repo.verifySealReport(seal.code, 'WRONG1')).rejects.toThrow(/access code is not right/);
    expect((await repo.verifySealReport(seal.code, seal.accessCode!.toLowerCase())).sections[0].paragraphs[0]).toBe('True and fair.');
    await repo.setSealSharing(seal.id!, true);
    expect((await repo.verifySealReport(seal.code, '')).title).toBe('Independent auditor’s report');
  });

  it('marks the seal reopened, then superseded when the file is signed again', async () => {
    const [first] = await repo.listSeals(engId);
    await repo.reopen(engId, 'documentation', 'Review notes answered after assembly of the file', 'None, the opinion stands');
    expect((await repo.verifySeal(first.code))?.status).toBe('reopened');
    await repo.sign(engId);
    const [latest] = await repo.listSeals(engId);
    const old = await repo.verifySeal(first.code);
    expect(latest.version).toBe(first.version + 1);
    expect(latest.status).toBe('valid');
    expect(old?.status).toBe('superseded');
    expect(old?.supersededBy).toBe(latest.code);
  });
});
