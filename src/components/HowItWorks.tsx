// components/HowItWorks.tsx
import clsx from "clsx";

type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  videoSrc?: string;
  posterSrc?: string;
  youtubeUrl?: string; // 👈 now accepts full YouTube URL
  className?: string;
};

function extractYouTubeId(url: string): string | null {
  try {
    // Support both long and short YouTube URLs
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
  youtubeUrl, // 👈 use this now
  className,
}: Props) {
  const youtubeId = youtubeUrl ? extractYouTubeId(youtubeUrl) : null;

  return (
    <section
      id="how-it-works"
      className={clsx("bg-white pt-10 sm:pt-8 pb-16 lg:pb-28", className)}
    >
      <div className="mx-auto grid max-w-[95%] grid-cols-1 gap-y-10 px-6 lg:grid-cols-5 lg:items-center lg:gap-x-16 lg:px-8">
        <div className="lg:col-span-2">
          <p className="text-2xl font-semibold text-orange-600">{eyebrow}</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#1F150F] lg:text-5xl sm:text-4xl">
            {title}
          </h2>
          {description && (
            <p className="mt-5 text-base lg:text-2xl text-[#1F150F]">{description}</p>
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
