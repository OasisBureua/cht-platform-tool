import {
  LegalLink,
  LegalList,
  LegalPageShell,
  LegalSection,
} from '../../components/legal/LegalPageShell';

export default function Terms() {
  return (
    <LegalPageShell
      title="Terms of Use"
      intro={
        <>
          <p>Last Updated: September 21, 2026</p>
          <p>
            Community Health Technologies, Inc. (“Company,” “we,” “our,” or “us”) operates the
            website located at <LegalLink href="https://communityhealth.media" /> (the “Site”) and
            our web application services located at{' '}
            <LegalLink href="https://app.communityhealth.media" /> (the “Webapp”, together with the
            Site, the “Services”).
          </p>
          <p>
            Community Health Media is a brand and media platform operated by Community Health
            Technologies, Inc. By accessing or using the Site or Webapp, registering for an account
            or event, participating in live streams, or submitting payment information, you agree to
            be bound by these Terms and our Privacy Policy.
          </p>
        </>
      }
    >
      <LegalSection
        title="1. Purpose of the Site"
        body="The Site and Webapp provide educational, informational, interactive, and media services related to healthcare, technology, business, and community-focused initiatives. Features include user account registration and profile management, event registration, embedded live streams and webinars, interactive Q&A and chat features, surveys, post-event evaluations, and automated incentive or honoraria payment processing. The Site is intended for general informational purposes only and does not provide medical, legal, or professional advice."
      />

      <LegalSection title="2. Eligibility and Acceptable Use">
        <p>
          You must be at least 18 years old to use the Site. By using the Site, you represent that
          you meet this requirement. You agree to use the Site and Webapp only for lawful purposes
          and in accordance with these Terms. You may not:
        </p>
        <LegalList
          items={[
            'Use the Site in any way that violates applicable laws or regulations',
            'Attempt to gain unauthorized access to the Site or its systems',
            'Interfere with or disrupt the operation or security of the Site',
            'Upload or transmit malicious code, viruses, or harmful content',
            'Use the Site to collect data or personal information about others without authorization',
            'Create duplicate user profiles or misrepresent credentials, including National Provider Identifier (NPI) details or professional designations',
            'Register for overlapping or conflicting live webinar sessions with intent to bypass participation verification controls',
            'Disrupt, compromise, or record live webinar streams, interactive Q&A tools, or presenter feeds without explicit prior authorization',
            'Engage in automated scraping, data extraction, or reverse-engineering of any portion of the Site, Webapp, or underlying platform architecture',
          ]}
        />
      </LegalSection>

      <LegalSection
        title="3. Account Termination"
        body="We reserve the right to suspend, terminate, or permanently ban your account and access to the Site or Webapp at our sole discretion, without prior notice, for conduct that we believe violates these Terms, constitutes platform abuse or unauthorized scraping, disrupts traffic, is harmful to other users or the Company, or breaches applicable laws."
      />

      <LegalSection
        title="4. Subscription Fees and Billing"
        body="Certain features or premium services on the Webapp may require a paid subscription. All applicable subscription fees, payment schedules, and billing terms will be disclosed at the time of purchase. Fees are billed automatically in advance and are non-refundable except as required by law or specified in a separate service level agreement."
      />

      <LegalSection
        title="5. Platform Uptime Guarantees"
        body={
          'While we strive to maintain consistent availability of the Site and Webapp, access is provided on an "as available" basis. We do not guarantee uninterrupted, 100% platform uptime, and we will not be liable for temporary service interruptions due to maintenance, system upgrades, or unexpected technical issues.'
        }
      />

      <LegalSection
        title="6. Intellectual Property Rights"
        body="All content on the Site, including text, graphics, logos, videos, audio, designs, trademarks, and other materials, is owned by or licensed to Community Health Technologies, Inc. and is protected by intellectual property laws. You may view and share content for personal, non-commercial use only, provided that you do not modify the content and retain all proprietary notices. Subject to your compliance with these Terms, the Company grants you a limited, non-exclusive, non-transferable, and revocable license to access and use the Webapp for its intended purposes. This grant does not convey any ownership rights or title in or to the software, source code, algorithm models, or underlying technology, all of which remain the sole property of Community Health Technologies, Inc."
      />

      <LegalSection title="7. User Submission">
        <p>
          If you submit information, content, or materials to the Site (including contact forms,
          event registrations, or communications), you grant the Company a non-exclusive,
          royalty-free license to use such materials solely for operational, informational, and
          engagement purposes.
        </p>
        <p>
          You represent that any information you submit is accurate and that you have the right to
          submit it.
        </p>
      </LegalSection>

      <LegalSection title="8. Account Registration, Verification, and Profile Persistence">
        <p>
          Certain Webapp features require creating an account or registering through event forms.
          To ensure platform integrity and verify healthcare professional eligibility, you may be
          required to provide accurate professional information, including your full name, email
          address, practice location (State and Zip Code), professional role, and valid 10-digit
          National Provider Identifier (NPI) number.
        </p>
        <p>
          By completing a registration or profile creation form, you agree that your profile details
          may be saved and auto-populated for future event registrations and platform activities.
          NPI numbers and email addresses serve as unique identifiers to prevent duplicate profile
          creation. You are responsible for keeping your login credentials secure and updating your
          profile data when changes occur.
        </p>
      </LegalSection>

      <LegalSection title="9. Live Webinars, Invitations, and Event Management">
        <p>
          Webapp users and invited participants may receive event invitations, select available
          dates, and register for live webcasts. To preserve event capacity and ensure meaningful
          participation, the Webapp restricts users from registering for multiple webinars scheduled
          at overlapping or identical times.
        </p>
        <p>
          All registrations and event participation approvals are subject to verification and review
          by the Company. The Company reserves the right, in its sole discretion, to reject any
          registration, revoke previously issued event approvals, or alter event access parameters.
          In the event an approval is revoked, an automated notification will be issued to the
          impacted participant.
        </p>
      </LegalSection>

      <LegalSection title="10. Honoraria, Incentive Payouts, and Payment Processing">
        <p>
          The Webapp supports program participation honoraria and incentive disbursements for
          qualified attendees and featured presenters. Honorarium eligibility requires verifying
          completed program deliverables, including attending required sessions and submitting
          post-event evaluations.
        </p>
        <p>
          Incentive payouts are processed electronically via integrated payment portals (e.g.,
          Stripe) or offline paper check distribution (e.g., via QuickBooks). Users setting up
          payment preferences must select their designated payment method (ACH/electronic transfer or
          check) and provide accurate bank or mailing details. You acknowledge and agree that
          information entered into the Webapp payment setup interface explicitly designates the
          official payee of record (for example, individual vs. LLC entities receiving funds). The
          Company is not responsible for misdirected disbursements resulting from incorrect payee
          details supplied by the user.
        </p>
      </LegalSection>

      <LegalSection
        title="11. No Sale of Personal Information"
        body="The Company does not sell, rent, or trade personal information. Any information collected through the Site is used to enhance the user experience, improve content and services, and support educational and engagement initiatives, as further described in our Privacy Policy."
      />

      <LegalSection title="12. Healthcare and Medical Disclaimer">
        <p>
          The Site may include content related to healthcare topics. Such content is provided for
          educational and informational purposes only and is not intended as medical advice,
          diagnosis, or treatment.
        </p>
        <p>
          You should always seek the advice of qualified healthcare professionals regarding medical
          conditions or treatment decisions.
        </p>
      </LegalSection>

      <LegalSection
        title="13. Third-Party Links and Services"
        body="The Site may contain links to third-party websites, platforms, or services. These links are provided for convenience only. The Company does not control and is not responsible for the content, policies, or practices of third parties. Your use of third-party services is subject to their respective terms and policies."
      />

      <LegalSection
        title="14. Disclaimers"
        body="The Site and its content are provided on an “as is” and “as available” basis. The Company makes no warranties, express or implied, regarding the accuracy, completeness, or reliability of the Site or its content. We do not guarantee that the Site will be uninterrupted, error-free, or secure."
      />

      <LegalSection
        title="15. Limitation of Liability"
        body="To the fullest extent permitted by law, Community Health Technologies, Inc. shall not be liable for any direct, indirect, incidental, consequential, special, or financial damages arising out of or related to your use of or inability to use the Site or Webapp, including but not limited to platform downtime, service interruptions, data bugs, system errors, or unexpected analytical or procedural results. Your sole remedy for dissatisfaction with the Site is to stop using it."
      />

      <LegalSection
        title="16. Indemnification"
        body="You agree to indemnify and hold harmless Community Health Technologies, Inc., its officers, directors, employees, and partners from any claims, damages, liabilities, or expenses arising from your use of the Site or violation of these Terms."
      />

      <LegalSection title="17. Modifications to the Site, Webapp, and Terms">
        <p>
          We reserve the right to modify or discontinue the Site, or update these Terms, at any time
          without prior notice. Updates will be posted on this page with a revised effective date.
        </p>
        <p>Continued use of the Site after changes constitutes acceptance of the updated Terms.</p>
      </LegalSection>

      <LegalSection
        title="18. Governing Law"
        body="These Terms are governed by and construed in accordance with the laws of the United States and the state in which Community Health Technologies, Inc. is incorporated, without regard to conflict of law principles."
      />

      <LegalSection title="19. Contact Information">
        <p>If you have questions about these Terms of Use, please contact:</p>
        <p>
          Community Health Technologies, Inc.
          <br />
          Email: <LegalLink href="mailto:info@communityhealth.media" />
          <br />
          Website: <LegalLink href="https://communityhealth.media" />
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
