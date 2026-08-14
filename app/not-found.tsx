import Link from "next/link";

// Any URL that matches no route. Previously this was Next's built-in page: a
// white screen with "404" on it, outside the site's own shell.
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center lg:py-24">
      <p className="font-score text-[52px] font-extrabold leading-none text-accent lg:text-[64px]">
        404
      </p>
      <h1 className="mt-3 text-[20px] font-extrabold text-white lg:text-[24px]">Page not found</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-white/70 lg:text-[15px]">
        That page does not exist. It may have been moved, or the link that brought you here is out of
        date.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-[8px] bg-accent px-4 py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-accent/90"
      >
        Back to AKSU Score
      </Link>
    </div>
  );
}
