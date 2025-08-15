// components/Hero.tsx
import Image from "next/image";
import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative isolate bg-gradient-to-br from-orange-50/30 via-white to-orange-50/20">
      {/* Top bar */}
      <div className="container mx-auto flex items-center justify-between py-6 px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Caffriend"
            width={32}
            height={32}
            priority
          />
          <span className="text-xl font-bold tracking-tight text-gray-900">
            Caffriend
          </span>
        </div>

        <div className="hidden md:flex items-center gap-8">
          <Link
            href="#contact"
            className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
          >
            Contact
          </Link>
          <Link
            href="#early-access"
            className="rounded-full bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 transition-colors"
          >
            Get Early Access
          </Link>
        </div>
      </div>

      {/* Hero section */}
      <div className="container mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center py-12 lg:py-20">
          {/* Left: copy + form */}
          <div className="max-w-2xl lg:pr-8 relative">
            <div className="flex items-center gap-2 mb-6">
              <p className="text-sm font-medium text-orange-600">
                Swipe right on your next coffee chat
              </p>
            </div>

            <h1 className="text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight text-gray-900 mb-6">
              The smarter, faster
              <br />
              way to network.
            </h1>

            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              Connect with 20+ industry professionals every month—in under 5
              minutes, right from our app.
            </p>

            {/* Email form */}
            <form id="early-access" className="mb-8">
              <div className="relative flex items-center bg-white rounded-full shadow-lg border border-gray-100 p-2 max-w-lg">
                <input
                  type="email"
                  name="email"
                  placeholder="Enter your email address"
                  className="flex-1 px-4 py-3 text-sm bg-transparent outline-none placeholder:text-gray-500"
                  required
                />
                <button
                  type="submit"
                  className="bg-orange-500 text-white px-6 py-3 rounded-full text-sm font-semibold hover:bg-orange-600 transition-colors shadow-sm whitespace-nowrap"
                >
                  Get Early Access
                </button>

                {/* Squiggle */}
                <Image
                  src="/squiggle.png"
                  alt=""
                  width={120}
                  height={72}
                  sizes="120px"
                  className="pointer-events-none hidden lg:block absolute -top-13 -right-40 w-[120px] h-auto"
                  priority
                />
              </div>
            </form>
          </div>

          {/* Right: phone mock with floating bubbles */}
          <div className="relative lg:ml-auto">
            <div className="relative w-full max-w-2xl mx-auto h-[620px] lg:h-[820px] flex items-center justify-center overflow-visible">
              <div className="relative">
                <Image
                  src="/phone.png"
                  alt="App preview on phone"
                  width={430}
                  height={860}
                  sizes="(min-width:1024px) 430px, 320px"
                  className="w-80 lg:w-[430px] h-auto drop-shadow-2xl"
                  priority
                  draggable={false}
                />

                <Image
                  src="/bubble-meeting.png"
                  alt="Meeting with Briana"
                  width={361}
                  height={100}
                  sizes="(min-width:1024px) 361px, 288px"
                  className="absolute top-18 -left-28 lg:top-20 lg:-left-36 w-72 lg:w-[361px] h-auto drop-shadow-xl z-20"
                  priority
                  draggable={false}
                />

                <Image
                  src="/bubble-booked.png"
                  alt="Booked for next week"
                  width={296}
                  height={61}
                  sizes="(min-width:1024px) 296px, 240px"
                  className="absolute -bottom-1 -right-12 lg:-bottom-1 lg:-right-16 w-60 lg:w-[296px] h-auto drop-shadow-xl z-20"
                  priority
                  draggable={false}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Feature cards - redesigned */}
        <div className="relative -mt-6 md:-mt-10 lg:-mt-16 pb-20 z-[5]">
          <div className="max-w-6xl mx-auto bg-white/80 backdrop-blur-sm rounded-3xl shadow-sm border border-gray-100 p-6 lg:p-8">
            <div className="grid md:grid-cols-3 gap-8">
              <FeatureCard
                icon="/hero/icon-skip.svg"
                title="Skip the cold DMs"
                copy="Swipe and match with real professionals who want to chat."
              />
              <FeatureCard
                icon="/hero/icon-auto.svg"
                title="Auto-schedule"
                copy="We find the time. Your invite appears in your calendar."
              />
              <FeatureCard
                icon="/hero/icon-monetize.svg"
                title="Monetize Your Time"
                copy="Premium users get paid for every coffee chat."
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon,
  title,
  copy,
}: {
  icon: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="bg-white text-left rounded-2xl p-8 lg:p-10 border border-gray-100 shadow-lg shadow-black/5">
      {/* Peach icon tile */}
      <div className="w-20 h-20 bg-orange-50 rounded-2xl border border-orange-100 flex items-center justify-center mb-8">
        <Image src={icon} alt="" width={40} height={40} sizes="40px" />
      </div>

      {/* Heading + copy */}
      <h3 className="text-3xl lg:text-4xl font-bold tracking-tight text-neutral-900 mb-4">
        {title}
      </h3>
      <p className="text-lg text-gray-600 leading-relaxed">{copy}</p>
    </div>
  );
}
