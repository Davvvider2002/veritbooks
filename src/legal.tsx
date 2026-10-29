import { useEffect, type ReactNode } from 'react';

const UPDATED = '29 October 2026';

function Page({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  // Opened from the landing page's footer, the page starts at the top, not where the footer was.
  useEffect(() => window.scrollTo(0, 0), [title]);
  return (
    <div className="page legal" style={{ maxWidth: 780 }}>
      <div className="small muted" style={{ letterSpacing: 1, textTransform: 'uppercase' }}>VeritBooks</div>
      <h1 style={{ marginTop: 4 }}>{title}</h1>
      <p className="muted">Last updated {UPDATED}.</p>
      <p>{intro}</p>
      {children}
      <p className="small muted" style={{ marginTop: 40 }}>
        <a href="/">Home</a> · <a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Service</a> · <a href="/verify">Verify a report</a>
      </p>
    </div>
  );
}

const S = ({ h, children }: { h: string; children: ReactNode }) => (
  <section style={{ marginTop: 28 }}>
    <h2 style={{ fontSize: 20, marginBottom: 8 }}>{h}</h2>
    {children}
  </section>
);

export function PrivacyPage() {
  return (
    <Page
      title="Privacy Policy"
      intro="This policy explains what personal information VeritBooks collects, why, who we share it with, and the choices you have. It applies to veritbooks.com, the VeritBooks application, the partner programme and the public verify page."
    >
      <S h="1. Who we are and our role">
        <p>
          VeritBooks provides software that accounting and audit firms use to prepare financial statements and run audit, review and compilation engagements. It is operated by Bakkiego in South Africa and by VBG in Nigeria.
        </p>
        <p>
          If your firm is in South Africa, Bakkiego is responsible for your personal information. For firms in every other country we serve, and for visitors to our website outside South Africa, VBG is responsible. In this policy, “VeritBooks”, “we” and “us” mean the company responsible for you. For the accounts of people who use VeritBooks, and for visitors to our website, that company decides how personal information is used and is responsible for it.
        </p>
        <p>
          For the client records a firm puts into VeritBooks (trial balances, ledgers, bank statements, evidence and reports), the firm decides what is collected and why. VeritBooks processes that information on the firm’s behalf and only to provide the service. Questions about a client’s own information should go first to the firm that holds it.
        </p>
      </S>
      <S h="2. What we collect">
        <ul>
          <li><strong>Account details.</strong> Name, email address, mobile number, password (stored only in hashed form), firm name, address, country and professional licence numbers you choose to record.</li>
          <li><strong>Team and activity records.</strong> Who belongs to which firm, their role, invitations, sign-offs and an audit trail of changes made to each engagement file.</li>
          <li><strong>Engagement data.</strong> The financial records, documents and working papers a firm uploads or prepares for its clients.</li>
          <li><strong>Billing records.</strong> Plan, invoices, amounts and payment status. Card and bank details are entered with our payment provider and are not stored by VeritBooks.</li>
          <li><strong>Security information.</strong> Sign-in times, two-factor settings and technical information needed to keep accounts secure.</li>
          <li><strong>Partner programme details.</strong> For referral partners: contact details, referral visits and commissions, and payout details.</li>
        </ul>
      </S>
      <S h="3. Why we use it">
        <ul>
          <li>To provide the service: create accounts, store and process engagement files, produce statements and reports, and keep the audit trail.</li>
          <li>To secure the service: verify sign-ins, prevent misuse and investigate incidents.</li>
          <li>To bill: run trials and subscriptions, issue receipts and meet tax obligations.</li>
          <li>To communicate: send service emails such as confirmations, invitations, password resets and important changes.</li>
          <li>To improve the service: understand, in aggregate, how features are used.</li>
        </ul>
        <p>We rely on the contract with you or your firm, our legitimate interest in running a secure and reliable service, our legal obligations, and your consent where the law requires it.</p>
      </S>
      <S h="4. VeritSign and the public verify page">
        <p>
          When an engagement partner signs a report, VeritSign records a seal: the firm, the signing partner and their licence number, the client and its registration number, the year end, the engagement type, the opinion, headline figures and the report wording. Anyone who holds the seal code can see the summary at veritbooks.com/verify. The full report is shown only with the access code the firm issues, or where a partner has chosen to open it to anyone with the code. Seals are kept so that reports can be verified for as long as they may be relied on.
        </p>
      </S>
      <S h="5. AI assistance">
        <p>
          AI assistance in VeritBooks is optional and switched on or off by a partner. When it is used, the text needed for the request is sent to our AI provider to produce a draft. AI never produces or changes figures in financial statements, and our provider does not use this content to train its models.
        </p>
      </S>
      <S h="6. Who we share it with">
        <p>We do not sell personal information. We share it only with service providers who help us run VeritBooks, under contracts that require them to protect it:</p>
        <ul>
          <li>database, file storage and hosting providers;</li>
          <li>our payment provider, for subscriptions and one-off payments;</li>
          <li>our email delivery provider, for service emails;</li>
          <li>our AI provider, only when a firm uses AI assistance.</li>
        </ul>
        <p>We may also disclose information where the law requires it, or to protect the rights and safety of our users and the public.</p>
      </S>
      <S h="7. Where it is stored">
        <p>
          Our providers may store and process information outside your country. Where information leaves your country, we rely on the safeguards your law requires, such as contractual protections and providers with adequate security standards.
        </p>
      </S>
      <S h="8. How long we keep it">
        <p>
          We keep account and engagement information while the firm’s account is open. Signed engagement files are kept locked because audit firms must retain working papers for set periods. When a firm closes its account, we delete or anonymise its information within a reasonable period, except where we must keep records for tax, legal or verification purposes.
        </p>
      </S>
      <S h="9. How we protect it">
        <p>
          Each firm’s information is separated from every other firm’s at the database level. Connections are encrypted, passwords are hashed, two-factor sign-in is available, and signed files cannot be altered. No system is perfectly secure, and we will notify affected users and regulators of a breach where the law requires it.
        </p>
      </S>
      <S h="10. Your rights">
        <p>
          Depending on where you live, you may have the right to access, correct or delete your personal information, to object to or restrict its use, to withdraw consent, and to receive a copy in a portable form. You may also complain to your data protection authority. These rights arise under the Nigeria Data Protection Act 2023, Ghana’s Data Protection Act 2012, South Africa’s Protection of Personal Information Act, Canada’s Personal Information Protection and Electronic Documents Act and similar laws.
        </p>
        <p>
          You can correct most account details yourself in VeritBooks. For other requests, contact us through your account, or ask your firm where the information belongs to its client records. We will respond within the time your law allows.
        </p>
      </S>
      <S h="11. Cookies and browser storage">
        <p>
          VeritBooks uses browser storage to keep you signed in and to remember simple choices, such as the country you picked on our website. We do not use advertising cookies.
        </p>
      </S>
      <S h="12. Children">
        <p>VeritBooks is a professional service for adults. We do not knowingly collect information from anyone under 18.</p>
      </S>
      <S h="13. Changes to this policy">
        <p>We will post any changes on this page and update the date at the top. Where a change is significant, we will tell account holders by email or in the application.</p>
      </S>
    </Page>
  );
}

export function TermsPage() {
  return (
    <Page
      title="Terms of Service"
      intro="These terms govern the use of VeritBooks by accounting and audit firms, their staff and our referral partners. By creating an account or using the service, you agree to them on behalf of yourself and your firm."
    >
      <S h="1. Who you contract with">
        <p>
          VeritBooks is operated by Bakkiego in South Africa and by VBG in Nigeria. If your firm is in South Africa, your agreement is with Bakkiego. If your firm is in any other country we serve, your agreement is with VBG. In these terms, “VeritBooks”, “we” and “us” mean that company. The country is the one recorded for your firm when it was set up.
        </p>
      </S>
      <S h="2. The service">
        <p>
          VeritBooks is software for preparing financial statements and managing audit, review and compilation engagements. It includes engagement files, working papers, statement drafting, partner sign-off, VeritSign verification seals and optional AI assistance. We may improve and change features over time.
        </p>
      </S>
      <S h="3. Accounts">
        <ul>
          <li>The person who sets up a firm confirms they may bind that firm to these terms.</li>
          <li>Each user needs their own account. Keep your password and second factor secure, and tell us promptly of any unauthorised use.</li>
          <li>Partners control who joins their firm and what each person may do.</li>
          <li>Information you give us, including licence numbers, must be accurate and kept up to date.</li>
        </ul>
      </S>
      <S h="4. Professional responsibility">
        <p>
          VeritBooks is a tool. It does not provide accounting, audit, tax or legal advice, and it does not perform engagements. The firm and its engagement partners remain fully responsible for their professional judgement, for compliance with the standards and laws that apply to them, and for every report they sign. Checks, prompts, templates and AI drafts help with that work; they do not replace it.
        </p>
      </S>
      <S h="5. VeritSign">
        <p>
          A VeritSign seal confirms that a report was signed on VeritBooks by the named partner, when it was signed, and what it said. It does not certify the quality of the work, and it is not a qualified electronic signature. By signing, a partner agrees that the seal summary may be shown to anyone who holds the seal code, and that the full report may be shown to anyone with the access code or, where the partner chooses, the seal code alone.
        </p>
      </S>
      <S h="6. Your data">
        <p>
          Your firm owns the information it puts into VeritBooks. You give us permission to store and process it only to provide, secure and support the service. You confirm that you have the right to upload it, including any permission your clients must give. Our Privacy Policy explains how we handle personal information.
        </p>
      </S>
      <S h="7. Acceptable use">
        <p>You must not:</p>
        <ul>
          <li>use VeritBooks to prepare, sign or present a report you know to be false or misleading;</li>
          <li>misrepresent a VeritSign seal or present a report as sealed when it is not;</li>
          <li>attempt to access another firm’s information or interfere with the service’s security;</li>
          <li>copy, resell or reverse engineer the service except as the law allows;</li>
          <li>upload unlawful content or malicious code.</li>
        </ul>
      </S>
      <S h="8. Trial, plans and payment">
        <ul>
          <li>New firms receive a 14-day free trial with every feature. No card is needed to start.</li>
          <li>After the trial, a firm may choose a plan or pay for single engagements at the prices shown for its country on veritbooks.com and in the application, including any tax stated there.</li>
          <li>Payments are processed by our payment provider. Plans are paid in advance for a year and do not renew automatically. A partner renews a plan by paying again. A file may be signed only once it is paid for.</li>
          <li>When a plan ends, nothing is deleted. The firm’s files become read-only until a partner renews.</li>
          <li>We may change prices for future billing periods and will give notice before a change applies to you.</li>
          <li>Except where the law requires otherwise, payments already made are not refundable.</li>
        </ul>
      </S>
      <S h="9. Partner programme">
        <p>Referral partners are bound by these terms and by the partner programme terms shown in the partner portal. Commissions are earned only on payments actually received.</p>
      </S>
      <S h="10. Availability and support">
        <p>
          We work to keep VeritBooks available and secure. The service may sometimes be interrupted for maintenance or by events outside our control. We will tell you about planned interruptions where we can.
        </p>
      </S>
      <S h="11. Suspension and closure">
        <p>
          A partner may ask us to close the firm’s account at any time. We may suspend or close an account that breaches these terms, fails to pay, or puts the service or other users at risk. Where reasonable, we will give notice first so that the firm can export its information. Signed reports keep their VeritSign record so that they remain verifiable.
        </p>
      </S>
      <S h="12. Liability">
        <p>
          VeritBooks is provided with reasonable care and skill. To the extent the law allows, we are not liable for indirect or consequential loss, lost profits or lost data, or for any professional judgement, report or opinion a firm issues. Our total liability in any 12-month period is limited to the fees the firm paid us in that period. Nothing in these terms limits liability that cannot be limited by law.
        </p>
      </S>
      <S h="13. Changes to these terms">
        <p>
          We may update these terms. We will post changes on this page and, where they are significant, tell account holders by email or in the application before they take effect. Continuing to use VeritBooks after that date means you accept the updated terms.
        </p>
      </S>
      <S h="14. Disputes">
        <p>
          If a dispute arises, we will first try to resolve it with you in good faith.
        </p>
        <p>
          If your firm is in South Africa, these terms are governed by the laws of the Republic of South Africa, and the South African courts have jurisdiction. If your firm is in any other country, these terms are governed by the laws of the Federal Republic of Nigeria, and the Nigerian courts have jurisdiction.
        </p>
        <p>Nothing in these terms takes away rights you have under the consumer or data protection laws of your country.</p>
      </S>
    </Page>
  );
}
