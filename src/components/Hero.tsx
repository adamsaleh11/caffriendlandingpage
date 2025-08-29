// components/Hero.tsx
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

type Feature = {
  iconSrc: string;
  iconAlt: string;
  title: string;
  description: string;
};

function FeatureCards({
  skipIcon,
  scheduleIcon,
  monetizeIcon,
}: {
  skipIcon: string;
  scheduleIcon: string;
  monetizeIcon: string;
}) {
  const features: Feature[] = [
    {
      iconSrc: skipIcon,
      iconAlt: "Swipe icon",
      title: "Skip the cold DMs",
      description: "Swipe and match with real professionals who want to chat.",
    },
    {
      iconSrc: scheduleIcon,
      iconAlt: "Clock icon",
      title: "Auto-schedule",
      description: "We find the time. Your invite appears in your calendar.",
    },
    {
      iconSrc: monetizeIcon,
      iconAlt: "Piggy bank icon",
      title: "Monetize your time",
      description: "Premium users get paid for every coffee chat.",
    },
  ];

  return (
    <section className="w-full">
      <div className="mx-auto max-w-[99%] px-2 lg:px-8">
        {/* 3-up grid */}
        <div className="grid grid-cols-1 gap-6 md:gap-8 lg:gap-10 md:grid-cols-3">
          {features.map((f) => (
            <article
              key={f.title}
              className="rounded-2xl border border-gray-200/70 bg-white shadow-lg hover:shadow-xl transition-shadow duration-300"
            >
              <div className="p-8 lg:p-10 lg:pb-20">
                {/* Icon pill */}
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl">
                  <Image
                    src={f.iconSrc}
                    alt={f.iconAlt}
                    width={96}
                    height={96}
                    priority
                  />
                </div>

                {/* Title */}
                <h3 className="text-[24px] leading-[1.1] tracking-[-0.02em] font-bold text-[#1F150F]">
                  {f.title}
                </h3>

                {/* Body */}
                <p className="mt-4 lg:mb-10 sm:mb-0 text-[16px] leading-7 text-[#1F150F]">
                  {f.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Hero() {
  const [emailMobile, setEmailMobile] = useState("");
  const [emailDesktop, setEmailDesktop] = useState("");
  const [loadingMobile, setLoadingMobile] = useState(false);
  const [loadingDesktop, setLoadingDesktop] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

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
    <section className="relative bg-white overflow-hidden p-6">
      <div className="bg-gradient-to-b from-[#FFFFFF] to-[#FFECE0] lg:pb-20 pb-0 rounded-[10px]">
        {/* Top bar */}
        <header className="pr-6 pl-4 lg:pr-8 lg:px-14">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center gap-3 sm:max-w-[140px] lg:max-w-[200px] max-w-[100px]">
              <Image
                src="/logo.png"
                alt="Caffriend"
                width={200}
                height={37}
                priority
              />
            </div>
            <button
              onClick={() => setIsOpen(true)}
              className="rounded-[10px] bg-[#FA6404] px-6 py-2.5 text-[16px] h-[48px] font-semibold text-white shadow-md"
            >
              Get Early Access
            </button>
          </div>
        </header>

        <div className="pr-6 pl-4 lg:pr-8 lg:pl-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 lg:gap-x-28">
            <div className="pt-6 sm:pt-10 lg:col-span-6 lg:pt-40 lg:ml-4">
              <p className="mb-[25px] lg:text-2xl sm:text-xl text-[16px] font-semibold text-[#FA6404] text-center lg:text-left">
                Swipe right on your next coffee chat
              </p>

              <h1 className="text-[32px] sm:text-[36px] lg:text-[64px] leading-[1.2] font-bold tracking-[-0.02em] text-[#1F150F] text-center lg:text-left">
                The smarter, faster
                <br />
                way to network.
              </h1>

              {/* MOBILE: Subheading + Email */}
              <div className="mt-[50px] flex justify-center lg:hidden">
                <div className="relative w-full max-w-[92%] flex flex-col items-center gap-5">
                  <p className="text-[16px] leading-[24px] text-[#1F150F] text-center max-w-[400px]">
                    Connect with 20+ industry professionals every
                    <br />
                    month—in under 5 minutes, right from our app.
                  </p>

                  <div className="relative mt-[60px] w-full max-w-[500px]">
                    <form onSubmit={handleSubmitMobile}>
                      <div className="flex w-full shadow-md rounded-[16px] overflow-hidden">
                        <input
                          type="email"
                          placeholder="Enter your email address"
                          value={emailMobile}
                          onChange={(e) => setEmailMobile(e.target.value)}
                          required
                          className="lg:h-[56px] h-[48px] flex-1 min-w-0 bg-white px-4 text-[13px] sm:text-[15px] lg:text-[16px] text-[#111827] placeholder:text-[#9CA3AF] outline-none"
                        />
                        <button
                          type="submit"
                          disabled={loadingMobile}
                          className="lg:h-[56px] h-[48px] w-[35%] px-4 bg-[#FA6404] text-[13px] sm:text-[15px] lg:text-[16px] font-semibold text-white"
                        >
                          {loadingMobile ? "Submitting..." : "Get Early Access"}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Download buttons - Mobile */}
                  <div className="flex mt-8 gap-4 lg:hidden">
                    <Image
                      src="/google.png"
                      alt="Get it on Google Play"
                      width={135}
                      height={40}
                      className="cursor-pointer"
                    />
                    <Image
                      src="/apple.png"
                      alt="Download on the App Store"
                      width={135}
                      height={40}
                      className="cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* DESKTOP ONLY: Subheading + Email */}
              <div className="hidden lg:block">
                <p className="mt-[30px] text-[18px] leading-[24px] text-[#1F150F] w-full max-w-[750px]">
                  Connect with 20+ industry professionals every month—in under 5
                  minutes, right from our app.
                </p>
                <div className="relative mt-[60px] w-full max-w-[620px]">
                  <form onSubmit={handleSubmitDesktop}>
                    <div className="flex w-full shadow-md rounded-[16px] overflow-hidden">
                      <input
                        type="email"
                        placeholder="Enter your email address"
                        value={emailDesktop}
                        onChange={(e) => setEmailDesktop(e.target.value)}
                        required
                        className="lg:h-[56px] h-[48px] flex-1 min-w-0 bg-white px-4 text-[13px] sm:text-[15px] lg:text-[16px] text-[#111827] placeholder:text-[#9CA3AF] outline-none"
                      />
                      <button
                        type="submit"
                        disabled={loadingDesktop}
                        className="lg:h-[56px] h-[48px] w-[35%] px-4 bg-[#FA6404] text-[13px] sm:text-[15px] lg:text-[16px] font-semibold text-white"
                      >
                        {loadingDesktop ? "Submitting..." : "Get Early Access"}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Download buttons - Desktop only */}
                <div className="flex mt-8 gap-4">
                  <Image
                    src="/google.png"
                    alt="Get it on Google Play"
                    width={203.95}
                    height={59}
                    className="cursor-pointer"
                  />
                  <Image
                    src="/apple.png"
                    alt="Download on the App Store"
                    width={203.95}
                    height={59}
                    className="cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="relative lg:col-span-6 lg:translate-x-2">
              <div className="relative mt-20 sm:mt-10 lg:mt-0 h-[410px] sm:h-[468px] lg:h-[710px]">
                {/* Orange accent lines - positioned to match design */}
                {/* Orange accent lines - positioned to match design */}
                <div
                  className="absolute -top-8 right-10 lg:absolute lg:right-8 lg:top-12 w-32 h-20
                translate-x-12 lg:translate-x-0"
                >
                  {/* First line - longest, positioned highest */}
                  <div
                    className="absolute left-[50px] w-4 h-[3px] bg-[#FA6404] rounded-full transform rotate-[100deg]"
                    style={{
                      top: "4px",
                      right: "10px",
                    }}
                  ></div>

                  {/* Second line - medium length, middle position */}
                  <div
                    className="absolute left-[60px] w-8 h-[3px] bg-[#FA6404] rounded-full transform rotate-[125deg]"
                    style={{
                      top: "16px",
                      right: "16px",
                    }}
                  ></div>

                  {/* Third line - shortest, lowest position */}
                  <div
                    className="absolute w-4 h-[3px] bg-[#FA6404] rounded-full transform rotate-[160deg]"
                    style={{
                      top: "28px",
                      right: "24px",
                    }}
                  ></div>
                </div>

                {/* Phone */}
                <Image
                  src="/phone.png"
                  alt="App preview on iPhone"
                  width={430}
                  height={860}
                  sizes="(min-width:1024px) 430px, 320px"
                  className="absolute left-1/2 lg:fixed lg:left-[50%] lg:top-[90px] -translate-x-1/2 w-[280px] sm:w-[320px] lg:w-[430px] select-none object-contain"
                  priority
                />

                {/* Bubble Meeting — shifted 1rem to the left */}
                <div className="absolute left-[30%] top-[15%] -translate-x-1/2 w-[240px] h-[80px] sm:w-[250px] sm:h-[72px] lg:fixed lg:left-[calc(5%-1rem)] lg:top-[170px] lg:w-[361px] lg:h-[100px] lg:translate-x-0">
                  <Image
                    src="/bubble-meeting.png"
                    alt="Meeting with Briana"
                    width={361}
                    height={100}
                    sizes="(min-width:1024px) 361px, 250px"
                    className="h-full w-full rounded-[12px] object-contain"
                    priority
                  />
                </div>

                {/* Bubble Booked */}
                <div className="absolute left-[72%] bottom-[23%] -translate-x-1/2 w-[200px] h-[54px] sm:w-[230px] sm:h-[56px] lg:fixed lg:left-[55%] lg:bottom-[60px] lg:w-[296px] lg:h-[61px] lg:translate-x-0 rounded-[30px]">
                  <Image
                    src="/bubble-booked.png"
                    alt="Booked for next week"
                    width={296}
                    height={61}
                    sizes="(min-width:1024px) 296px, 230px"
                    className="h-full w-full object-contain"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FeatureCards */}
      </div>
      <div className="relative z-30 mt-8 sm:mt-10 lg:mt-0 lg:top-[-70px]">
        <div className="mx-auto max-w-[95%] lg:max-w-[90%] px-4 lg:px-6">
          <div className="rounded-[18px] bg-white">
            <div className="py-10 md:px-0 lg:px-2">
              <FeatureCards
                skipIcon="/skip.png"
                scheduleIcon="/schedule.png"
                monetizeIcon="/monetize.png"
              />
            </div>
          </div>
        </div>
      </div>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 sm:p-6">
          <div className="relative w-full max-w-full sm:max-w-lg lg:max-w-3xl rounded-xl bg-white p-6 sm:p-12 lg:p-18 shadow-xl">
            <h2 className="lg:mb-10 mb-4 text-2xl sm:text-4xl text-center lg:text-start sm:text-start lg:text-[64px] font-bold text-[#1F150F]">
              You&apos;re here early!
            </h2>
            <p className="lg:mb-14 mb-8 text-center lg:text-start sm:text-start text-base sm:text-lg lg:text-xl text-[#1F150F]">
              Want early access to Caffriend? Drop your email below, and
              you&apos;ll be the first to know when we launch. Big things are
              brewing!
            </p>
            <form onSubmit={handleSubmitMobile}>
              <div className="flex w-full shadow-md rounded-[12px] overflow-hidden">
                <input
                  type="email"
                  value={emailMobile}
                  onChange={(e) => setEmailMobile(e.target.value)}
                  placeholder="Enter your email address"
                  className="lg:h-[56px] h-[48px] flex-1 min-w-0 bg-white px-4 text-[13px] sm:text-[15px] lg:text-[16px] text-[#111827] placeholder:text-[#9CA3AF] outline-none"
                  required
                />
                <button
                  type="submit"
                  className="lg:h-[56px] h-[48px] w-[35%] px-4 bg-[#FA6404] text-[13px] sm:text-[15px] lg:text-[16px] font-semibold text-white"
                  disabled={loadingMobile}
                >
                  {loadingMobile ? "Submitting..." : "Get Early Access"}
                </button>
              </div>
            </form>

            <div className="text-center lg:mt-18 mt-10">
              <button
                onClick={() => setIsOpen(false)}
                className="text-[#B9B9B9] underline text-x"
              >
                I&apos;m okay, thanks anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
