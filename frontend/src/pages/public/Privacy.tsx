import {
  LegalLink,
  LegalList,
  LegalPageShell,
  LegalSection,
  LegalSubheading,
} from '../../components/legal/LegalPageShell';

export default function Privacy() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      intro={
        <>
          <p>Last Updated: September 21, 2026</p>
          <p>
            Community Health Technologies, Inc. (“Company,” “we,” “our,” or “us”) operates the
            website located at <LegalLink href="https://communityhealth.media" /> (the “Site”) and
            our web application services located at{' '}
            <LegalLink href="https://app.communityhealth.media" /> (the “Webapp”, together with the
            Site, the “Services”). Community Health Media is a brand and media platform operated by
            Community Health Technologies, Inc.
          </p>
          <p>
            We are committed to protecting your privacy and being transparent about how information
            is collected, used, and safeguarded. All information collected through this Site is used
            solely to enhance the user experience, improve our content and services, and support our
            educational and engagement efforts.
          </p>
          <p>
            By using or accessing the Services, including creating an account, registering for
            events, or completing transactions, you consent to the practices described in this
            Privacy Policy.
          </p>
        </>
      }
    >
      <LegalSection title="1. Information We Collect">
        <LegalSubheading>a. Information You Provide Voluntarily</LegalSubheading>
        <p>You may choose to provide personal information when you:</p>
        <LegalList
          items={[
            'Subscribe to newsletters or updates',
            'Register for events, webinars, or programs',
            'Complete contact or inquiry forms',
            'Download content or resources',
            'Communicate with us via email or other channels',
            'Create, manage, or update a user account or professional profile on the Webapp',
            'Register for, participate in, or access live stream webinars, interactive sessions, or Office Hours',
            'Engage with interactive features such as Q&A sessions, polls, surveys, and event chats',
            'Process payment transactions, honoraria disbursements, or payout requests',
          ]}
        />
        <p>This information may include:</p>
        <LegalList
          items={[
            'Name',
            'Email address',
            'Organization or employer',
            'Job title or professional role',
            'Any other information you voluntarily provide',
            'Professional credentials, NPI number, state license details, specialty, and practice area',
            'Contact phone number, mailing and business address, city, state, and postal/zip code',
            'Account authentication credentials (username and password)',
            'Transaction, billing, banking, and payout details required to process payments via integrated payment processors (e.g., Stripe)',
            'Interactive submissions including survey responses, webinar Q&A questions, chat messages, and poll responses',
          ]}
        />
        <LegalSubheading>b. Information Collected Automatically</LegalSubheading>
        <p>
          When you visit our Site, we may automatically collect certain technical and usage
          information, including:
        </p>
        <LegalList
          items={[
            'IP address',
            'Browser type and version',
            'Device type and operating system',
            'Pages viewed, interactions, and time spent on the Site',
            'Referring URLs',
            'General geographic location (city, state, or region)',
            'Webinar and live event attendance duration, join and leave timestamps, and engagement metrics',
          ]}
        />
        <p>This information is collected using cookies, pixels, and similar technologies.</p>
      </LegalSection>

      <LegalSection title="2. Cookies and Tracking Technologies">
        <p>
          We use cookies and similar tracking technologies to operate the Site efficiently,
          understand how users engage with our content, and continuously improve the overall
          experience.
        </p>
        <LegalSubheading>Customer Platform</LegalSubheading>
        <p>
          We use HubSpot cookies and tracking tools to monitor visitor activity, analyze user
          interactions, and manage contact and engagement data.
        </p>
        <p>
          Learn more about how HubSpot processes data here:{' '}
          <LegalLink href="https://legal.hubspot.com/privacy-policy" />
        </p>
        <LegalSubheading>Analytics</LegalSubheading>
        <p>
          We use Google Analytics to analyze Site traffic and usage patterns. Google Analytics helps
          us understand how visitors interact with the Site so we can improve performance, content,
          and usability. Data collected is aggregated and used for analytical purposes.
        </p>
        <p>
          Learn more about how Google uses data here:{' '}
          <LegalLink href="https://policies.google.com/privacy" />
        </p>
        <LegalSubheading>Advertising and Social Media Platforms</LegalSubheading>
        <p>We may use tracking tools and pixels from:</p>
        <LegalList
          items={[
            'Meta Platforms, Inc. (Facebook and Instagram)',
            'LinkedIn Corporation',
            'X Corp. (formerly Twitter)',
          ]}
        />
        <p>These tools help us:</p>
        <LegalList
          items={[
            'Measure and optimize campaign performance',
            'Understand audience engagement',
            'Deliver relevant content and communications',
          ]}
        />
        <p>Each platform processes data in accordance with its own privacy policy:</p>
        <LegalList
          items={[
            <>
              Meta Privacy Policy: <LegalLink href="https://www.facebook.com/privacy/policy" />
            </>,
            <>
              LinkedIn Privacy Policy:{' '}
              <LegalLink href="https://www.linkedin.com/legal/privacy-policy" />
            </>,
            <>
              X Privacy Policy: <LegalLink href="https://x.com/privacy" />
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection title="3. How We Use Information">
        <p>We use collected information to:</p>
        <LegalList
          items={[
            'Operate, maintain, and improve the Site',
            'Enhance and personalize the user experience',
            'Deliver relevant content, newsletters, and updates',
            'Promote educational resources, events, and programs',
            'Analyze Site usage and performance',
            'Conduct audience research and engagement analysis',
            'Communicate with users and respond to inquiries',
            'Support internal business operations and planning',
            'Comply with applicable legal and regulatory obligations',
            'Authenticate user identity, manage account access, and maintain user profiles',
            'Process webinar registrations, approvals, attendance tracking, and event participation',
            'Facilitate financial transactions, honoraria payouts, and payment processing through payment service providers',
            'Enable interactive features including Q&A, surveys, and live stream engagement',
          ]}
        />
        <p>
          All information collected is used in a manner consistent with this Privacy Policy and is
          focused on improving the value, relevance, and effectiveness of our platform.
        </p>
      </LegalSection>

      <LegalSection title="4. No Sale of Personal Information">
        <p>We do not sell, rent, or trade personal information.</p>
        <p>
          Any information collected is used exclusively to support our mission, improve our
          services, and enhance the experience for our users. We do not monetize personal data
          through third-party sales.
        </p>
      </LegalSection>

      <LegalSection title="5. How We Share Information">
        <p>We may share information only in limited circumstances, including:</p>
        <LegalList
          items={[
            'With payment processors (such as Stripe) to process financial transactions, payouts, and billing information securely',
            'With video conference and streaming infrastructure partners (such as Zoom) to enable webinar hosting, attendance verification, and interactive features',
            'With trusted service providers who assist with website hosting, analytics, email delivery, or operational support',
            'With advertising and social media platforms solely for campaign measurement, audience insights, and content optimization',
            'When required by law, legal process, or governmental request',
            'To protect the rights, property, or safety of the Company, our users, or others',
          ]}
        />
        <p>
          All service providers are required to maintain appropriate data protection and
          confidentiality standards.
        </p>
      </LegalSection>

      <LegalSection title="6. Healthcare and Medical Disclaimer">
        <p>
          Community Health Media provides educational and informational content related to
          healthcare topics. The Site does not collect protected health information (PHI) and is not
          intended to provide medical advice, diagnosis, or treatment.
        </p>
        <p>
          If future services involve regulated healthcare data, additional disclosures and
          compliance measures will be implemented.
        </p>
      </LegalSection>

      <LegalSection
        title="7. Data Security"
        body="We implement reasonable administrative, technical, and organizational safeguards designed to protect personal information from unauthorized access, disclosure, or misuse. While we strive to protect information, no system can be guaranteed to be completely secure."
      />

      <LegalSection
        title="8. Data Retention"
        body="We retain personal information only for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law."
      />

      <LegalSection title="9. Your Choices and Rights">
        <p>Depending on your location, you may have the right to:</p>
        <LegalList
          items={[
            'Access personal information we hold about you',
            'Request correction or deletion of your information',
            'Opt out of marketing or communications',
            'Manage or disable cookies through your browser settings',
          ]}
        />
        <p>
          You may unsubscribe from email communications at any time by following the instructions
          included in our messages.
        </p>
      </LegalSection>

      <LegalSection
        title="10. Third-Party Links"
        body="The Site may contain links to third-party websites or platforms. We are not responsible for the privacy practices or content of those third parties. We encourage users to review third-party privacy policies before providing information."
      />

      <LegalSection
        title="11. Children’s Privacy"
        body="The Site is not directed to children under the age of 13, and we do not knowingly collect personal information from children."
      />

      <LegalSection
        title="12. Changes to This Privacy Policy"
        body="We may update this Privacy Policy from time to time. Any updates will be posted on this page with a revised effective date. Continued use of the Site after changes indicates acceptance of the updated policy."
      />

      <LegalSection title="13. Contact Us">
        <p>
          If you have questions about this Privacy Policy or our data practices, please contact:
        </p>
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
