// components/FooterCta.tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import e from "express";

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
      <div className="relative max-w-[95%] mx-auto px-6 z-10 max-h-[710px]">
        {/* Desktop Layout */}
        <div className="hidden lg:grid lg:grid-cols-2 gap-16 items-center max-h-[710px]">
          <div className="relative w-full mx-auto">
            <Image
              src="/PhoneFooter.png"
              alt="Phone"
              width={700}
              height={700}
              className="relative z-20 w-full h-auto mx-auto max-h-[710px] object-contain"
              priority
            />
          </div>


          <div className="text-left relative z-20">
            <p className="text-2xl font-semibold text-[#FA6404] mb-[25px]">
              Join the waitlist
            </p>
            <h2 className="text-5xl lg:leading-15 sm:leading-9 leading-[30px] font-bold text-[#1F150F]">
              Stop networking the hard way. Start connecting the smart way.
            </h2>
            <p className="text-[#1F150F] text-xl mt-[50px] max-w-[100%]">
              Ditch the 100+ cold emails and LinkedIn messages that go
              unread—start making real connections that get results.
            </p>

            <form onSubmit={handleSubmitFD}>
              <div className="flex w-[90%] mt-[55px] shadow-md rounded-[12px] overflow-hidden">
                <input
                  type="email"
                  value={emailFooterDesktop}
                  onChange={(e) => setEmailFooterDesktop(e.target.value)}
                  placeholder="Enter your email address"
                  className="lg:h-[72px] h-[52px] flex-1 min-w-0 bg-white px-4 text-[13px] sm:text-[15px] lg:text-[20px] text-[#111827] placeholder:text-[#9CA3AF] outline-none"
                  required
                />
                <button
                  type="submit"
                  className="lg:h-[72px] h-[52px] w-[35%] px-5 bg-[#FA6404] text-[13px] sm:text-[15px] lg:text-[20px] font-semibold text-white"
                  disabled={loadingFD}
                >
                  {loadingFD ? "Submitting..." : "Get Early Access"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="lg:hidden">
          <div className="text-center mb-16 relative z-20">
            <p className="text-sm font-semibold text-[#FA6404] mb-2">
              Join the waitlist
            </p>
            <h2 className="text-[28px] sm:text-[32px] font-bold text-[#1F150F] leading-tight mb-4">
              Stop networking the hard way. Start connecting the smart way.
            </h2>
            <p className="text-[#1F150F] text-base mb-6 max-w-lg mx-auto">
              Ditch the 100+ cold emails and LinkedIn messages that go
              unread—start making real connections that get results.
            </p>

            <form onSubmit={handleSubmitFM}>
              <div className="flex w-full shadow-md rounded-[12px] overflow-hidden">
                <input
                  type="email"
                  value={emailFooterMobile}
                  onChange={(e) => setEmailFooterMobile(e.target.value)}
                  placeholder="Enter your email address"
                  className="lg:h-[72px] h-[52px] flex-1 min-w-0 bg-white px-4 text-[13px] sm:text-[15px] lg:text-[20px] text-[#111827] placeholder:text-[#9CA3AF] outline-none"
                  required
                />
                <button
                  type="submit"
                  className="lg:h-[72px] h-[52px] w-[35%] px-5 bg-[#FA6404] text-[13px] sm:text-[15px] lg:text-[20px] font-semibold text-white"
                  disabled={loadingFM}
                >
                  {loadingFM ? "Submitting..." : "Get Early Access"}
                </button>
              </div>
            </form>
          </div>

          <div className="relative w-full max-w-sm mx-auto mt-8 z-20">
            <Image
              src="/PhoneFooter.png"
              alt="Phone"
              width={600}
              height={600}
              className="relative z-20 w-full h-auto mx-auto mt-auto"
              priority
            />
          </div>
        </div>
      </div>

      <div className="relative mt-16 border-t border-[#F3D5C6] pt-6 px-6 text-sm text-[#4B5563] z-20">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Caffriend Logo" width={140} height={20} />
          </div>
          <a href="mailto:caffriend@contact.com" className="text-[#FA6404] hover:underline">
            caffriendapp@gmail.com
          </a>
          <div className="flex gap-4">
            <a href="https://www.linkedin.com/company/caffriend/?viewAsMember=true" aria-label="LinkedIn">
              <Image src="/linkedin.png" alt="LinkedIn" width={20} height={20} />
            </a>
            <a href="https://www.instagram.com/caf_friend?igsh=ZHRqbHprdDhhMDY%3D&utm_source=qr" aria-label="Instagram">
              <Image src="/instagram.png" alt="Instagram" width={20} height={20} />
            </a>
            <a href="https://www.youtube.com/@caffriendapp" aria-label="YouTube">
              <Image src="/youtube.png" alt="YouTube" width={20} height={20} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );

}
