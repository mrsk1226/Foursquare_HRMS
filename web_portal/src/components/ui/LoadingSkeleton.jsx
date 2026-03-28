import React from 'react';
import { Inbox } from 'lucide-react';

export function SkeletonBlock({ className = '' }) {
  return <div className={`skeleton-block ${className}`.trim()} aria-hidden="true" />;
}

export function DashboardWidgetSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="glass-gpu rounded-[28px] border border-white/20 bg-white/10 p-5">
          <SkeletonBlock className="h-12 w-12 rounded-2xl" />
          <SkeletonBlock className="mt-5 h-5 w-2/3 rounded-full" />
          <SkeletonBlock className="mt-3 h-4 w-5/6 rounded-full" />
          <SkeletonBlock className="mt-2 h-4 w-1/2 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function StatsWidgetSkeleton({ rows = 3 }) {
  return (
    <div className="space-y-5">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="rounded-[24px] border border-slate-100 bg-slate-50/80 p-4">
          <div className="flex items-center justify-between">
            <div className="w-full max-w-[70%]">
              <SkeletonBlock className="h-4 w-1/2 rounded-full" />
              <SkeletonBlock className="mt-2 h-3 w-2/3 rounded-full" />
            </div>
            <SkeletonBlock className="h-5 w-12 rounded-full" />
          </div>
          <SkeletonBlock className="mt-4 h-3 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ columns = 4, rows = 6 }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
      <div className="grid gap-0 border-b border-slate-100 bg-slate-50 p-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }).map((_, index) => (
          <SkeletonBlock key={index} className="mx-2 h-3 rounded-full" />
        ))}
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="grid p-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {Array.from({ length: columns }).map((__, colIndex) => (
              <SkeletonBlock key={`${rowIndex}-${colIndex}`} className="mx-2 h-4 rounded-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ListSkeleton({ items = 4 }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="rounded-3xl border border-slate-100 bg-white px-5 py-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="w-full max-w-lg">
              <SkeletonBlock className="h-5 w-2/3 rounded-full" />
              <SkeletonBlock className="mt-2 h-4 w-1/3 rounded-full" />
              <SkeletonBlock className="mt-2 h-4 w-1/2 rounded-full" />
            </div>
            <div className="w-28">
              <SkeletonBlock className="ml-auto h-3 w-16 rounded-full" />
              <SkeletonBlock className="mt-2 ml-auto h-4 w-20 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyStatePanel({
  icon: Icon = Inbox,
  title = 'Nothing to show yet',
  description = 'Content will appear here once data is available.',
  className = '',
  iconClassName = '',
  titleClassName = '',
  descriptionClassName = '',
}) {
  const ResolvedIcon = Icon;

  return (
    <div className={`relative overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/90 px-6 py-10 text-center shadow-sm ${className}`.trim()}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_42%)]" />
      <div className={`relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-[0_16px_35px_rgba(15,23,42,0.18)] ${iconClassName}`.trim()}>
        <ResolvedIcon size={28} />
      </div>
      <h3 className={`relative mt-5 text-lg font-black text-slate-900 ${titleClassName}`.trim()}>
        {title}
      </h3>
      <p className={`relative mt-2 text-sm leading-6 text-slate-500 ${descriptionClassName}`.trim()}>
        {description}
      </p>
      <div className="relative mx-auto mt-6 h-2 w-28 overflow-hidden rounded-full bg-slate-200/80">
        <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-sky-500 to-cyan-400" />
      </div>
    </div>
  );
}
