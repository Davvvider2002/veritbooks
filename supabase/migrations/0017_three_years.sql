-- VeritBooks: a third year of balances. Run once, after 0016. Nothing is removed.
-- Each account can now hold the year before the prior year, so up to three years can be
-- imported at once. It is used for trends in the analytical review and in the financial summary.
alter table public.tb_lines add column prior2_balance bigint;
