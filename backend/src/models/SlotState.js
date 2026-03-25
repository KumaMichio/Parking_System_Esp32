const mongoose = require("mongoose");

const SlotItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    status: { type: String, enum: ["empty", "occupied"], required: true }
  },
  { _id: false }
);

const SlotStateSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, unique: true, index: true },
    slots: { type: [SlotItemSchema], required: true },
    timestamp: { type: Date, required: true, index: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("SlotState", SlotStateSchema);
