import type { Metadata } from "next";
import RoadmapClient from "./RoadmapClient";

export const metadata: Metadata = {
  title: "Your automation roadmap",
  robots: "noindex, nofollow",
};

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ id?: string; exp?: string; t?: string }>;
}

export default async function RoadmapPage({ searchParams }: Props) {
  const sp = await searchParams;
  return <RoadmapClient id={sp.id ?? ""} exp={sp.exp ?? ""} t={sp.t ?? ""} />;
}
