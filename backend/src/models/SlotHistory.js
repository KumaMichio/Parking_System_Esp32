const mongoose = require("mongoose");

const SlotItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    status: { type: String, enum: ["empty", "occupied"], required: true }
  },
  { _id: false }
);

const SlotHistorySchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, index: true },
    slots: { type: [SlotItemSchema], required: true },
    timestamp: { type: Date, required: true, index: true },
    rawPayload: { type: mongoose.Schema.Types.Mixed, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("SlotHistory", SlotHistorySchema);
