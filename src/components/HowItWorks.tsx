// components/HowItWorks.tsx
import clsx from "clsx";

type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  // Use ONE of these:
  videoSrc?: string; // e.g. "/how/video.mp4"
  posterSrc?: string; // optional poster for local video
  youtubeId?: string; // e.g. "dQw4w9WgXcQ"
  className?: string;
};

export default function HowItWorks({
  eyebrow = "How It Works",
  title,
  description,
  videoSrc,
  posterSrc,
  youtubeId,
  className,
}: Props) {
  return (
    <section id="how-it-works" className={clsx("py-16 lg:py-24", className)}>
      <div className="container mx-auto grid items-center gap-10 px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
        {/* Left: copy */}
        <div>
          <p className="text-sm font-semibold text-orange-600">{eyebrow}</p>

          <h2 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            {title}
          </h2>

          {description ? (
            <p className="mt-5 max-w-prose text-neutral-600">{description}</p>
          ) : null}
        </div>

        {/* Right: video */}
        <div className="relative">
          {/* Wrapper ensures 16:9 and rounded box */}
          <div className="aspect-video w-full overflow-hidden rounded-2xl shadow ring-1 ring-black/10 bg-black">
            {/* YouTube embed */}
            {youtubeId ? (
              <iframe
                className="h-full w-full"
                src={`https://www.youtube.com/embed/${youtubeId}?rel=0`}
                title="How It Works"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : videoSrc ? (
              // Local file
              <video
                className="h-full w-full"
                controls
                playsInline
                poster={posterSrc}
              >
                <source src={videoSrc} type="video/mp4" />
                {/* Add a webm if you have it for better compression */}
                {/* <source src="/how/video.webm" type="video/webm" /> */}
                Your browser does not support the video tag.
              </video>
            ) : (
              // Fallback if neither provided
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
