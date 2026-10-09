const VARIANTS = {
  primary: 'bg-alert-600 text-white hover:bg-alert-500 focus-visible:outline-alert-600',
  outline: 'bg-white text-park-800 border border-stone-300 hover:bg-stone-50 focus-visible:outline-park-700',
  ghost: 'bg-transparent text-park-800 hover:bg-park-50 focus-visible:outline-park-700',
  dark: 'bg-park-800 text-white hover:bg-park-700 focus-visible:outline-park-800'
};

const SIZES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-3 text-base'
};

/**
 * Shared action button. `outline` and `primary` map to the two
 * response actions on the critical alert modal.
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  children,
  ...rest
}) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-semibold
        transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
        disabled:cursor-not-allowed disabled:opacity-50
        ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}