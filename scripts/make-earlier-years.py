"""Makes the 2022 and 2021 sample trial balances for Adunni Foods Limited, and the five-year file.

Each earlier year follows on from the one after it: its closing retained earnings (the retained
earnings in its trial balance, plus its profit, less its dividends) equal the retained earnings
brought forward in the next year's trial balance, so the cash flows and the statement of changes
in equity reconcile from one year to the next. The bank balance is the balancing figure.
Run with: python3 scripts/make-earlier-years.py
"""
import csv, io

def read(year):
    rows = list(csv.reader(open(f'public/samples/trial-balance-{year}.csv')))
    out = {}
    for r in rows:
        if len(r) >= 4 and r[0].isdigit():
            dr = float(r[2].replace(',', '') or 0)
            cr = float(r[3].replace(',', '') or 0)
            out[r[0]] = (r[1], round(dr - cr, 2))
    return out

PL = lambda code: code[0] in '4567'
def profit(tb):
    return -sum(v for c, (_, v) in tb.items() if PL(c))

# How each earlier year differs from the next: sales and costs grow about 11% a year, fixed assets
# are bought, the loan is drawn down. Factors apply to the later year's balance.
FACTOR = {
    '1000': 1.0, '1010': 0.85, '1090': 0.75, '1020': 0.9, '1200': 0.88, '1300': 0.89, '1310': 0.9, '1350': 0.9, '1410': 1.0,
    '2000': 0.9, '2100': 0.9, '2110': 0.9, '2120': 0.9, '2200': 0.85, '2300': 1.2, '3000': 1.0, '3200': 0.66,
    '4000': 0.9, '4100': 0.8, '5000': 0.9, '6000': 0.9, '6010': 0.9, '6100': 0.95, '6200': 0.9, '6210': 0.9,
    '6220': 0.9, '6230': 0.9, '6300': 0.85, '6400': 1.1, '7000': 0.85,
}

def earlier(later):
    tb = {}
    for code, (name, v) in later.items():
        if code in ('3100', '1400'):
            continue
        tb[code] = (name, round(v * FACTOR.get(code, 0.9) / 1000) * 1000)
    # Retained earnings brought forward, so that this year's closing figure is the next year's opening one.
    div = tb['3200'][1]
    tb['3100'] = (later['3100'][0], round(later['3100'][1] + profit(tb) - div, 2))
    # The bank is what makes the trial balance foot.
    tb['1400'] = (later['1400'][0], round(-sum(v for _, v in tb.values()), 2))
    return dict(sorted(tb.items()))

def money(v):
    return f'{abs(v):,.2f}'

def write(year, tb):
    f = io.StringIO()
    w = csv.writer(f, lineterminator='\n')
    w.writerow(['Adunni Foods Limited (sample data)'])
    w.writerow([f'Trial balance as at 31 December {year}'])
    w.writerow([])
    w.writerow(['Account code', 'Account name', 'Debit', 'Credit'])
    for code, (name, v) in tb.items():
        w.writerow([code, name, money(v) if v > 0 else '', money(v) if v < 0 else ''])
    open(f'public/samples/trial-balance-{year}.csv', 'w').write(f.getvalue())

tbs = {y: read(y) for y in (2025, 2024, 2023)}
tbs[2022] = earlier(tbs[2023])
tbs[2021] = earlier(tbs[2022])
for y in (2022, 2021):
    assert tbs[y]['1400'][1] > 0, f'{y} bank went overdrawn'
    assert abs(sum(v for _, v in tbs[y].values())) < 0.005
    write(y, tbs[y])

f = io.StringIO()
w = csv.writer(f, lineterminator='\n')
w.writerow(['Adunni Foods Limited (sample data)'])
w.writerow(['Comparative trial balance, five years. Credit balances in brackets.'])
w.writerow([])
years = [2025, 2024, 2023, 2022, 2021]
w.writerow(['Account code', 'Account name'] + [f'31 Dec {y}' for y in years])
codes = sorted(set().union(*[tbs[y].keys() for y in years]))
for c in codes:
    name = next(tbs[y][c][0] for y in years if c in tbs[y])
    vals = [tbs[y].get(c, (name, 0))[1] for y in years]
    w.writerow([c, name] + [money(v) if v >= 0 else f'({money(v)})' for v in vals])
open('public/samples/trial-balance-5-years.csv', 'w').write(f.getvalue())
print({y: tbs[y]['1400'][1] for y in years}, {y: tbs[y]['3100'][1] for y in years})
