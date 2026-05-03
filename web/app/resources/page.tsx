import type { Metadata } from "next";
import { ResourcesClient } from "@/components/ResourcesClient";

export const metadata: Metadata = {
  title: "Resources",
  description: "AI ops news, deployment notes, and field-tested writeups for operators.",
  alternates: { canonical: "https://www.30dayramp.com/resources" },
};

export default function ResourcesPage() {
  return (
    <>
      <section className="px-6 pt-16 pb-8">
        <div className="max-w-[1180px] mx-auto">
          <h1 className="text-[clamp(36px,5vw,60px)] tracking-tight font-bold leading-[1.06] m-0 max-w-3xl">
            What we&apos;re <span className="gradient-text">reading.</span>
          </h1>
          <p className="mt-5 max-w-xl text-text-1 leading-relaxed">
            AI ops news, deployment notes, and field-tested writeups for operators. Pulled from the same feeds
            we use internally — no listicles, no hype.
          </p>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="max-w-[1180px] mx-auto">
          <ResourcesClient />
        </div>
      </section>
    </>
  );
}
