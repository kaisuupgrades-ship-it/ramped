import type { Metadata } from "next";
import { BookingForm } from "@/components/BookingForm";

export const metadata: Metadata = {
  title: "Book a discovery call",
  description: "30-minute discovery call. We'll map your highest-leverage automation, scope a deployment plan, and show you the exact ROI math — free, no commitment.",
  alternates: { canonical: "https://www.30dayramp.com/book" },
};

interface Props {
  searchParams: Promise<{ tier?: string; billing?: string }>;
}

export default async function BookPage({ searchParams }: Props) {
  const sp = await searchParams;
  const tier = (["starter", "growth", "enterprise"] as const).find((t) => t === sp.tier);
  const billing = (["monthly", "annual"] as const).find((b) => b === sp.billing);

  return (
    <>
      <section className="px-6 pt-16 pb-6">
        <div className="max-w-[1180px] mx-auto">
          <h1 className="text-[clamp(36px,5vw,56px)] tracking-tight font-bold leading-[1.06] m-0 max-w-3xl">
            Book a call. We&apos;ll map the wins{" "}
            <span className="gradient-text">in 30 minutes.</span>
          </h1>
          <p className="mt-4 max-w-xl text-text-1 leading-relaxed">
            Pick a time, share a few details, and we&apos;ll prep an automation map for your stack before we get on the call.
          </p>
        </div>
      </section>

      <section className="px-6 pt-6 pb-24">
        <div className="max-w-[1180px] mx-auto">
          <BookingForm tier={tier} billing={billing} />
        </div>
      </section>
    </>
  );
}
