"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase-browser";
import { PRIORITIES, STATUSES } from "@/lib/enums";

interface TicketDTO {
  id: string;
  ticketNumber: string;
  roomName: string;
  issueType: string;
  priority: string;
  aiSuggestedPriority: string | null;
  status: string;
  likelyCause: string | null;
  recurring: boolean;
  createdAt: string;
  slaState: "ON_TRACK" | "AT_RISK" | "BREACHED";
}

const STATE_BADGE: Record<string, string> = {
  BREACHED: "bg-red-100 text-red-700",
  AT_RISK: "bg-amber-100 text-amber-700",
  ON_TRACK: "bg-emerald-100 text-emerald-700",
};

export default function Dashboard() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [tickets, setTickets] = useState<TicketDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (accessToken: string) => {
    const res = await fetch("/api/tickets", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const data = (await res.json()) as { tickets: TicketDTO[] };
      setTickets(data.tickets);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await getBrowserClient().auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      setToken(session.access_token);
      await load(session.access_token);
    })();
  }, [router, load]);

  async function patch(id: string, body: Record<string, string>) {
    if (!token) return;
    await fetch(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    await load(token);
  }

  const counts = {
    BREACHED: tickets.filter((t) => t.slaState === "BREACHED").length,
    AT_RISK: tickets.filter((t) => t.slaState === "AT_RISK").length,
    ON_TRACK: tickets.filter((t) => t.slaState === "ON_TRACK").length,
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Coordinator dashboard</h1>
        <button
          onClick={async () => {
            await getBrowserClient().auth.signOut();
            router.push("/login");
          }}
          className="text-sm text-slate-500 hover:underline"
        >
          Sign out
        </button>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Board label="Breached" value={counts.BREACHED} tone="red" />
        <Board label="At risk" value={counts.AT_RISK} tone="amber" />
        <Board label="On track" value={counts.ON_TRACK} tone="emerald" />
      </div>

      {loading ? (
        <p className="mt-8 text-slate-500">Loading tickets…</p>
      ) : tickets.length === 0 ? (
        <p className="mt-8 text-slate-500">No tickets yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl ring-1 ring-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left text-slate-600">
              <tr>
                <th className="p-3">Ticket</th>
                <th className="p-3">Room</th>
                <th className="p-3">Issue</th>
                <th className="p-3">SLA</th>
                <th className="p-3">Priority</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-t border-slate-100 align-top">
                  <td className="p-3 font-mono text-xs">{t.ticketNumber}</td>
                  <td className="p-3">{t.roomName}</td>
                  <td className="p-3">
                    <div>{t.issueType}</div>
                    {t.likelyCause && (
                      <div className="text-xs text-slate-400">
                        {t.likelyCause}
                      </div>
                    )}
                    {t.recurring && (
                      <span className="mt-1 inline-block rounded bg-purple-100 px-1.5 text-xs text-purple-700">
                        recurring
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${STATE_BADGE[t.slaState]}`}
                    >
                      {t.slaState}
                    </span>
                  </td>
                  <td className="p-3">
                    <select
                      value={t.priority}
                      onChange={(e) => patch(t.id, { priority: e.target.value })}
                      className="rounded border border-slate-300 p-1 text-xs"
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                    {t.aiSuggestedPriority === t.priority && (
                      <div className="text-[10px] text-brand">AI suggested</div>
                    )}
                  </td>
                  <td className="p-3">
                    <select
                      value={t.status}
                      onChange={(e) => patch(t.id, { status: e.target.value })}
                      className="rounded border border-slate-300 p-1 text-xs"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function Board({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "red" | "amber" | "emerald";
}) {
  const tones = {
    red: "bg-red-50 text-red-700 ring-red-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  };
  return (
    <div className={`rounded-xl p-4 ring-1 ${tones[tone]}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm">{label}</div>
    </div>
  );
}
