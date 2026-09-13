// app/privacy/page.tsx
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Caffriend",
  description:
    "How Caffriend collects, uses, shares, and retains your personal information.",
};

const sections = [
  { id: "who-we-are", label: "Who We Are" },
  { id: "where-this-applies", label: "Where This Privacy Policy Applies" },
  { id: "data-we-collect", label: "Data We Collect" },
  { id: "how-we-use-data", label: "How We Use Data" },
  { id: "free-vs-paid", label: "Free vs. Paid User Data Use" },
  { id: "how-we-share-data", label: "How We Share Data" },
  { id: "third-party-services", label: "Third-Party Services & SDKs" },
  { id: "messaging-video", label: "Messaging & Video Chats" },
  { id: "retention", label: "How Long We Retain Your Data" },
  { id: "your-rights", label: "Your Rights" },
  { id: "childrens-privacy", label: "Children's Privacy" },
  { id: "cross-border", label: "Cross-Border Data Transfers" },
  { id: "changes", label: "Privacy Policy Changes" },
  { id: "contact", label: "How To Contact Us" },
];

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="scroll-mt-24 text-[24px] lg:text-[28px] font-bold text-[#1F150F] mt-14 mb-4"
    >
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[18px] font-semibold text-[#1F150F] mt-8 mb-3">
      {children}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[#3B2E25] leading-relaxed mb-4">{children}</p>;
}

function UL({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc pl-6 mb-6 space-y-2 text-[#3B2E25] leading-relaxed">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="bg-[#FFFBF9] min-h-screen">
      <div className="max-w-3xl mx-auto px-6 py-16 lg:py-24">
        <Link href="/" className="inline-block mb-10">
          <Image src="/logo.png" alt="Caffriend" width={140} height={26} />
        </Link>

        <h1 className="text-[34px] lg:text-[44px] leading-[1.1] font-bold text-[#1F150F] mb-3">
          Caffriend Privacy Policy
        </h1>
        <p className="text-[#7A6A5E] mb-12">Last updated: February 2026</p>

        <nav
          aria-label="Quick navigation"
          className="rounded-[16px] border border-[#F3D5C6] bg-white p-6 mb-4"
        >
          <p className="text-sm font-semibold uppercase tracking-wide text-[#FA6404] mb-4">
            Quick Navigation
          </p>
          <ol className="list-decimal pl-5 space-y-2 text-[#3B2E25]">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="hover:text-[#FA6404] hover:underline">
                  {s.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <H2 id="who-we-are">1. Who We Are</H2>
        <P>
          Caffriend Inc. (&ldquo;Caffriend,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo;
          or &ldquo;our&rdquo;) operates the Caffriend mobile application and related
          services (collectively, the &ldquo;Services&rdquo;). Caffriend is a
          swipe-based professional networking platform that enables users to discover,
          match, and book coffee chats with other professionals.
        </P>

        <H2 id="where-this-applies">2. Where This Privacy Policy Applies</H2>
        <P>
          This Privacy Policy applies to the Caffriend mobile application, our website,
          and any related services that link to this Privacy Policy. It does not apply
          to third-party services or websites that may be accessed through the Services.
        </P>

        <H2 id="data-we-collect">3. Data We Collect</H2>

        <H3>3.1 Information You Provide to Us</H3>
        <P>
          When you create an account or use Caffriend, you may provide the following
          categories of information:
        </P>
        <H3>Account &amp; Contact Information</H3>
        <UL
          items={[
            "Full name",
            "Email address",
            "Phone number",
            "Job title",
            "Employer or company",
            "Past work experience",
            "University or educational background",
            "LinkedIn profile URL",
          ]}
        />
        <H3>Profile Information</H3>
        <UL
          items={[
            "Profile photo(s)",
            "Professional interests and goals",
            "Networking preferences and filters",
            "Short bio or profile text",
          ]}
        />
        <H3>User Content</H3>
        <UL
          items={[
            "Private in-app messages between matched users (not SMS)",
            "Video chat content conducted within the app",
            "Photos or other content you choose to upload or share",
          ]}
        />

        <H3>3.2 Information Collected Automatically</H3>
        <P>When you use the Services, we automatically collect:</P>
        <H3>Usage Data</H3>
        <UL
          items={[
            "Profiles viewed, liked, or swiped",
            "Matches and interactions",
            "Messages sent and received",
            "Feature usage and engagement metrics",
          ]}
        />
        <H3>Device &amp; Technical Data</H3>
        <UL
          items={[
            "Device type, operating system, and app version",
            "IP address",
            "Crash logs and diagnostic data",
          ]}
        />
        <H3>Coarse Location Data</H3>
        <UL
          items={[
            "Approximate location (e.g., city or region level)",
            "Derived from IP address or device settings",
            <>
              We do <strong>not</strong> collect precise GPS location
            </>,
          ]}
        />

        <H3>3.3 Subscription &amp; Purchase Information</H3>
        <P>If you purchase a paid subscription:</P>
        <UL
          items={[
            "Subscription tier (Free, Pro, Premium)",
            "Purchase status and renewal information",
          ]}
        />
        <P>
          Payment card details are <strong>not stored by Caffriend</strong> and are
          processed securely by our payment provider.
        </P>

        <H2 id="how-we-use-data">4. How We Use Data</H2>
        <P>We use the information we collect to:</P>
        <UL
          items={[
            "Create and manage your account",
            "Enable matching, messaging, and video chats",
            "Personalize profiles, matches, and recommendations",
            "Process subscriptions and payments",
            "Provide customer support",
            "Monitor and improve app performance",
            "Enforce our Terms of Service and community guidelines",
            "Detect fraud, abuse, or security incidents",
          ]}
        />
        <H3>Product Personalization</H3>
        <P>
          We personalize your experience by showing you different profiles and
          recommendations based on:
        </P>
        <UL
          items={[
            "Selected goals and preferences",
            "Filters (e.g., industry, experience level)",
            "App activity and engagement",
          ]}
        />

        <H2 id="free-vs-paid">5. Free vs. Paid User Data Use</H2>
        <P>Caffriend offers both free and paid subscription tiers.</P>
        <UL
          items={[
            <>
              <strong>Free users:</strong> Certain behavioral data (such as likes and
              swipe activity) may be visible or surfaced to paid users to support
              discovery and matching features.
            </>,
            <>
              <strong>Paid users:</strong> Gain enhanced visibility, filtering, and
              insights based on additional data processing.
            </>,
          ]}
        />
        <P>
          All data use is limited to what is necessary to operate and improve the
          Services.
        </P>

        <H2 id="how-we-share-data">6. How We Share Data</H2>
        <P>
          We do <strong>not sell your personal information</strong>.
        </P>
        <P>We may share information:</P>
        <UL
          items={[
            "With other users you match or communicate with",
            "With service providers who help operate the Services",
            "To comply with legal obligations or enforce rights",
            "In connection with a business transfer (e.g., merger or acquisition)",
          ]}
        />

        <H2 id="third-party-services">7. Third-Party Services &amp; SDKs</H2>
        <P>Caffriend integrates the following third-party services:</P>
        <H3>Stripe (Payments)</H3>
        <UL
          items={[
            "Used to process subscriptions and in-app purchases",
            "Stripe may collect payment and transaction data in accordance with its own privacy policy",
          ]}
        />
        <H3>Twilio (OTP &amp; Communications)</H3>
        <UL
          items={[
            "Used for one-time password (OTP) authentication",
            "May process phone numbers and verification metadata",
          ]}
        />
        <P>
          Caffriend does not control how third parties process data beyond the services
          they provide.
        </P>

        <H2 id="messaging-video">8. Messaging &amp; Video Chats</H2>
        <UL
          items={[
            "All in-app messaging is private and not SMS-based",
            <>
              Video chats are <strong>live only</strong> and are{" "}
              <strong>not recorded or stored</strong> after the session ends
            </>,
            "We do not publicly display private communications",
            <>
              Messages and profiles may be reviewed through{" "}
              <strong>manual moderation</strong> to prevent bots, abuse, or violations
              of our community guidelines
            </>,
            "Communications may be temporarily processed to enable delivery, moderation, security, or abuse prevention",
          ]}
        />

        <H2 id="retention">9. How Long We Retain Your Data</H2>
        <P>
          We want the professional connections you make through Caffriend to be
          meaningful and long-lasting. However, we retain your personal data{" "}
          <strong>only for as long as necessary</strong> to provide the Services, for
          legitimate business purposes (as described in this Privacy Policy), and as
          permitted or required by applicable law.
        </P>
        <H3>Account Closure and Inactivity</H3>
        <P>
          If you choose to stop using Caffriend, you may delete your account at any time
          through the app. Once your account is deleted, your profile will no longer be
          visible to other users.
        </P>
        <P>
          We may also automatically deactivate or close accounts that have been{" "}
          <strong>inactive for an extended period</strong>, in accordance with our
          internal policies.
        </P>
        <H3>Data Retention After Account Deletion</H3>
        <P>
          Following account deletion or closure, we retain and delete personal data as
          follows:
        </P>
        <H3>Safety and Security Retention</H3>
        <P>
          To protect the safety and security of our users and the integrity of the
          platform, we retain certain data for a limited period after account deletion
          or account ban. This data may be retained for up to{" "}
          <strong>three (3) months following account deletion</strong> or up to{" "}
          <strong>one (1) year following an account ban</strong>, where necessary to
          investigate, prevent, or address harmful, abusive, or unlawful behavior. This
          retention is based on our legitimate interests and the interests of affected
          users.
        </P>
        <H3>Legal and Regulatory Obligations</H3>
        <P>
          We retain limited information as required to comply with legal, tax,
          accounting, and regulatory obligations. For example:
        </P>
        <UL
          items={[
            <>
              Transaction and subscription records may be retained for up to{" "}
              <strong>seven (7) to ten (10) years</strong>, depending on applicable tax
              and accounting laws.
            </>,
            "Records relating to payment disputes or chargebacks may be retained for the duration of the dispute resolution period.",
            "System logs and technical records may be retained for a limited period to comply with legal obligations and ensure platform security.",
          ]}
        />
        <H3>Customer Support and Platform Integrity</H3>
        <P>
          We may retain customer support communications, moderation records, and related
          information for up to <strong>five (5) to six (6) years</strong> from the date
          of the interaction. This supports user safety efforts, customer support
          decisions, enforcement of our Terms, and our ability to establish, exercise, or
          defend legal claims.
        </P>
        <H3>Business and Legitimate Interests</H3>
        <P>
          We may retain limited information related to past accounts and subscriptions
          for a reasonable period after account closure to support internal reporting,
          fraud prevention, and financial forecasting. Certain profile-related data may
          also be retained for up to <strong>one (1) year</strong> where necessary in
          anticipation of potential legal claims.
        </P>
        <H3>Legal Claims and Preservation Requests</H3>
        <P>
          Where there is an outstanding or reasonably anticipated issue, claim, dispute,
          or legal request (such as a subpoena or preservation request), we may retain
          relevant data for as long as required to comply with our legal obligations or
          to resolve the matter.
        </P>
        <H3>Anonymized and Aggregated Data</H3>
        <P>
          Where permitted by law, we may retain and use data that has been{" "}
          <strong>anonymized or aggregated</strong> so that it can no longer be used to
          identify you. We use such data to improve and develop our Services, enhance
          safety, and create new features and technologies.
        </P>

        <H2 id="your-rights">10. Your Rights</H2>
        <P>
          We want you to be in control of your data. Below we outline the rights,
          options, and tools available to you regarding your personal information.
          Depending on where you live, your rights may vary or be described differently
          under applicable law. If you have any questions about your rights or how to
          exercise them, please contact us using the details provided in{" "}
          <a href="#contact" className="text-[#FA6404] hover:underline">
            How To Contact Us
          </a>
          .
        </P>
        <H3>Access, Portability, or Right to Know</H3>
        <P>
          You have the right to be informed about the personal data we process about you
          and, in some cases, to request a copy of that data.
        </P>
        <P>
          <em>How to exercise it:</em> You can access and review certain personal data
          directly by logging into your account. You may also request a copy of your data
          by contacting us, and we will provide it in accordance with applicable law.
        </P>
        <H3>Rectification or Correction</H3>
        <P>
          You have the right to request that inaccurate or incomplete personal data be
          corrected or updated.
        </P>
        <P>
          <em>How to exercise it:</em> You can update most of your personal information
          directly within the app by editing your profile. If you need assistance
          correcting other data, please contact us.
        </P>
        <H3>Deletion or Erasure</H3>
        <P>You have the right to request the deletion of your personal data.</P>
        <P>
          <em>How to exercise it:</em> You may delete certain information directly within
          the app and can delete your account at any time through in-app settings. Once
          your account is deleted, we will remove or anonymize your personal data in
          accordance with this Privacy Policy and applicable law. You may also contact us
          to request deletion.
        </P>
        <H3>Objection (Opt-out) or Restriction</H3>
        <P>
          You have the right to object to, or request restriction of, certain processing
          of your personal data.
        </P>
        <P>
          <em>How to exercise it:</em> You may opt out of certain data processing
          activities through your account settings where available. If additional
          restrictions are desired, you may contact us to submit a request.
        </P>
        <H3>Consent Withdrawal</H3>
        <P>
          Where we rely on your consent to process personal data, you have the right to
          withdraw that consent at any time.
        </P>
        <P>
          <em>How to exercise it:</em> You may withdraw consent by adjusting your account
          settings or by changing your device permissions (for example, access to photos,
          camera, microphone, notifications, or location services). Withdrawing consent
          may limit certain features or functionality of the Services. You may also
          contact us for assistance.
        </P>
        <H3>Identity Verification and Limitations</H3>
        <P>
          For your protection and the protection of other users, we may request additional
          information to verify your identity or authority before fulfilling certain
          requests. This helps ensure that no one else gains unauthorized access to your
          personal data.
        </P>
        <P>
          Please note that we may decline or limit requests where permitted by law,
          including if we are unable to verify your identity, if the request is unlawful
          or excessive, or if fulfilling the request would infringe upon the rights,
          privacy, trade secrets, or intellectual property of others.
        </P>
        <P>
          If your request involves personal data relating to another user (for example,
          messages they sent), that user must submit the request themselves.
        </P>
        <H3>Regional Rights</H3>
        <P>
          Depending on your location, you may have additional rights under local privacy
          laws, including the right to lodge a complaint with a data protection authority
          or regulator if you believe your personal data has been processed unlawfully.
          Where applicable, you may also have the right to appeal decisions regarding
          privacy requests.
        </P>

        <H2 id="childrens-privacy">11. Children&rsquo;s Privacy</H2>
        <P>
          Caffriend is intended{" "}
          <strong>only for individuals who are 18 years of age or older</strong>. We do
          not permit individuals under the age of 18 to create accounts or use the
          Services.
        </P>
        <P>
          We do not knowingly collect, solicit, or maintain personal information from
          anyone under the age of 18. If we become aware that we have collected personal
          data from an individual under 18, we will take steps to promptly delete such
          information and terminate the associated account.
        </P>
        <P>
          If you believe that a minor may have provided us with personal information or is
          using the Services in violation of this policy, please contact us so we can
          investigate and take appropriate action.
        </P>

        <H2 id="cross-border">12. Cross-Border Data Transfers</H2>
        <P>
          Caffriend is currently available only to users located in{" "}
          <strong>Canada and the United States of America</strong>. As a result, any
          cross-border transfer or processing of personal information occurs{" "}
          <strong>only between Canada and the United States</strong>.
        </P>
        <P>
          We ensure that any such data transfers are conducted in accordance with
          applicable data protection and privacy laws, including implementing appropriate
          safeguards and contractual measures with our service providers to protect
          personal information during processing and storage.
        </P>

        <H2 id="changes">13. Privacy Policy Changes</H2>
        <P>
          We may update this Privacy Policy from time to time. Material changes will be
          communicated through the app or website.
        </P>

        <H2 id="contact">14. How To Contact Us</H2>
        <P>
          If you have questions or requests regarding this Privacy Policy, contact us at:
        </P>
        <P>
          <strong>Email:</strong>{" "}
          <a
            href="mailto:info@caffriend.com"
            className="text-[#FA6404] hover:underline"
          >
            info@caffriend.com
          </a>
        </P>

        <hr className="my-12 border-[#F3D5C6]" />
        <p className="text-sm text-[#7A6A5E]">
          This Privacy Policy is designed to comply with Apple App Store App Privacy
          requirements and industry standards.
        </p>

        <div className="mt-12">
          <Link href="/" className="text-[#FA6404] hover:underline font-semibold">
            &larr; Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
