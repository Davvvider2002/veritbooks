-- 0027: restricted funds for not-for-profit engagements.
--
-- A not-for-profit's income, expenditure and fund balances can be tagged to a restricted fund
-- (a grant, a project or a donor). The statements split the surplus between restricted and
-- unrestricted funds from these tags, and show each fund's movement in a note. Companies leave
-- it blank, and nothing about them changes. Whether an engagement is for a not-for-profit is
-- kept with its planning, which needs no change here.

alter table public.tb_lines add column if not exists fund text check (fund is null or length(fund) <= 80);
