// components/FeatureCards.tsx
import Image from "next/image";

type Feature = {
  iconSrc: string;
  iconAlt: string;
  title: string;
  description: string;
};

type Props = {
  skipIcon: string; // e.g. "/icons/skip.png"
  scheduleIcon: string; // e.g. "/icons/schedule.png"
  monetizeIcon: string; // e.g. "/icons/monetize.png"
};

export default function FeatureCards({
  skipIcon,
  scheduleIcon,
  monetizeIcon,
}: Props) {
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
      title: "Monetize Your Time",
      description: "Premium users get paid for every coffee chat.",
    },
  ];

  return (
    <section className="w-full">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* 3-up grid */}
        <div className="grid grid-cols-1 gap-6 md:gap-8 lg:gap-10 md:grid-cols-3">
          {features.map((f) => (
            <article
              key={f.title}
              className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_1px_rgba(0,0,0,0.04)]"
            >
              <div className="p-8 lg:p-10 lg:pb-20">
                {/* Icon pill */}
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl ">
                  <Image
                    src={f.iconSrc}
                    alt={f.iconAlt}
                    width={96}
                    height={96}
                    priority
                  />
                </div>

                {/* Title */}
                <h3 className="text-[28px] leading-[1.1] tracking-[-0.02em] font-semibold text-gray-900">
                  {f.title}
                </h3>

                {/* Body */}
                <p className="mt-4 text-[17px] leading-7 text-gray-600">
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
