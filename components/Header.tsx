import Link from "next/link";
import Image from "next/image";
import { tournamentName, season } from "@/lib/config";

export default function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-base/95 shadow-[0_4px_16px_rgba(0,0,0,0.35)] backdrop-blur">
      <div className="h-[2px] w-full bg-gradient-to-r from-accent via-accent2 to-accent" />
      <div className="mx-auto flex w-full max-w-lg items-center justify-between px-4 py-3 md:max-w-2xl lg:max-w-5xl lg:px-6 lg:py-4 xl:max-w-6xl">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/aksu-logo.png" alt="AKSU crest" width={44} height={44} className="crest-glow h-[38px] w-[38px] shrink-0 lg:h-11 lg:w-11" priority />
          <div className="flex flex-col leading-none">
            <span className="font-score text-[18px] font-extrabold uppercase tracking-wide text-white lg:text-[22px]">
              AKSU <span className="text-accent">Score</span>
            </span>
            <span className="text-[11.5px] font-semibold uppercase tracking-wide text-white lg:text-[13px]">{tournamentName}</span>
          </div>
        </Link>
        <span className="rounded-full border border-line bg-surface2 px-2.5 py-1 text-[11.5px] font-bold tracking-wide text-white lg:px-3 lg:py-1.5 lg:text-[13px]">
          {season}
        </span>
      </div>
    </header>
  );
}
