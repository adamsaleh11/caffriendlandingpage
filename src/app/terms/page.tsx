// app/terms/page.tsx
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions | Caffriend",
  description:
    "Eligibility, subscription tiers, messaging and moderation, and account closure for the Caffriend app and related services.",
};

const sections = [
  { id: "who-we-are", label: "Who We Are" },
  { id: "eligibility", label: "Eligibility" },
  { id: "subscription-tiers", label: "Free vs. Paid Subscription Tiers" },
  { id: "messaging-moderation", label: "Messaging & Moderation" },
  { id: "account-closure", label: "Account Closure and Inactivity" },
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

export default function TermsPage() {
  return (
    <main className="bg-[#FFFBF9] min-h-screen">
      <div className="max-w-3xl mx-auto px-6 py-16 lg:py-24">
        <Link href="/" className="inline-block mb-10">
          <Image src="/logo.png" alt="Caffriend" width={140} height={26} />
        </Link>

        <h1 className="text-[34px] lg:text-[44px] leading-[1.1] font-bold text-[#1F150F] mb-3">
          Caffriend Terms &amp; Conditions
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
                <a
                  href={`#${s.id}`}
                  className="hover:text-[#FA6404] hover:underline"
                >
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
        <P>
          How we collect, use, share, and retain your personal information is described
          separately in our{" "}
          <Link href="/privacy" className="text-[#FA6404] hover:underline">
            Privacy Policy
          </Link>
          .
        </P>

        <H2 id="eligibility">2. Eligibility</H2>
        <P>
          Caffriend is intended{" "}
          <strong>only for individuals who are 18 years of age or older</strong>. We do
          not permit individuals under the age of 18 to create accounts or use the
          Services.
        </P>
        <P>
          If you believe that a minor may have provided us with personal information or
          is using the Services in violation of this policy, please contact us so we can
          investigate and take appropriate action.
        </P>
        <P>
          Caffriend is currently available only to users located in{" "}
          <strong>Canada and the United States of America</strong>.
        </P>

        <H2 id="subscription-tiers">3. Free vs. Paid Subscription Tiers</H2>
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
        <P>
          If you purchase a paid subscription, your subscription tier (Free, Pro,
          Premium) and your purchase status and renewal information are recorded.
          Payment card details are <strong>not stored by Caffriend</strong> and are
          processed securely by our payment provider, Stripe.
        </P>

        <H2 id="messaging-moderation">4. Messaging &amp; Moderation</H2>
        <UL
          items={[
            "All in-app messaging is private and not SMS-based",
            <>
              Messages and profiles may be reviewed through{" "}
              <strong>manual moderation</strong> to prevent bots, abuse, or violations
              of our community guidelines
            </>,
            "Communications may be temporarily processed to enable delivery, moderation, security, or abuse prevention",
          ]}
        />
        <P>
          How message and video chat content is handled as personal data — including
          that video chats are live only and are not recorded or stored — is described
          in our{" "}
          <Link href="/privacy" className="text-[#FA6404] hover:underline">
            Privacy Policy
          </Link>
          .
        </P>

        <H2 id="account-closure">5. Account Closure and Inactivity</H2>
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
        <P>
          Data retained after account deletion or an account ban is described in{" "}
          <Link
            href="/privacy#retention"
            className="text-[#FA6404] hover:underline"
          >
            How Long We Retain Your Data
          </Link>
          .
        </P>

        <H2 id="contact">6. How To Contact Us</H2>
        <P>
          If you have questions or requests regarding these Terms &amp; Conditions,
          contact us at:
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

        <div className="mt-12 flex flex-wrap gap-6">
          <Link
            href="/"
            className="text-[#FA6404] hover:underline font-semibold"
          >
            &larr; Back to home
          </Link>
          <Link
            href="/privacy"
            className="text-[#FA6404] hover:underline font-semibold"
          >
            Privacy Policy
          </Link>
        </div>
      </div>
    </main>
  );
}
