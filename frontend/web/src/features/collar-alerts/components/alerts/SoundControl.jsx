/**
 * Sound control for the critical alert alarm.
 *
 * Always available so the officer can turn the siren off; when the browser has
 * refused to start audio (no user gesture yet) the same control becomes the
 * "Enable sound" action that unlocks it.
 */
export default function SoundControl({ muted, blocked, supported, onToggleMuted, onEnableSound, className = '' }) {
  if (!supported) {
    return (
      <p className={`text-[11px] text-white/60 ${className}`}>
        Sound is not available in this browser — critical alerts are shown as a banner.
      </p>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {blocked && (
        <button
          type="button"
          onClick={onEnableSound}
          className="rounded border border-gold-400/70 bg-gold-500/20 px-2 py-1 text-[11px]
            font-semibold text-gold-200 hover:bg-gold-500/30"
        >
          Enable alert sound
        </button>
      )}
      <button
        type="button"
        onClick={onToggleMuted}
        aria-pressed={muted}
        title={muted ? 'Turn the critical alert alarm on' : 'Mute the critical alert alarm'}
        className="inline-flex items-center gap-1.5 rounded border border-white/30 bg-white/10 px-2 py-1
          text-[11px] font-semibold text-white transition-colors hover:bg-white/20"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          {muted ? (
            <path d="M4 9v6h4l5 4V5L8 9H4Zm12.6 3 2.7-2.7-1.4-1.4-2.7 2.7-2.7-2.7-1.4 1.4L13.8 12l-2.7 2.7 1.4 1.4 2.7-2.7 2.7 2.7 1.4-1.4L18.6 12Z" />
          ) : (
            <path d="M4 9v6h4l5 4V5L8 9H4Zm12.5 3a3.5 3.5 0 0 0-2-3.2v6.4a3.5 3.5 0 0 0 2-3.2Zm-2-7.6v2.1A5.5 5.5 0 0 1 19.5 12 5.5 5.5 0 0 1 14.5 17.9V20a7.5 7.5 0 0 0 7.5-7.5A7.5 7.5 0 0 0 14.5 4.4Z" />
          )}
        </svg>
        {muted ? 'Sound off' : 'Sound on'}
      </button>
    </div>
  );
}