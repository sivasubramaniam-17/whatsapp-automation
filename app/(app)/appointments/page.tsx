"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/appointments").then((d) => setAppointments(d.appointments)).catch((e) => setError(e.message));
  }, []);

  const now = Date.now();

  return (
    <div>
      <div className="page-head"><h1>Appointments</h1></div>
      <p className="muted">Site visits booked automatically by the chatbot.</p>
      {error && <div className="error">{error}</div>}
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>When</th><th>Contact</th><th>Phone</th><th>Status</th></tr></thead>
          <tbody>
            {appointments.map((a) => (
              <tr key={a.id}>
                <td>{new Date(a.slotStart).toLocaleString()}</td>
                <td>{a.contact?.name || "—"}</td>
                <td className="muted">{a.contact?.waPhone}</td>
                <td>
                  <span className={`pill ${new Date(a.slotStart).getTime() > now ? "green" : ""}`}>
                    {new Date(a.slotStart).getTime() > now ? "upcoming" : a.status}
                  </span>
                </td>
              </tr>
            ))}
            {appointments.length === 0 && <tr><td colSpan={4} className="muted">No appointments booked yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
