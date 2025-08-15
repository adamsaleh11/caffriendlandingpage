// components/FooterCta.tsx
import Image from "next/image";
import Link from "next/link";

export default function FooterCta() {
  return (
    <footer className="mt-24 bg-[#FFF7F2]">
      {" "}
      {/* light peach like mock */}
      {/* Top band: image left, copy + form right */}
      <div className="relative">
        <div className="container mx-auto grid items-center gap-10 px-6 py-16 lg:grid-cols-2 lg:gap-16 lg:px-8">
          {/* Left visuals */}
          <div className="relative">
            {/* orange rounded block behind phone */}
            <div className="absolute left-[-5%] bottom-6 hidden h-[240px] w-[260px] rounded-3xl bg-orange-500 lg:block" />
            {/* phone */}
            <Image
              src="/footer/phone-upcoming-calls.png"
              alt="Upcoming calls UI"
              width={520}
              height={900}
              className="relative z-10 mx-auto w-[75%] max-w-[420px] lg:w-[520px]"
              priority
            />
            {/* advice bubble */}
            <Image
              src="/footer/advice-bubble.png"
              alt="The biggest advice I've learned"
              width={420}
              height={220}
              className="absolute left-[12%] top-[-18px] w-[62%] max-w-[420px] rounded-xl shadow-lg"
              priority
            />
          </div>

          {/* Right copy + form */}
          <div className="max-w-[640px]">
            <p className="text-sm font-semibold text-orange-600">
              Join the Waitlist
            </p>
            <h2 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Stop networking the hard way.
              <br />
              Start connecting the smart way.
            </h2>
            <p className="mt-5 text-neutral-700">
              Ditch the 100+ cold emails and LinkedIn messages that go
              unread—start making real connections that get results.
            </p>

            {/* Email form (no client event handler) */}
            <form className="mt-6" action="" method="POST">
              <div className="flex items-center rounded-2xl bg-white shadow ring-1 ring-black/10 max-w-[720px] h-[60px] sm:h-[72px] p-2">
                <input
                  type="email"
                  name="email"
                  placeholder="Enter your email address"
                  className="flex-1 rounded-xl px-4 text-sm h-full outline-none placeholder:text-neutral-400"
                  aria-label="Email address"
                  required
                />
                <button
                  type="submit"
                  className="rounded-xl bg-orange-500 px-5 sm:px-6 h-[46px] sm:h-[59px] text-sm font-semibold text-white shadow hover:brightness-95 transition w-auto sm:w-[211px]"
                >
                  Get Early Access
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Divider line */}
        <div className="mx-auto w-full max-w-screen-xl px-6 lg:px-8">
          <div className="h-px w-full bg-orange-200/70" />
        </div>
      </div>
      {/* Bottom bar */}
      <div className="container mx-auto flex flex-col items-center justify-between gap-6 px-6 py-6 lg:flex-row lg:px-8">
        {/* left: brand */}
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Caffriend" width={24} height={24} />
          <span className="text-lg font-semibold text-orange-600">
            Caffriend
          </span>
        </div>

        {/* center: contact */}
        <a
          href="mailto:caffriend@contact.com"
          className="text-sm text-neutral-700 hover:underline"
        >
          caffriend@contact.com
        </a>

        {/* right: socials */}
        <div className="flex items-center gap-4">
          <SocialLink href="https://www.linkedin.com" label="LinkedIn">
            {/* LinkedIn icon */}
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                fill="currentColor"
                d="M4.98 3.5A2.5 2.5 0 1 1 5 8.5a2.5 2.5 0 0 1-.02-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-.95 1.84-1.95 3.78-1.95C20.2 8.75 21 11 21 14.2V21H17v-6c0-1.44-.03-3.3-2.01-3.3-2.01 0-2.32 1.57-2.32 3.2V21H9z"
              />
            </svg>
          </SocialLink>
          <SocialLink href="https://www.instagram.com" label="Instagram">
            {/* Instagram icon */}
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                fill="currentColor"
                d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm5 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2.2A2.8 2.8 0 1 0 12 16.8 2.8 2.8 0 0 0 12 9.2zm5.5-.9a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6z"
              />
            </svg>
          </SocialLink>
          <SocialLink href="https://www.youtube.com" label="YouTube">
            {/* YouTube icon */}
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path
                fill="currentColor"
                d="M23.5 7.5a4 4 0 0 0-2.8-2.8C18.7 4 12 4 12 4s-6.7 0-8.7.7A4 4 0 0 0 .5 7.5 41.7 41.7 0 0 0 0 12a41.7 41.7 0 0 0 .5 4.5 4 4 0 0 0 2.8 2.8C5.3 20 12 20 12 20s6.7 0 8.7-.7a4 4 0 0 0 2.8-2.8c.3-1.5.5-3 .5-4.5s-.2-3-.5-4.5zM9.8 15.3V8.7L15.5 12l-5.7 3.3z"
              />
            </svg>
          </SocialLink>
        </div>
      </div>
    </footer>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="inline-flex items-center justify-center rounded-md p-2 text-orange-600 ring-1 ring-transparent transition hover:bg-orange-100/60 hover:ring-orange-200"
    >
      {children}
    </Link>
  );
}
