"""Draws the sample bank statement as a PDF laid out like a Nigerian bank e-statement:
a header block and column headings on every page, wrapped narrations, right-aligned amounts,
page footers and a closing summary. Also writes a password-protected copy (password: 1234).
Run after make-samples.mjs:  python3 scripts/make-sample-pdf.py
"""
import csv
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas
from reportlab.lib.pdfencrypt import StandardEncryption

rows = list(csv.reader(open('public/samples/bank-statement-2025.csv')))
head = next(i for i, r in enumerate(rows) if r and r[0] == 'Trans Date')
data = rows[head + 1:]
W, H = A4
X_DATE, X_VALUE, X_NARR, R_DEBIT, R_CREDIT, R_BAL = 28, 92, 156, 418, 492, 568
NARR_W = 170
FONT, SIZE, LEAD = 'Helvetica', 7.5, 9.5
SUFFIX = ['/REF 000{n:07d}/LAGOS ISLAND BRANCH', ' NIP/{n:09d}/IKEJA', '', ' VIA INTERNET BANKING REF {n:08d}']

def wrap(text):
    out, line = [], ''
    for word in text.split(' '):
        trial = (line + ' ' + word).strip()
        if stringWidth(trial, FONT, SIZE) <= NARR_W or not line:
            line = trial
        else:
            out.append(line); line = word
    return out + [line]

def build(path, encrypt=None):
    c = canvas.Canvas(path, pagesize=A4, encrypt=encrypt, pageCompression=1)
    pages, y, page = [], 0, 0
    def new_page():
        nonlocal y, page
        if page: c.showPage()
        page += 1
        c.setFont('Helvetica-Bold', 13); c.drawString(28, H - 40, 'Sample Bank Plc')
        c.setFont(FONT, 8)
        c.drawString(28, H - 54, 'Account name: ADUNNI FOODS LIMITED')
        c.drawString(28, H - 65, 'Account number: 0012344471    Currency: NGN    Account type: Current')
        c.drawString(28, H - 76, 'Statement period: 01-Jan-2025 to 31-Dec-2025')
        c.drawRightString(R_BAL, H - 54, '12 Marina, Lagos')
        c.setFont('Helvetica-Bold', SIZE)
        hy = H - 98
        c.drawString(X_DATE, hy, 'Trans Date'); c.drawString(X_VALUE, hy, 'Value Date'); c.drawString(X_NARR, hy, 'Narration')
        c.drawRightString(R_DEBIT, hy, 'Debit'); c.drawRightString(R_CREDIT, hy, 'Credit'); c.drawRightString(R_BAL, hy, 'Balance')
        c.line(28, hy - 3, R_BAL, hy - 3)
        c.setFont(FONT, SIZE)
        y = hy - 14
    def footer():
        c.setFont(FONT, 7)
        c.drawString(28, 30, 'This statement is computer generated. Report any discrepancy within 15 days.')
        c.drawRightString(R_BAL, 30, 'Page %d' % page)
        c.setFont(FONT, SIZE)
    new_page()
    debit_total = credit_total = 0.0
    for n, r in enumerate(data):
        narr = r[2] + SUFFIX[n % 4].format(n=n) if n else r[2]
        lines = wrap(narr)
        if y - LEAD * len(lines) < 48:
            footer(); new_page()
        c.drawString(X_DATE, y, r[0]); c.drawString(X_VALUE, y, r[1])
        for i, ln in enumerate(lines): c.drawString(X_NARR, y - i * LEAD, ln)
        if r[3]: c.drawRightString(R_DEBIT, y, r[3]); debit_total += float(r[3].replace(',', ''))
        if r[4]: c.drawRightString(R_CREDIT, y, r[4]); credit_total += float(r[4].replace(',', ''))
        c.drawRightString(R_BAL, y, r[5])
        y -= LEAD * len(lines) + 2.5
    y -= 6
    c.setFont('Helvetica-Bold', SIZE)
    c.drawString(X_NARR, y, 'Total debits'); c.drawRightString(R_DEBIT, y, '{:,.2f}'.format(debit_total))
    c.drawString(X_NARR, y - 11, 'Total credits'); c.drawRightString(R_CREDIT, y - 11, '{:,.2f}'.format(credit_total))
    c.drawString(X_NARR, y - 22, 'Closing balance'); c.drawRightString(R_BAL, y - 22, data[-1][5])
    footer(); c.save()
    return page

n = build('public/samples/bank-statement-2025.pdf')
build('public/samples/bank-statement-2025-protected.pdf', StandardEncryption('1234', ownerPassword='owner-9d2f', canPrint=1))
print('pages', n, 'rows', len(data))
