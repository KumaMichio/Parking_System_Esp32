import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

const API_BASE = "http://localhost:4000";
const socket = io(API_BASE, { transports: ["websocket", "polling"] });

function normalizeFromApi(docs) {
  const map = new Map();
  docs.forEach((doc) => {
    (doc.slots || []).forEach((slot) => {
      map.set(slot.id, {
        id: slot.id,
        status: slot.status,
        deviceId: doc.deviceId,
        timestamp: doc.timestamp
      });
    });
  });
  return Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id));
}

export default function App() {
  const [slots, setSlots] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    async function loadInitial() {
      const response = await fetch(`${API_BASE}/slots`);
      const docs = await response.json();
      const normalized = normalizeFromApi(docs);
      setSlots(normalized);
      setLastUpdate(new Date().toISOString());
    }

    loadInitial().catch((error) => {
      console.error("Initial load failed:", error);
    });
  }, []);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onSlotUpdate = (payload) => {
      setSlots((previous) => {
        const map = new Map(previous.map((item) => [item.id, item]));
        (payload.slots || []).forEach((slot) => {
          map.set(slot.id, {
            id: slot.id,
            status: slot.status,
            deviceId: payload.deviceId,
            timestamp: payload.timestamp
          });
        });
        return Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id));
      });
      setLastUpdate(payload.timestamp || new Date().toISOString());
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("slots:update", onSlotUpdate);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("slots:update", onSlotUpdate);
    };
  }, []);

  const summary = useMemo(() => {
    const occupied = slots.filter((s) => s.status === "occupied").length;
    const empty = slots.length - occupied;
    return { occupied, empty, total: slots.length };
  }, [slots]);

  return (
    <div className="container">
      <h1>Smart Parking Dashboard</h1>
      <div className="meta">
        <span>Socket: {connected ? "Connected" : "Disconnected"}</span>
        <span>
          Total: {summary.total} | Empty: {summary.empty} | Occupied: {summary.occupied}
        </span>
        <span>Last update: {lastUpdate ? new Date(lastUpdate).toLocaleString() : "-"}</span>
      </div>

      <div className="grid">
        {slots.map((slot) => (
          <div
            key={slot.id}
            className={`slot-card ${slot.status === "occupied" ? "occupied" : "empty"}`}
          >
            <h3>{slot.id}</h3>
            <p>Status: {slot.status}</p>
            <p className="device">Device: {slot.deviceId || "unknown"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
