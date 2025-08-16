// components/FooterCta.tsx
"use client";

import { useState } from "react";
import Image from "next/image";

async function submitEarlyAccess(email: string) {
  const res = await fetch("/api/early-access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const { error } = await res
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(error || "Failed to submit");
  }
}

export default function FooterCta() {
  const [emailFooterDesktop, setEmailFooterDesktop] = useState("");
  const [emailFooterMobile, setEmailFooterMobile] = useState("");
  const [loadingFD, setLoadingFD] = useState(false);
  const [loadingFM, setLoadingFM] = useState(false);

  const handleSubmitFD = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!emailFooterDesktop) return;
    setLoadingFD(true);
    try {
      await submitEarlyAccess(emailFooterDesktop.trim());
      setEmailFooterDesktop("");
      alert("Thanks! You're on the list.");
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message);
      } else {
        alert("Something went wrong.");
      }
    } finally {
      setLoadingFD(false);
    }
  };

  const handleSubmitFM = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!emailFooterMobile) return;
    setLoadingFM(true);
    try {
      await submitEarlyAccess(emailFooterMobile.trim());
      setEmailFooterMobile("");
      alert("Thanks! You're on the list.");
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message);
      } else {
        alert("Something went wrong.");
      }
    } finally {
      setLoadingFM(false);
    }
  };

  return (
    <footer className="relative bg-[#FFF7F2] pt-16 pb-10 lg:pt-24 lg:pb-12 overflow-visible">
      {/* NOTE: overflow-visible keeps the rectangle from being clipped */}

      {/* 🔶 MOBILE-ONLY RECTANGLE (trial & error here) */}
      {/* Tweak: bottom-[150px], w-[300px], h-[180px] */}
      <div
        className="
          absolute lg:hidden
          left-1/2 -translate-x-1/2
          bottom-[221px]         /* ⬅️ move UP/DOWN on mobile */
          z-0 pointer-events-none
        "
      >
        <div
          className="
            relative
            w-[500px]            /* ⬅️ MOBILE width */
            h-[180px]            /* ⬅️ MOBILE height */
          "
        >
          <Image
            src="/rectangle.png"
            alt="Orange Background"
            fill
            className="object-contain /* switch to object-fill if you want to ignore aspect ratio */"
            priority={false}
          />
        </div>
      </div>

      {/* 🔒 DESKTOP RECTANGLE (trial & error here; layout unchanged otherwise) */}
      {/* Tweak: bottom-[200px], left-[160px], lg:w-[500px], lg:h-[260px] */}
      <div
        className="
          hidden lg:block
          absolute
          bottom-[200px]         /* ⬅️ move UP/DOWN on desktop */
          left-[160px]           /* ⬅️ move LEFT/RIGHT on desktop */
          z-0 pointer-events-none
        "
      >
        <div
          className="
            relative
            lg:w-[500px]         /* ⬅️ DESKTOP width */
            lg:h-[260px]         /* ⬅️ DESKTOP height; change freely */
            w-[500px] h-[260px]  /* fallback for safety */
          "
        >
          <Image
            src="/rectangle.png"
            alt="Orange Background"
            fill
            className="object-contain lg:object-left-bottom"
            /* Want the rectangle to stretch taller without widening?
               Use className='object-fill' to break aspect ratio. */
            priority={false}
          />
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-6 z-10">
        {/* Desktop Layout */}
        <div className="hidden lg:grid lg:grid-cols-2 gap-16 items-center min-h-[600px]">
          <div className="relative w-full max-w-md mx-auto">
            <div className="absolute bottom-125 left-8 z-30">
              <div className="flex gap-3">
                <div className="w-12 h-1.5 bg-[#FF6A00] rounded transform rotate-45"></div>
                <div className="w-8 h-1.5 bg-[#FF6A00] rounded transform rotate-45"></div>
              </div>
            </div>

            <Image
              src="/phone2.png"
              alt="Phone"
              width={400}
              height={800}
              className="relative z-20 w-full h-auto max-w-[350px] mx-auto mt-15.5"
              priority
            />

            <Image
              src="/adviceBubble.png"
              alt="Advice Bubble"
              width={280}
              height={160}
              className="absolute bottom-80 right-[-80px] w-[280px] z-30"
              priority
            />
          </div>

          <div className="text-left relative z-20">
            <p className="text-sm font-semibold text-[#FF6A00] mb-2">
              Join the waitlist
            </p>
            <h2 className="text-[40px] font-bold text-[#111827] leading-tight mb-4">
              Stop networking the hard way. Start connecting the smart way.
            </h2>
            <p className="text-[#4B5563] text-base mb-8 max-w-lg">
              Ditch the 100+ cold emails and LinkedIn messages that go
              unread—start making real connections that get results.
            </p>

            <form
              onSubmit={handleSubmitFD}
              className="flex items-center gap-4 w-full max-w-xl"
            >
              <input
                type="email"
                value={emailFooterDesktop}
                onChange={(e) => setEmailFooterDesktop(e.target.value)}
                placeholder="Enter your email address"
                className="flex-1 px-4 py-3 rounded-[10px] border border-[#E5E7EB] text-[#111827] placeholder:text-[#9CA3AF] bg-white"
                required
              />
              <button
                type="submit"
                className="bg-[#FF6A00] text-white font-semibold px-6 py-3 rounded-[10px] whitespace-nowrap"
                disabled={loadingFD}
              >
                {loadingFD ? "Submitting..." : "Get Early Access"}
              </button>
            </form>
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="lg:hidden">
          <div className="text-center mb-16 relative z-20">
            <p className="text-sm font-semibold text-[#FF6A00] mb-2">
              Join the waitlist
            </p>
            <h2 className="text-[28px] sm:text-[32px] font-bold text-[#111827] leading-tight mb-4">
              Stop networking the hard way. Start connecting the smart way.
            </h2>
            <p className="text-[#4B5563] text-base mb-6 max-w-lg mx-auto">
              Ditch the 100+ cold emails and LinkedIn messages that go
              unread—start making real connections that get results.
            </p>

            <form
              onSubmit={handleSubmitFM}
              className="flex flex-col gap-4 w-full max-w-sm mx-auto"
            >
              <input
                type="email"
                value={emailFooterMobile}
                onChange={(e) => setEmailFooterMobile(e.target.value)}
                placeholder="Enter your email address"
                className="px-4 py-3 rounded-[10px] border border-[#E5E7EB] text-[#111827] placeholder:text-[#9CA3AF] bg-white"
                required
              />
              <button
                type="submit"
                className="bg-[#FF6A00] text-white font-semibold px-6 py-3 rounded-[10px]"
                disabled={loadingFM}
              >
                {loadingFM ? "Submitting..." : "Get Early Access"}
              </button>
            </form>
          </div>

          <div className="relative w-full max-w-sm mx-auto mt-8 z-20">
            <div className="absolute bottom-95 left-8 z-30">
              <div className="flex gap-2">
                <div className="w-8 h-1 bg-[#FF6A00] rounded transform rotate-45"></div>
                <div className="w-6 h-1 bg-[#FF6A00] rounded transform rotate-45"></div>
              </div>
            </div>

            <Image
              src="/phone2.png"
              alt="Phone"
              width={300}
              height={600}
              className="relative z-20 w-full h-auto max-w-[280px] mx-auto mt-auto"
              priority
            />

            <Image
              src="/adviceBubble.png"
              alt="Advice Bubble"
              width={280}
              height={160}
              className="absolute -top-6 left-50 w-[220px] z-30"
              priority
            />
          </div>
        </div>
      </div>

      <div className="relative mt-16 border-t border-[#F3D5C6] pt-6 px-6 text-sm text-[#4B5563] z-20">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Caffriend Logo"
              width={20}
              height={20}
            />
            <span className="text-[#FF6A00] font-semibold">Caffriend</span>
          </div>
          <a
            href="mailto:caffriend@contact.com"
            className="text-[#FF6A00] hover:underline"
          >
            caffriendapp@gmail.com
          </a>
          <div className="flex gap-4">
            <a
              href="https://www.linkedin.com/company/caffriend/?viewAsMember=true"
              aria-label="LinkedIn"
            >
              <Image
                src="/linkedin.png"
                alt="LinkedIn"
                width={20}
                height={20}
              />
            </a>
            <a
              href="https://www.instagram.com/caf_friend?igsh=ZHRqbHprdDhhMDY%3D&utm_source=qr"
              aria-label="Instagram"
            >
              <Image
                src="/instagram.png"
                alt="Instagram"
                width={20}
                height={20}
              />
            </a>
            <a
              href="https://www.youtube.com/@caffriendapp"
              aria-label="YouTube"
            >
              <Image src="/youtube.png" alt="YouTube" width={20} height={20} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
