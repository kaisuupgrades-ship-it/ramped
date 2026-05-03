import Link from "next/link";
import { footerLinks, site } from "@/lib/site";

export function Footer() {
  return (
    <footer className="border-t border-line mt-24">
      <div className="max-w-[1180px] mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="w-8 h-8 object-contain" />
            <div>
              <div className="font-semibold text-text-0">{site.name}</div>
              <div className="text-text-3 text-[13px]">AI implementation for operating businesses.</div>
            </div>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 text-[13.5px] text-text-2">
            {footerLinks.map((l) => (
              <Link key={l.href} href={l.href as never} className="hover:text-text-0 transition-colors">{l.label}</Link>
            ))}
          </nav>
        </div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mt-8 pt-6 border-t border-line text-[12.5px] text-text-3">
          <span>© {site.copyrightYear} {site.name}. All rights reserved.</span>
          <a href={`mailto:${site.email}`} className="text-blue-2 hover:text-blue">{site.email}</a>
        </div>
      </div>
    </footer>
  );
}
