// components/HowItWorks.tsx
import clsx from "clsx";

type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  videoSrc?: string;
  posterSrc?: string;
  youtubeUrl?: string; // accepts full YouTube URL
  className?: string;
};

function extractYouTubeId(url: string): string | null {
  try {
    const regExp = /^.*(?:youtu\.be\/|v=|\/embed\/)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[1].length === 11 ? match[1] : null;
  } catch {
    return null;
  }
}

export default function HowItWorks({
  eyebrow = "How it works",
  title,
  description,
  videoSrc,
  posterSrc,
  youtubeUrl,
  className,
}: Props) {
  const youtubeId = youtubeUrl ? extractYouTubeId(youtubeUrl) : null;

  return (
    <section
      id="how-it-works"
      className={clsx(
        // tighter vertical rhythm
        "bg-white pt-8 pb-16 lg:py-20",
        className
      )}
    >
      <div
        className={clsx(
          "mx-auto grid max-w-[95%] grid-cols-1 gap-y-8 px-6",
          // slightly smaller column gap so layout feels more “crammed”
          "lg:grid-cols-5 lg:gap-x-16 lg:px-8"
        )}
      >
        <div className="lg:col-span-2 max-w-[560px]">
          {/* smaller eyebrow */}
          <p className="text-base mb-3 font-semibold text-[#FA6404]">
            {eyebrow}
          </p>

          {/* smaller headline + snug line-height */}
          <h2 className="mt-1 font-extrabold tracking-tight text-[#1F150F] leading-snug text-2xl sm:text-3xl lg:text-4xl">
            {title}
          </h2>

          {/* body copy reduced one step */}
          {description && (
            <p className="mt-6 text-[#1F150F] text-base lg:text-lg">
              {description}
            </p>
          )}
        </div>

        {/* Video */}
        <div className="lg:col-span-3">
          <div className="aspect-video w-full overflow-hidden rounded-xl bg-black shadow ring-1 ring-black/10">
            {youtubeId ? (
              <iframe
                className="h-full w-full"
                src={`https://www.youtube.com/embed/${youtubeId}?rel=0`}
                title="How It Works"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : videoSrc ? (
              <video
                className="h-full w-full"
                controls
                playsInline
                poster={posterSrc}
              >
                <source src={videoSrc} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            ) : (
              <div className="flex h-full w-full items-center justify-center text-white/70">
                No video source provided
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
