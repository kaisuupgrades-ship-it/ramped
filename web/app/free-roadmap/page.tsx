import type { Metadata } from "next";
import { Card } from "@/components/ui/core";
import { Button } from "@/components/ui/Button";
import { FreeRoadmapForm } from "@/components/FreeRoadmapForm";

export const metadata: Metadata = {
  title: "Get your free 30-day AI roadmap",
  description: "A personalized 30-day AI deployment roadmap, scoped to your business. Free. No call required.",
  alternates: { canonical: "https://www.30dayramp.com/free-roadmap" },
};

export default function FreeRoadmapPage() {
  return (
    <>
      <section className="px-6 pt-16 pb-6">
        <div className="max-w-[1180px] mx-auto">
          <h1 className="text-[clamp(36px,5vw,56px)] tracking-tight font-bold leading-[1.06] m-0 max-w-3xl">
            Get your <span className="gradient-text">30-day AI roadmap.</span>
          </h1>
          <p className="mt-4 max-w-xl text-text-1 leading-relaxed">
            A personalized deployment plan — what to automate first, expected ROI, and the exact 30-day
            sequence — sent to your inbox within 24 hours. No sales call required.
          </p>
        </div>
      </section>

      <section className="px-6 pt-6 pb-24">
        <div className="max-w-[1180px] mx-auto grid lg:grid-cols-[1.1fr_1fr] gap-8 items-start">
          <FreeRoadmapForm />

          <aside className="flex flex-col gap-3.5 lg:sticky lg:top-[120px]">
            <Card className="p-7">
              <h3 className="m-0 mb-3 text-base font-semibold">What&apos;s in the roadmap</h3>
              <ul className="m-0 pl-5 text-[14px] text-text-1 leading-[1.65] space-y-1.5">
                <li>The <strong className="text-text-0">3 highest-leverage workflows</strong> to automate first, ranked by hours-saved-per-dollar</li>
                <li>An <strong className="text-text-0">integration map</strong> of your stack — what we&apos;d wire to what</li>
                <li>The <strong className="text-text-0">day-by-day 30-day plan</strong> we&apos;d run if you engaged us</li>
                <li>An <strong className="text-text-0">honest ROI estimate</strong> in dollars and hours</li>
                <li>What this would <strong className="text-text-0">cost on Starter vs Growth</strong></li>
              </ul>
            </Card>
            <div className="text-[13px] text-text-2 leading-[1.55] py-3.5 px-4 border-l-2 border-orange bg-orange/[0.06] rounded-r-lg">
              Want to skip the doc?{" "}
              <a href="/book" className="text-orange-2 font-semibold hover:underline">Book a 30-min call →</a>{" "}
              and we&apos;ll walk you through it live.
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
