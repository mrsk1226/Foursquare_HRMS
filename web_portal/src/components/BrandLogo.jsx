import React from 'react';

const BRAND_VARIANTS = {
  blue: {
    shell: 'bg-white/80 border border-blue-100 shadow-[0_18px_45px_rgba(37,99,235,0.16)]',
    badge: 'bg-gradient-to-br from-sky-500 to-blue-700 text-white',
    eyebrow: 'text-sky-600',
    title: 'text-[#1a2744]',
    subtitle: 'text-slate-500',
  },
  white: {
    shell: 'bg-white/10 border border-white/12 backdrop-blur-xl',
    badge: 'bg-white text-[#1a2744]',
    eyebrow: 'text-blue-100/80',
    title: 'text-white',
    subtitle: 'text-slate-300',
  },
};

export default function BrandLogo({ variant = 'blue', compact = false, className = '' }) {
  const styles = BRAND_VARIANTS[variant] || BRAND_VARIANTS.blue;

  return (
    <div className={`inline-flex items-center gap-3 rounded-[24px] px-3 py-2 ${styles.shell} ${className}`.trim()}>
      <div className={`flex h-11 w-11 items-center justify-center rounded-[18px] text-sm font-black tracking-[0.2em] ${styles.badge}`}>
        FSQ
      </div>
      {!compact && (
        <div className="min-w-0">
          <p className={`text-[10px] font-semibold uppercase tracking-[0.28em] ${styles.eyebrow}`}>Portal</p>
          <p className={`text-lg font-black tracking-[0.12em] ${styles.title}`}>HRMS</p>
          <p className={`text-[10px] font-medium uppercase tracking-[0.2em] ${styles.subtitle}`}>Enterprise Suite</p>
        </div>
      )}
    </div>
  );
}
