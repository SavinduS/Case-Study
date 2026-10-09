/**
 * Shown when a portal module belongs to a different use case in the
 * Group 033 design. Deliberately inert rather than fake: it names the
 * owning member so the boundary between the four implementations is
 * explicit during a demo.
 */
export default function ModulePlaceholder({ title, owner, useCaseName, description }) {
  return (
    <div className="grid h-full place-items-center bg-sand-100 p-8">
      <div className="w-full max-w-lg rounded-lg bg-white p-8 shadow-sm ring-1 ring-stone-200">
        <p className="text-[11px] font-bold uppercase tracking-widest text-moss-500">Not part of this use case</p>
        <h2 className="mt-2 text-2xl font-bold text-park-900">{title}</h2>

        <p className="mt-3 text-sm leading-relaxed text-stone-600">{description}</p>

        <dl className="mt-6 space-y-3 border-t border-stone-200 pt-5 text-sm">
          <div className="flex gap-3">
            <dt className="w-24 shrink-0 text-xs font-bold uppercase tracking-wide text-stone-500">Owner</dt>
            <dd className="font-semibold text-stone-800">{owner}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-24 shrink-0 text-xs font-bold uppercase tracking-wide text-stone-500">Use case</dt>
            <dd className="text-stone-800">{useCaseName}</dd>
          </div>
        </dl>

        <a
          href="/"
          className="mt-6 inline-flex rounded-md bg-park-800 px-4 py-2 text-sm font-semibold text-white hover:bg-park-700"
        >
          Back to Collar Boundary Alerts
        </a>
      </div>
    </div>
  );
}