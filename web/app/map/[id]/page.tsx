import type { Metadata } from "next";
import MapClient from "./MapClient";

export const metadata: Metadata = {
  title: "Your automation map",
  robots: "noindex, nofollow",
};

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ exp?: string; t?: string }>;
}

export default async function MapResultPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  return <MapClient id={id} exp={sp.exp ?? ""} t={sp.t ?? ""} />;
}
