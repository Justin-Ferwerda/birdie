interface PagePlaceholderProps {
  title: string;
  blurb: string;
  phase: string;
}

export default function PagePlaceholder({ title, blurb, phase }: PagePlaceholderProps) {
  return (
    <section className="mx-auto flex max-w-md flex-col gap-3 px-5 py-10">
      <span className="self-start rounded-full bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-400">
        {phase}
      </span>
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="text-sm leading-relaxed text-slate-400">{blurb}</p>
    </section>
  );
}
