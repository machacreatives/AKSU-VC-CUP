import Link from "next/link";
import Image from "next/image";
import { tournamentName, season } from "@/lib/mock-data";

export default function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-base/95 shadow-[0_4px_16px_rgba(0,0,0,0.35)] backdrop-blur">
      <div className="h-[2px] w-full bg-gradient-to-r from-accent via-accent2 to-accent" />
      <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/aksu-logo.png" alt="AKSU crest" width={38} height={38} className="crest-glow shrink-0" priority />
          <div className="flex flex-col leading-none">
            <span className="font-score text-[18px] font-extrabold uppercase tracking-wide text-white">
              AKSU <span className="text-accent">Score</span>
            </span>
            <span className="text-[11.5px] font-semibold uppercase tracking-wide text-white">{tournamentName}</span>
          </div>
        </Link>
        <span className="rounded-full border border-line bg-surface2 px-2.5 py-1 text-[11.5px] font-bold tracking-wide text-white">
          {season}
        </span>
      </div>
    </header>
  );
}
