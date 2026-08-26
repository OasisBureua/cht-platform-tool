import { LegalPageShell, LegalSection } from '../../components/legal/LegalPageShell';

export default function Privacy() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      intro="Effective date: May 22, 2026. Community Health Media (&quot;CHM,&quot; &quot;we,&quot; &quot;us&quot;) operates the CHT Platform. This policy describes how we collect, use, and protect personal information when you use our websites and services."
    >
      <LegalSection
        title="Information we collect"
        body="Account information (name, email, professional credentials such as NPI when provided), registration and participation data for programs and webinars, survey responses, payment and honorarium processing records, device and usage data (IP address, browser type, pages viewed), and communications you send to us."
      />
      <LegalSection
        title="How we use information"
        body="To create and manage your account, deliver educational content and CME activities, process registrations and payments, send operational and program-related communications, improve platform security and performance, comply with legal obligations, and generate aggregated analytics that do not identify individuals."
      />
      <LegalSection
        title="Legal bases and consent"
        body="We process personal information to perform our contract with you (providing platform access), for legitimate interests (security, fraud prevention, product improvement), and where required, with your consent (for example, optional marketing communications)."
      />
      <LegalSection
        title="Sharing and subprocessors"
        body="We do not sell personal information. We share data with service providers that help us operate the platform (hosting, authentication, email, video conferencing, payments, and form providers) under contracts that require appropriate safeguards. We may disclose information when required by law or to protect rights, safety, and security."
      />
      <LegalSection
        title="Retention and security"
        body="We retain personal information for as long as needed to provide services, meet legal and accreditation requirements, and resolve disputes. We use administrative, technical, and organizational measures including encryption in transit, access controls, and audit logging for administrative actions."
      />
      <LegalSection
        title="Your choices and rights"
        body="Depending on your location, you may request access, correction, deletion, or a copy of your personal information, or object to certain processing. Contact us using the details below. You may opt out of non-essential emails using unsubscribe links where provided."
      />
      <LegalSection
        title="Children"
        body="The platform is intended for healthcare professionals and is not directed to children under 16. We do not knowingly collect personal information from children."
      />
      <LegalSection
        title="Changes"
        body="We may update this policy from time to time. Material changes will be posted on this page with an updated effective date."
      />
      <LegalSection
        title="Contact"
        body="For privacy questions or requests, contact Community Health Media via the Contact Us page or email your program administrator."
      />
    </LegalPageShell>
  );
}
