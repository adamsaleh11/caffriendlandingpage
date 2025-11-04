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
  const [emailMobile, setEmailMobile] = useState("");
  const [emailDesktop, setEmailDesktop] = useState("");
  const [loadingMobile, setLoadingMobile] = useState(false);
  const [loadingDesktop, setLoadingDesktop] = useState(false);

  const handleSubmitMobile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!emailMobile) return;
    setLoadingMobile(true);
    try {
      await submitEarlyAccess(emailMobile.trim());
      setEmailMobile("");
      alert("Thanks! You're on the list.");
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message);
      } else {
        alert("Something went wrong.");
      }
    } finally {
      setLoadingMobile(false);
    }
  };

  const handleSubmitDesktop = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!emailDesktop) return;
    setLoadingDesktop(true);
    try {
      await submitEarlyAccess(emailDesktop.trim());
      setEmailDesktop("");
      alert("Thanks! You're on the list.");
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message);
      } else {
        alert("Something went wrong.");
      }
    } finally {
      setLoadingDesktop(false);
    }
  };

  return (
    <footer className="relative bg-[#FFFBF9] pt-16 pb-10 lg:pt-24 lg:pb-12 overflow-visible">
      <div className="relative max-w-7xl mx-auto px-6 z-10">
        {/* Desktop Layout */}
        <div className="hidden lg:grid lg:grid-cols-2 gap-16 items-start">
          <div className="relative w-full">
            <Image
              src="/PhoneFooter.png"
              alt="Phone"
              width={600}
              height={600}
              className="relative z-20 w-full h-auto max-w-[500px] mx-auto object-contain"
              priority
            />
          </div>

          <div className="text-left relative z-20 pt-8">
            <p className="text-2xl font-semibold text-[#FA6404] mb-6">
              Join the waitlist
            </p>
            <h2 className="text-[35px] leading-[1.1] font-bold text-[#1F150F] mb-8">
              Stop networking the hard way.
              <br />
              Start connecting the smart way.
            </h2>
            <p className="text-[#1F150F] text-lg mb-12 leading-relaxed">
              Ditch the 100+ cold emails and LinkedIn messages that go
              unread—start making real connections that get results.
            </p>

            <form onSubmit={handleSubmitDesktop}>
              <div className="flex w-full max-w-[500px] shadow-lg rounded-[16px] overflow-hidden">
                <input
                  type="email"
                  value={emailDesktop}
                  onChange={(e) => setEmailDesktop(e.target.value)}
                  placeholder="Enter your email address"
                  className="h-[64px] flex-1 min-w-0 bg-white px-6 text-[16px] text-[#111827] placeholder:text-[#9CA3AF] outline-none"
                  required
                />
                <button
                  type="submit"
                  className="h-[64px] px-8 bg-[#FA6404] text-[16px] font-semibold text-white whitespace-nowrap"
                  disabled={loadingDesktop}
                >
                  {loadingDesktop ? "Submitting..." : "Get Early Access"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="lg:hidden">
          <div className="text-center mb-12 relative z-20">
            <p className="text-lg font-semibold text-[#FA6404] mb-4">
              Join the waitlist
            </p>
            <h2 className="text-[28px] font-bold text-[#1F150F] leading-tight mb-6">
              Stop networking the hard way. Start connecting the smart way.
            </h2>
            <p className="text-[#1F150F] text-base mb-8 leading-relaxed">
              Ditch the 100+ cold emails and LinkedIn messages that go
              unread—start making real connections that get results.
            </p>

            <form onSubmit={handleSubmitMobile}>
              <div className="flex w-full shadow-lg rounded-[16px] overflow-hidden mb-12">
                <input
                  type="email"
                  value={emailMobile}
                  onChange={(e) => setEmailMobile(e.target.value)}
                  placeholder="Enter your email address"
                  className="h-[56px] flex-1 min-w-0 bg-white px-4 text-[14px] text-[#111827] placeholder:text-[#9CA3AF] outline-none"
                  required
                />
                <button
                  type="submit"
                  className="h-[56px] px-6 bg-[#FA6404] text-[14px] font-semibold text-white whitespace-nowrap"
                  disabled={loadingMobile}
                >
                  {loadingMobile ? "Submitting..." : "Get Early Access"}
                </button>
              </div>
            </form>
          </div>

          <div className="relative w-full max-w-sm mx-auto z-20">
            <Image
              src="/PhoneFooter.png"
              alt="Phone"
              width={400}
              height={400}
              className="relative z-20 w-full h-auto mx-auto"
              priority
            />
          </div>
        </div>
      </div>

      {/* Footer Bottom */}
      <div className="relative mt-16 border-t border-[#F3D5C6] pt-8 z-20">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center gap-6">
          <div className="flex items-center">
            <Image
              src="/logo.png"
              alt="Caffriend Logo"
              width={140}
              height={26}
            />
          </div>
          <div className="flex-1"></div>
          <a
            href="mailto:caffriendapp@gmail.com"
            className="text-[#FA6404] hover:underline text-sm"
          >
            contact@caffriend.com
          </a>
          <div className="flex gap-4">
            <a
              href="https://www.linkedin.com/company/caffriend/?viewAsMember=true"
              aria-label="LinkedIn"
              className="hover:opacity-70 transition-opacity"
            >
              <Image
                src="/linkedin.png"
                alt="LinkedIn"
                width={24}
                height={24}
              />
            </a>
            <a
              href="https://www.instagram.com/caf_friend?igsh=ZHRqbHprdDhhMDY%3D&utm_source=qr"
              aria-label="Instagram"
              className="hover:opacity-70 transition-opacity"
            >
              <Image
                src="/instagram.png"
                alt="Instagram"
                width={24}
                height={24}
              />
            </a>
            <a
              href="https://www.youtube.com/@caffriendapp"
              aria-label="YouTube"
              className="hover:opacity-70 transition-opacity"
            >
              <Image src="/youtube.png" alt="YouTube" width={24} height={24} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
