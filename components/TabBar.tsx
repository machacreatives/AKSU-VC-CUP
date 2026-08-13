"use client";

export default function TabBar<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
}) {
  // Scrolls sideways on phones; once there is room it wraps instead, so no tab
  // is ever clipped mid-word.
  return (
    <div className="scroll-x flex gap-1.5 border-b border-line px-4 py-2 lg:flex-wrap lg:overflow-x-visible lg:px-6 lg:py-3">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[14px] font-bold uppercase tracking-wide transition-colors lg:px-4 lg:py-2 lg:text-[15px] ${
              isActive
                ? "border-accent bg-accent text-white shadow-[0_2px_10px_-2px_rgba(242,102,31,0.6)]"
                : "border-line bg-surface text-white hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
