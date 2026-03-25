require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const mqtt = require("mqtt");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

const SlotState = require("./models/SlotState");
const SlotHistory = require("./models/SlotHistory");

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/smart_parking";
const MQTT_URL = process.env.MQTT_URL || "mqtt://127.0.0.1:1883";
const MQTT_TOPIC = process.env.MQTT_TOPIC || "parking/slots";

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

function normalizePayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload must be an object");
  }
  if (!payload.deviceId || !Array.isArray(payload.slots)) {
    throw new Error("Payload missing deviceId or slots");
  }

  const timestamp = payload.timestamp ? new Date(payload.timestamp * 1000) : new Date();
  const slots = payload.slots.map((slot) => ({
    id: String(slot.id),
    status: slot.status === "occupied" ? "occupied" : "empty"
  }));

  return {
    deviceId: String(payload.deviceId),
    slots,
    timestamp,
    rawPayload: payload
  };
}

app.get("/slots", async (_req, res) => {
  const docs = await SlotState.find({}).sort({ deviceId: 1 }).lean();
  res.json(docs);
});

app.get("/history", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const docs = await SlotHistory.find({})
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
  res.json(docs);
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

async function start() {
  await mongoose.connect(MONGO_URI);
  console.log("MongoDB connected");

  const mqttClient = mqtt.connect(MQTT_URL, {
    reconnectPeriod: 2000
  });

  mqttClient.on("connect", () => {
    console.log("MQTT connected");
    mqttClient.subscribe(MQTT_TOPIC, (error) => {
      if (error) {
        console.error("MQTT subscribe error:", error.message);
      } else {
        console.log(`Subscribed: ${MQTT_TOPIC}`);
      }
    });
  });

  mqttClient.on("reconnect", () => {
    console.log("MQTT reconnecting...");
  });

  mqttClient.on("message", async (topic, messageBuffer) => {
    if (topic !== MQTT_TOPIC) return;

    try {
      const payload = JSON.parse(messageBuffer.toString());
      const normalized = normalizePayload(payload);

      await SlotState.findOneAndUpdate(
        { deviceId: normalized.deviceId },
        {
          deviceId: normalized.deviceId,
          slots: normalized.slots,
          timestamp: normalized.timestamp
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const historyDoc = await SlotHistory.create(normalized);

      io.emit("slots:update", {
        deviceId: normalized.deviceId,
        slots: normalized.slots,
        timestamp: normalized.timestamp
      });

      console.log(`Saved MQTT payload at ${historyDoc.timestamp.toISOString()}`);
    } catch (error) {
      console.error("Invalid MQTT payload:", error.message);
    }
  });

  server.listen(PORT, () => {
    console.log(`Backend listening at http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error("Startup error:", error);
  process.exit(1);
});
