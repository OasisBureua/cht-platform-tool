import { LegalPageShell, LegalSection } from '../../components/legal/LegalPageShell';

export default function Terms() {
  return (
    <LegalPageShell
      title="Terms of Service"
      intro="Effective date: May 22, 2026. These Terms of Service (&quot;Terms&quot;) govern your access to and use of the CHT Platform operated by Community Health Media (&quot;CHM,&quot; &quot;we,&quot; &quot;us&quot;). By creating an account or using the platform, you agree to these Terms."
    >
      <LegalSection
        title="Acceptance of terms"
        body="By accessing or using the platform, you confirm that you have read, understood, and agree to be bound by these Terms and our Privacy Policy. If you do not agree, you may not use the platform."
      />
      <LegalSection
        title="Eligibility"
        body="The platform is intended for healthcare professionals and other authorized participants in CHM programs. You must be at least 18 years old and have the legal capacity to enter into a binding agreement. You represent that the professional information you provide is accurate and that you are authorized to use the platform for its intended educational purposes."
      />
      <LegalSection
        title="Your account"
        body="You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account. Notify us promptly if you suspect unauthorized access. We may suspend or terminate accounts that contain inaccurate information, violate these Terms, or pose a security risk."
      />
      <LegalSection
        title="Acceptable use"
        body="You agree to use the platform lawfully and in good faith. You may not misuse the platform, attempt to gain unauthorized access, interfere with its operation, scrape or harvest data without permission, upload malicious code, impersonate others, or use the platform in any way that infringes intellectual property or privacy rights."
      />
      <LegalSection
        title="Educational content; not medical advice"
        body="Content on the platform is provided for educational and informational purposes only. It does not constitute medical advice, diagnosis, or treatment, and is not a substitute for professional clinical judgment. You are solely responsible for decisions you make in patient care or professional practice."
      />
      <LegalSection
        title="Programs, registration, and CME"
        body="Program descriptions, schedules, faculty, and continuing medical education (CME) credit availability may change. Registration may be subject to eligibility review and capacity limits. Completion of CME or other credit requirements does not guarantee issuance of credit if accreditation rules or attendance criteria are not met. CHM and its accrediting partners determine credit eligibility in accordance with applicable standards."
      />
      <LegalSection
        title="Payments and honoraria"
        body="Where programs involve fees, honoraria, or reimbursements, additional terms may apply at registration or in program materials. You agree to provide accurate payment and tax information. CHM may use third-party payment processors and is not responsible for delays or errors caused by those providers or by inaccurate information you supply."
      />
      <LegalSection
        title="Intellectual property"
        body="The platform, its design, software, branding, and content (except user-submitted materials) are owned by CHM or its licensors and are protected by intellectual property laws. We grant you a limited, non-exclusive, non-transferable license to access and use the platform for personal, professional, and program-related purposes. You may not copy, modify, distribute, or create derivative works except as expressly permitted."
      />
      <LegalSection
        title="Privacy"
        body="Our collection and use of personal information is described in the Privacy Policy, which is incorporated into these Terms by reference."
      />
      <LegalSection
        title="Third-party services"
        body="The platform may integrate with or link to third-party services such as video conferencing, forms, authentication, and payment tools. Those services are governed by their own terms and policies. CHM is not responsible for third-party services outside our reasonable control."
      />
      <LegalSection
        title="Suspension and termination"
        body="We may suspend or terminate your access at any time if you violate these Terms, if required by law, or to protect the platform and its users. You may stop using the platform at any time. Provisions that by their nature should survive termination (including disclaimers, limitations of liability, and indemnification) will remain in effect."
      />
      <LegalSection
        title="Disclaimers"
        body="The platform is provided on an &quot;as is&quot; and &quot;as available&quot; basis. To the fullest extent permitted by law, CHM disclaims all warranties, express or implied, including merchantability, fitness for a particular purpose, and non-infringement. We do not warrant uninterrupted, error-free, or secure operation."
      />
      <LegalSection
        title="Limitation of liability"
        body="To the fullest extent permitted by law, CHM and its affiliates, officers, directors, employees, and partners will not be liable for any indirect, incidental, special, consequential, or punitive damages, or for lost profits, data, or goodwill, arising from your use of the platform. Our total liability for any claim relating to the platform will not exceed the greater of one hundred U.S. dollars (USD $100) or the amount you paid CHM for platform access in the twelve months before the claim."
      />
      <LegalSection
        title="Indemnification"
        body="You agree to indemnify and hold harmless CHM and its affiliates from claims, damages, losses, and expenses (including reasonable attorneys&apos; fees) arising from your use of the platform, your violation of these Terms, or your violation of any rights of another person or entity."
      />
      <LegalSection
        title="Changes to these Terms"
        body="We may update these Terms from time to time. Material changes will be posted on this page with an updated effective date. Continued use of the platform after changes become effective constitutes acceptance of the revised Terms."
      />
      <LegalSection
        title="Governing law"
        body="These Terms are governed by the laws of the State of New York, without regard to conflict-of-law principles, except where mandatory consumer protection laws in your jurisdiction apply."
      />
      <LegalSection
        title="Contact"
        body="For questions about these Terms, contact Community Health Media via the Contact Us page or your program administrator."
      />
    </LegalPageShell>
  );
}
