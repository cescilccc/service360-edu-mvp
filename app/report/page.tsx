import Link from "next/link";
import { resolveRoomByToken } from "@/lib/rooms";
import { ReportForm } from "./report-form";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  searchParams,
}: {
  searchParams: { room?: string };
}) {
  const token = searchParams.room ?? "";

  if (!token) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold">Scan a room QR code</h1>
        <p className="mt-2 text-slate-600">
          This page opens from a room&apos;s QR code. No room was specified.
        </p>
        <HomeLink />
      </Shell>
    );
  }

  let room = null;
  let lookupFailed = false;
  try {
    room = await resolveRoomByToken(token);
  } catch {
    lookupFailed = true;
  }

  if (lookupFailed) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold">Service temporarily unavailable</h1>
        <p className="mt-2 text-slate-600">
          We couldn&apos;t reach the service database. Please try again shortly.
        </p>
        <HomeLink />
      </Shell>
    );
  }

  if (!room) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold">Room not found</h1>
        <p className="mt-2 text-slate-600">
          The code <span className="font-mono">{token}</span> isn&apos;t
          recognised. Please check the QR or contact AV support.
        </p>
        <HomeLink />
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-xs font-semibold uppercase tracking-wide text-brand">
        Helios AV Support · Report an issue
      </p>
      <h1 className="mt-1 text-xl font-semibold">{room.name}</h1>
      <p className="text-sm text-slate-500">
        {room.siteName} ({room.siteCode})
        {room.floor ? ` · ${room.floor}` : ""}
      </p>
      <ReportForm roomToken={token} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        {children}
      </div>
    </main>
  );
}

function HomeLink() {
  return (
    <Link
      href="/"
      className="mt-4 inline-block text-sm font-medium text-brand hover:underline"
    >
      ← Back home
    </Link>
  );
}
