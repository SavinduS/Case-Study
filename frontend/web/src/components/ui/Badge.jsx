const TONES = {
  critical: 'bg-alert-600 text-white',
  high: 'bg-alert-100 text-alert-600 border border-alert-600/30',
  medium: 'bg-gold-100 text-gold-500 border border-gold-500/30',
  low: 'bg-park-100 text-park-800 border border-park-700/20',
  neutral: 'bg-stone-100 text-stone-600 border border-stone-300'
};

const SIZES = {
  sm: 'text-[10px] px-2 py-0.5',
  md: 'text-xs px-2.5 py-1'
};

/** Small status/severity chip used across the queue and the alert modal. */
export default function Badge({ tone = 'neutral', size = 'md', className = '', children }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold uppercase tracking-wide
        ${TONES[tone]} ${SIZES[size]} ${className}`}
    >
      {children}
    </span>
  );
}