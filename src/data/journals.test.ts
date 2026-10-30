import { beforeAll, describe, expect, it } from 'vitest';
import type { Repo } from './repo';
import { purgeLines } from '../engine/merge';

const mem = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
};

describe('deleting journals passed (demo store)', () => {
  let repo: Repo;
  let engId = '';

  beforeAll(async () => {
    repo = (await import('./demo')).createDemoRepo();
    await repo.signUp('ada@jnl.example', 'password123', '+234 803 123 4567');
    await repo.createFirm({ country: 'NG', name: 'Okafor & Bello', frcNumber: '', address: 'Lagos', fullName: 'Ada Okafor', memberFrc: '' });
    const client = await repo.createClient({ name: 'Adunni Foods Limited' } as any);
    engId = (await repo.createEngagement({ clientId: client.id, type: 'audit', yearEnd: '2025-12-31', programmeVersion: 'v1' })).id;
    await repo.replaceLines(engId, [
      { code: '1000', name: 'Bank', balance: 500000, prior: 300000, mapCode: 'cash' },
      { code: '4000', name: 'Sales', balance: -500000, prior: -300000, mapCode: 'revenue' },
      { code: '6000', name: 'Rent', balance: 0, mapCode: null },
    ] as any);
    const [bank, sales, rent] = await repo.listLines(engId);
    for (const ref of ['J1', 'J2', 'BR1'])
      await repo.addAdjustment(engId, { ref, description: ref, posted: true, lines: [{ lineId: rent.id, amount: 1000 }, { lineId: ref === 'BR1' ? bank.id : sales.id, amount: -1000 }] });
  });

  it('deletes the journals ticked and leaves the rest', async () => {
    const all = await repo.listAdjustments(engId);
    await repo.deleteAdjustments(all.filter((a) => a.ref !== 'BR1').map((a) => a.id));
    expect((await repo.listAdjustments(engId)).map((a) => a.ref)).toEqual(['BR1']);
  });

  it('a purge that deletes the journals clears the year without holding accounts for them', async () => {
    const lines = await repo.listLines(engId);
    const adj = await repo.listAdjustments(engId);
    // Kept: the account the journal posts to stays at nil to hold it.
    expect(purgeLines(lines, adj, 'current').map((l) => l.code).sort()).toEqual(['1000', '4000', '6000']);
    await repo.deleteAdjustments(adj.map((a) => a.id));
    await repo.replaceLines(engId, purgeLines(lines, [], 'current'));
    const after = await repo.listLines(engId);
    expect(await repo.listAdjustments(engId)).toEqual([]);
    expect(after.map((l) => l.code).sort()).toEqual(['1000', '4000']);
    expect(after.every((l) => l.balance === 0)).toBe(true);
    expect(after.find((l) => l.code === '1000')?.prior).toBe(300000);
  });
});
