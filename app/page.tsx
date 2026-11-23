import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-4 py-16">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">
          Helios AV Support · Academic Demo
        </p>
        <h1 className="mt-1 text-3xl font-bold">Service360</h1>
        <p className="mt-3 text-slate-600">
          Scan a room QR to report an AV issue. AI triages it instantly and
          starts the SLA clock. This is an academic demo built on fictional
          demonstration data.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/report?room=gx-summit-boardroom"
          className="rounded-lg bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark"
        >
          Demo: report an issue
        </Link>
        <Link
          href="/dashboard"
          className="rounded-lg border border-slate-300 px-4 py-2 font-medium hover:bg-slate-100"
        >
          Coordinator dashboard
        </Link>
      </div>
      <p className="text-xs text-slate-400">
        Demo rooms: gx-summit-boardroom, gx-horizon-training, gx-aspen-meeting
      </p>
    </main>
  );
}
