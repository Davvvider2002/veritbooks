"""Draws the South African sample bank statement as a PDF laid out like a South African business
cheque account statement: Date, Description, Amount, Balance and Accrued Bank Charges columns,
dates printed without a year (the year comes from the statement period), money in marked Cr,
money out unmarked, balances marked Cr. Run after make-za-bank.mjs:
  python3 scripts/make-za-bank-pdf.py
"""
import csv
from datetime import date
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

rows = list(csv.reader(open('public/samples/za-bank-statement-2025.csv')))
head = next(i for i, r in enumerate(rows) if r and r[0] == 'Date')
data = rows[head + 1:]
W, H = A4
X_DATE, X_DESC, R_AMT, R_BAL, R_ACC = 28, 76, 385, 465, 568
FONT, SIZE, LEAD = 'Helvetica', 7.5, 10.5
money = lambda v: '{:,.2f}'.format(abs(v))
def amt(v): return money(v) + ('Cr' if v > 0 else '')
def bal(v): return money(v) + ('Cr' if v >= 0 else 'Dr')
def short(d):
    y, m, dd = map(int, d.split('/'))
    return date(y, m, dd).strftime('%d %b')

def build(path):
    c = canvas.Canvas(path, pagesize=A4, pageCompression=1)
    page, y = 0, 0
    def new_page():
        nonlocal y, page
        if page: c.showPage()
        page += 1
        c.setFont('Helvetica-Bold', 13); c.drawString(28, H - 40, 'Sample Bank South Africa')
        c.setFont(FONT, 8)
        c.drawString(28, H - 54, 'ADUNNI FOODS (PTY) LTD')
        c.drawString(28, H - 65, 'Business Cheque Account  62000044471    Branch code 250655')
        c.drawString(28, H - 76, 'Statement Period : 01 January 2025 to 31 December 2025')
        c.drawRightString(R_ACC, H - 54, 'Tax invoice / statement  Page %d' % page)
        c.drawRightString(R_ACC, H - 65, 'VAT registration number 4000000000 (test data)')
        c.setFont('Helvetica-Bold', SIZE)
        hy = H - 100
        c.drawString(X_DATE, hy, 'Date'); c.drawString(X_DESC, hy, 'Description')
        c.drawRightString(R_AMT, hy, 'Amount'); c.drawRightString(R_BAL, hy, 'Balance'); c.drawRightString(R_ACC, hy, 'Accrued Bank Charges')
        c.line(28, hy - 3, R_ACC, hy - 3)
        c.setFont(FONT, SIZE)
        y = hy - 14
    def footer():
        c.setFont(FONT, 7)
        c.drawString(28, 30, 'Sample statement for testing VeritBooks. Not issued by any bank.')
        c.setFont(FONT, SIZE)
    new_page()
    opening = float(data[0][2]) - float(data[0][1])
    c.drawString(X_DATE, y, '01 Jan'); c.drawString(X_DESC, y, 'Opening Balance'); c.drawRightString(R_BAL, y, bal(opening)); y -= LEAD
    total_in = total_out = 0.0
    for n, r in enumerate(data):
        if y < 52:
            footer(); new_page()
        a, b = float(r[1]), float(r[2])
        c.drawString(X_DATE, y, short(r[0])); c.drawString(X_DESC, y, r[3][:70])
        c.drawRightString(R_AMT, y, amt(a)); c.drawRightString(R_BAL, y, bal(b))
        # Internet payments accrue a small fee, charged later in the month as #SERVICE FEES.
        if r[3].startswith('INTERNET PMT'): c.drawRightString(R_ACC, y, '7.50')
        if a > 0: total_in += a
        else: total_out -= a
        y -= LEAD
    y -= 6
    c.setFont('Helvetica-Bold', SIZE)
    c.drawString(X_DATE, y, '31 Dec'); c.drawString(X_DESC, y, 'Closing Balance'); c.drawRightString(R_BAL, y, bal(float(data[-1][2])))
    c.setFont(FONT, SIZE)
    footer(); c.save()
    return page

print('pages', build('public/samples/za-bank-statement-2025.pdf'), 'rows', len(data))
