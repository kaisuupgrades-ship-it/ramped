import type { Metadata } from "next";
import { Suspense } from "react";
import { QuestionnaireForm } from "@/components/QuestionnaireForm";

export const metadata: Metadata = {
  title: "Pre-call prep questionnaire",
  description: "Help us prep your discovery call. 11 short questions — takes about 5 minutes.",
  alternates: { canonical: "https://www.30dayramp.com/questionnaire" },
  robots: "noindex, nofollow",
};

export default function QuestionnairePage() {
  return (
    <>
      <section className="px-6 pt-12 pb-0">
        <div className="max-w-[720px] mx-auto">
          <h1 className="text-[clamp(32px,4.4vw,52px)] tracking-tight font-bold leading-[1.06] m-0">
            Help us <span className="gradient-text">prep your call.</span>
          </h1>
          <p className="mt-3.5 text-text-1 leading-relaxed">
            11 short questions. The more context we have, the more specific your roadmap will be when we hop on the call.
          </p>
        </div>
      </section>

      <section className="px-6 py-12">
        <div className="max-w-[720px] mx-auto">
          <Suspense fallback={<div className="text-text-3 text-center py-12">Loading…</div>}>
            <QuestionnaireForm />
          </Suspense>
        </div>
      </section>
    </>
  );
}
