import type { Metadata } from "next";
import PortalClient from "./PortalClient";

export const metadata: Metadata = {
  title: "Client portal",
  robots: "noindex, nofollow",
};

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ id?: string; exp?: string; t?: string }>;
}

export default async function PortalPage({ searchParams }: Props) {
  const sp = await searchParams;
  return <PortalClient id={sp.id ?? ""} exp={sp.exp ?? ""} t={sp.t ?? ""} />;
}
