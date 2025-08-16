// app/page.tsx
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import FooterCta from "@/components/Footer";

export default function Page() {
  return (
    <main>
      <Hero />
      <HowItWorks
        title="See How You Can Land 20+ Coffee Chats a Month"
        description="Get an inside look at how Caffriend works, the insights behind its design, and how it helps you build meaningful career connections—fast."
        youtubeUrl="https://www.youtube.com/watch?v=MltlpUeMtRc&t=26s"
        posterSrc="/how/poster.jpg"
      />
      <FooterCta />
    </main>
  );
}
