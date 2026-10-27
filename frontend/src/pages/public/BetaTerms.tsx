import {
  LegalLink,
  LegalList,
  LegalPageShell,
  LegalSection,
} from '../../components/legal/LegalPageShell';

/**
 * Beta Participant Terms Agreement (Last Updated October 22, 2026).
 * Shown during the beta period via the T&C acceptance pop-up.
 */
export default function BetaTerms() {
  return (
    <LegalPageShell
      title="Beta Participant Terms Agreement"
      intro={
        <>
          <p>Last Updated: October 22, 2026</p>
          <p>
            Community Health Technologies, Inc. (“Company,” “we,” “our,” or “us”) operates the
            website located at <LegalLink href="https://communityhealth.media" /> (the “Site”) and
            the web application services located at{' '}
            <LegalLink href="https://app.communityhealth.media" /> (the “Webapp”, together with the
            Site, the “Services”). Community Health Media is a brand and media platform operated by
            Community Health Technologies, Inc.
          </p>
          <p>
            Thank you for participating as a beta tester for the Community Health Technology (“CHT”)
            web application (the “Platform”), made available by Community Health Media (“CHM”). Below
            are the terms that govern your participation in the CHT Beta program (these “Beta
            Terms”). By creating your login credentials and accessing the Platform, you consent to
            the practices described in these Beta Terms.
          </p>
        </>
      }
    >
      <LegalSection
        title="Purpose & Overview"
        body="You are evaluating a pre-release version of the Platform to help us validate onboarding, program participation, webinar, and survey workflows prior to our official launch. The Platform is a beta product and is expected to contain defects, so please do not rely on its correct functioning or performance."
      />

      <LegalSection title="Participant Responsibilities">
        <p>
          We ask that you complete initial account setup, join scheduled webinar sessions, submit
          feedback promptly, and keep your login credentials private.
        </p>
        <LegalList
          items={[
            'Complete initial account setup and assigned core workflows.',
            'Join scheduled webinar session(s) and submit post-session feedback surveys promptly.',
            'Report any bugs or usability issues through the survey process, using your best efforts to provide prompt and accurate feedback.',
            'Use the Platform only for this beta evaluation, keep your login credentials private, and do not copy, modify, or reverse engineer the Platform.',
          ]}
        />
      </LegalSection>

      <LegalSection
        title="Platform Modifications"
        body="CHM is not obligated to provide support or correct any particular error, and may modify, suspend, or end the beta program at any time."
      />

      <LegalSection title="Confidentiality & Feedback">
        <p>
          All non-public information, UI screenshots, features, and session materials are confidential
          to CHM. During the beta program and for one (1) year afterward, please do not use these
          materials except for the beta program, or disclose, publish, or share them without CHM’s
          prior written permission. This does not apply to information that is or becomes public
          through no fault of your own, that you already had on a non-confidential basis, or that you
          are legally required to disclose (with prompt notice to CHM). CHM owns the Platform and all
          improvements to it. Any suggestions, ideas, or feedback you provide become CHM’s property
          and may be used by CHM without restriction or compensation to you.
        </p>
      </LegalSection>

      <LegalSection title="Privacy & Data Safety">
        <p>
          CHM processes personal data required for beta operations (e.g., account details, survey
          responses, platform logs) as detailed in our{' '}
          <LegalLink href="/privacy">Privacy Policy</LegalLink>.
        </p>
        <p>
          Do not upload patient health information (PHI) or sensitive third-party data to the
          Platform.
        </p>
      </LegalSection>

      <LegalSection
        title="Warranty & Liability"
        body={
          'THE PLATFORM IS PROVIDED “AS IS” FOR EVALUATION PURPOSES ONLY. TO THE MAXIMUM EXTENT PERMITTED BY LAW, CHM DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE, AND CHM’S AGGREGATE LIABILITY ARISING OUT OF THIS BETA PARTICIPATION WILL NOT EXCEED THE GREATER OF ANY HONORARIUM PAID TO YOU OR $100, EXCEPT WHERE LIABILITY CANNOT BE LIMITED UNDER APPLICABLE LAW.'
        }
      />

      <LegalSection
        title="General"
        body="You are participating as an independent tester, not as an employee or agent of CHM. CHM may seek injunctive relief for any breach of the Confidentiality & Feedback section. These Beta Terms do not replace any separate non-disclosure agreement you have signed with CHM, and they are governed by California law."
      />

      <LegalSection title="Consent & Acceptance">
        <p>
          By creating your login credentials and accessing the Platform, you confirm that you have
          read, understand, and agree to be bound by these Beta Terms. If you do not agree, please do
          not create an account or access the Platform.
        </p>
      </LegalSection>

      <LegalSection title="Contact Us">
        <p>
          If you have questions about these Beta Program Terms or our data practices, please contact:
        </p>
        <p>
          Community Health Technologies, Inc.
          <br />
          Email: <LegalLink href="mailto:info@communityhealth.media">info@communityhealth.media</LegalLink>
          <br />
          Website: <LegalLink href="https://communityhealth.media" />
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
