import type { Metadata } from "next";
import { ResourcesClient } from "@/components/ResourcesClient";

export const metadata: Metadata = {
  title: "Resources",
  description: "AI ops news, deployment notes, and field-tested writeups for operators.",
  alternates: { canonical: "https://www.30dayramp.com/resources" },
  openGraph: {
    type: "website",
    title: "Resources — Ramped AI",
    description: "AI ops news, deployment notes, and field-tested writeups for operators.",
    url: "https://www.30dayramp.com/resources",
    images: ["/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Resources — Ramped AI",
    description: "AI ops news, deployment notes, and field-tested writeups for operators.",
    images: ["/og-image.png"],
  },
};

const resourcesJsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Ramped AI Resources",
    description: "AI ops news, deployment notes, and field-tested writeups for operators.",
    url: "https://www.30dayramp.com/resources",
    isPartOf: { "@type": "WebSite", name: "Ramped AI", url: "https://www.30dayramp.com" },
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://www.30dayramp.com/" },
      { "@type": "ListItem", position: 2, name: "Resources", item: "https://www.30dayramp.com/resources" },
    ],
  },
];

export default function ResourcesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(resourcesJsonLd) }}
      />
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
