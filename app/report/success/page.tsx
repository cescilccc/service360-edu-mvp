import Link from "next/link";

export const dynamic = "force-dynamic";

export default function SuccessPage({
  searchParams,
}: {
  searchParams: { ticket?: string };
}) {
  const ticket = searchParams.ticket ?? "";
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <div className="rounded-xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-600">
          ✓
        </div>
        <h1 className="mt-4 text-xl font-semibold">Report submitted</h1>
        <p className="mt-1 text-slate-600">Your ticket number is</p>
        <p className="mt-1 font-mono text-lg font-semibold">{ticket}</p>
        <p className="mt-3 text-sm text-slate-500">
          The AV support team has been notified and the SLA clock has started.
          An engineer will be assigned based on priority.
        </p>
        <Link
          href="/"
          className="mt-5 inline-block text-sm font-medium text-brand hover:underline"
        >
          Done
        </Link>
      </div>
    </main>
  );
}
