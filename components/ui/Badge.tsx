interface Props {
  children: React.ReactNode;
  variant?: "status" | "priority" | "type";
}

// Saturated-on-dark: soft tinted fill + matching text + ring. Reads well on the
// dark violet-glass surfaces (the old bg-*-100 pastels looked washed out).
const STATUS_COLORS: Record<string, string> = {
  "done": "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  "closed": "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  "completed": "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  "in progress": "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  "to do": "bg-slate-500/15 text-slate-300 ring-slate-500/30",
  "open": "bg-slate-500/15 text-slate-300 ring-slate-500/30",
  "reopened": "bg-amber-500/15 text-amber-300 ring-amber-500/30",
};

const PRIORITY_COLORS: Record<string, string> = {
  "highest": "bg-red-500/15 text-red-300 ring-red-500/30",
  "high": "bg-orange-500/15 text-orange-300 ring-orange-500/30",
  "medium": "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  "low": "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  "lowest": "bg-slate-500/15 text-slate-400 ring-slate-500/30",
};

const DEFAULT = "bg-violet-500/15 text-violet-300 ring-violet-500/30";

export default function Badge({ children, variant = "type" }: Props) {
  const text = String(children).toLowerCase();
  let cls = DEFAULT;

  if (variant === "status") {
    cls = STATUS_COLORS[text] ?? "bg-slate-500/15 text-slate-300 ring-slate-500/30";
  } else if (variant === "priority") {
    cls = PRIORITY_COLORS[text] ?? "bg-slate-500/15 text-slate-400 ring-slate-500/30";
  }

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ring-1 ${cls}`}>
      {children}
    </span>
  );
}
