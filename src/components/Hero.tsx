// components/Hero.tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import FeatureCards from "./FeatureCards";

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

export default function Hero() {
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
    <section className="relative overflow-x-hidden bg-gradient-to-b from-[#FFFFFF] to-[#FFECE0]">
      {/* Top bar */}
      <header className="mx-auto max-w-[1280px] pr-6 pl-4 lg:pr-8 lg:pl-6">
        <div className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Caffriend"
              width={38}
              height={36.19}
              priority
            />
            <span className="text-[18px] font-semibold text-[#FF6A00] leading-none">
              Caffriend
            </span>
          </div>
          <Link
            href="#early-access"
            className="rounded-[10px] bg-[#FF6A00] px-5 py-3 text-[14px] font-semibold text-white shadow-md"
          >
            Get Early Access
          </Link>
        </div>
      </header>

      {/* Hero grid */}
      <div className="mx-auto max-w-[1280px] pr-6 pl-4 lg:pr-8 lg:pl-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 lg:gap-x-28">
          {/* Left: copy */}
          <div className="pt-6 sm:pt-10 lg:col-span-6 lg:pt-40 lg:-ml-4">
            <p className="mb-3 text-[14px] font-semibold text-[#FF6A00] text-center lg:text-left">
              Swipe right on your next coffee chat
            </p>

            <h1 className="text-[32px] sm:text-[36px] lg:text-[56px] leading-[1.2] font-extrabold tracking-[-0.02em] text-[#1E1E1E] text-center lg:text-left">
              The smarter, faster
              <br />
              way to network.
            </h1>

            {/* MOBILE ONLY: Subheading + Email + Squiggle */}
            <div className="mt-6 flex justify-center lg:hidden">
              <div className="relative w-full max-w-[92%] flex flex-col items-center gap-5">
                {/* Subheading */}
                <p className="text-[16px] leading-[24px] text-[#1E1E1E] text-center max-w-[400px]">
                  Connect with 20+ industry professionals
                  <br />
                  every month—in under 5 minutes,
                  <br />
                  right from our app.
                </p>

                {/* Input + CTA */}
                <div className="relative w-full max-w-[500px]">
                  <form onSubmit={handleSubmitMobile}>
                    <div className="flex w-full shadow-md rounded-[12px] overflow-hidden">
                      <input
                        type="email"
                        value={emailMobile}
                        onChange={(e) => setEmailMobile(e.target.value)}
                        placeholder="Enter your email address"
                        className="h-[52px] flex-1 min-w-0 bg-white px-4 text-[15px] text-[#111827] placeholder:text-[#9CA3AF] outline-none"
                        required
                      />
                      <button
                        type="submit"
                        className="h-[52px] px-5 bg-[#FF6A00] text-[15px] font-semibold text-white"
                        disabled={loadingMobile}
                      >
                        {loadingMobile ? "Submitting..." : "Get Early Access"}
                      </button>
                    </div>
                  </form>

                  {/* Updated squiggle: thicker and -45deg */}
                  <Image
                    src="/squiggle.png"
                    alt=""
                    width={56}
                    height={56}
                    className="absolute -right-[45px] -top-[60px] rotate-[-45deg] pointer-events-none select-none"
                    priority
                  />
                </div>
              </div>
            </div>

            {/* DESKTOP ONLY: Subheading + Email + Squiggle */}
            <div className="hidden lg:block">
              <p className="mt-4 text-[16px] leading-[24px] text-[#1E1E1E] max-w-[520px]">
                Connect with 20+ industry professionals every month—in under 5
                minutes, right from our app.
              </p>
              <div className="relative mt-6 w-full max-w-[610px]">
                <form onSubmit={handleSubmitDesktop}>
                  <div className="flex w-full min-w-0">
                    <input
                      type="email"
                      value={emailDesktop}
                      onChange={(e) => setEmailDesktop(e.target.value)}
                      placeholder="Enter your email address"
                      className="h-[56px] flex-1 min-w-0 rounded-l-[10px] border border-[#E5E7EB] bg-white px-4 text-[14px] text-[#111827] placeholder:text-[#9CA3AF] outline-none"
                      required
                    />
                    <button
                      type="submit"
                      className="h-[56px] w-[170px] shrink-0 rounded-r-[10px] bg-[#FF6A00] text-[14px] font-semibold text-white"
                      disabled={loadingDesktop}
                    >
                      {loadingDesktop ? "Submitting..." : "Get Early Access"}
                    </button>
                  </div>
                </form>
                <Image
                  src="/squiggle.png"
                  alt=""
                  width={120}
                  height={84}
                  className="pointer-events-none absolute -right-[140px] top-1/2 -translate-y-[92%] select-none"
                  priority
                />
              </div>
            </div>
          </div>

          {/* Right visuals */}
          <div className="relative lg:col-span-6 lg:translate-x-2">
            <div className="relative mt-8 sm:mt-10 lg:mt-0 h-[520px] sm:h-[560px] lg:h-[710px]">
              {/* Phone */}
              <Image
                src="/phone.png"
                alt="App preview on iPhone"
                width={430}
                height={860}
                sizes="(min-width:1024px) 430px, 320px"
                className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 w-[280px] sm:w-[320px] lg:w-[430px] lg:left-auto lg:right-[40px] lg:top-[90px] lg:translate-x-0 lg:translate-y-0 select-none drop-shadow-2xl"
                priority
              />

              {/* Meeting bubble */}
              <div className="absolute left-[30%] top-[15%] -translate-x-1/2 w-[240px] h-[80px] sm:w-[250px] sm:h-[72px] lg:left-[6px] lg:top-[170px] lg:translate-x-0 lg:w-[361px] lg:h-[100px] rounded-[12px] border border-[#DADADA] bg-white">
                <Image
                  src="/bubble-meeting.png"
                  alt="Meeting with Briana"
                  width={361}
                  height={100}
                  sizes="(min-width:1024px) 361px, 250px"
                  className="h-full w-full rounded-[12px]"
                  priority
                />
              </div>

              {/* Booked bubble */}
              <div className="absolute left-[72%] bottom-[23%] -translate-x-1/2 w-[200px] h-[54px] sm:w-[230px] sm:h-[56px] lg:left-[350px] lg:bottom-[60px] lg:translate-x-0 lg:w-[296px] lg:h-[61px] rounded-[30px]">
                <Image
                  src="/bubble-booked.png"
                  alt="Booked for next week"
                  width={296}
                  height={61}
                  sizes="(min-width:1024px) 296px, 230px"
                  className="h-full w-full"
                  priority
                />
              </div>
            </div>
          </div>
        </div>

        {/* FeatureCards */}
        <div className="relative z-30 mt-8 sm:mt-10 lg:mt-0 lg:top-[10px]">
          <div className="mx-auto max-w-[1280px] px-0">
            <div className="rounded-[18px] bg-white/80 shadow-[0_1px_1px_rgba(0,0,0,0.04)] ring-1 ring-[#F2F2F2]">
              <div className="px-4 py-6 md:px-6 lg:px-8">
                <FeatureCards
                  skipIcon="/skip.png"
                  scheduleIcon="/schedule.png"
                  monetizeIcon="/monetize.png"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pb-14" />
    </section>
  );
}
