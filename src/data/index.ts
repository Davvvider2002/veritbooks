import { createDemoRepo } from './demo';
import type { Repo } from './repo';
import { createSupabaseRepo } from './supabase';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** Supabase when its keys are configured, otherwise demo mode in this browser. */
export const repo: Repo = url && key ? createSupabaseRepo(url, key) : createDemoRepo();
