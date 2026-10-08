export function Card({ title, action, children, className = '' }) {
  return (
    <section className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-100 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-stone-800">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
