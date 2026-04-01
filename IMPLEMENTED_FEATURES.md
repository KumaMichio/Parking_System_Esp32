# Implemented Features Summary (Smart Parking ESP32 + MQTT + Node.js + React)

## Tong quan kien truc
He thong hoat dong theo chuoi:
`ESP32 -> MQTT -> Backend -> Socket.io -> Frontend`

Frontend cung co the lay du lieu ban dau qua REST API:
`Frontend -> REST API -> Backend`

## 1) ESP32 Firmware (`src/main.cpp`)
- Tu dong ket noi WiFi va tai ket noi khi mat mang.
- Ket noi MQTT va tai ket noi lien tuc khi bi ngat.
- Doc 2 cam bien HC-SR04 cho 2 slot `A1` va `A2`.
- So sanh khoang cach do voi nguong `OCCUPIED_DISTANCE_CM` de xac dinh:
  - `occupied` (co xe)
  - `empty` (trong)
- Bat/tat LED theo trang thai tung slot (co xe = LED ON, khong xe = LED OFF).
- Tao payload JSON theo dang:
  - `deviceId`
  - `timestamp` (Unix time)
  - `slots`: mang gom `[{ id, status }, ...]`
- Publish MQTT toi topic mac dinh `parking/slots` voi `retain=true` (broker giu ban tin moi nhat).
- Co che giam luong tin nhan:
  - Chi publish khi trang thai slot thay doi (trong `publishSlots(false)`).
- Co che heartbeat dinh ky:
  - Tu dong publish du lieu moi ky (`HEARTBEAT_MS`) de backend biet thiet bi van online.
- Dong bo thoi gian bang NTP (goi `configTime(...)`) de timestamp co y nghia thuc te.

## 2) MQTT Broker (Mosquitto) (`infra/`)
- Cung cap cau hinh Mosquitto de chay bang Docker Compose.
- Mo listener:
  - Port `1883` (MQTT)
  - Port `9001` (WebSocket cho MQTT)
- Cho phep truy cap khong can xac thuc (`allow_anonymous true`).

## 3) Backend Node.js (`backend/src/index.js`)
- Su dung Express:
  - `GET /slots`: tra ve trang thai hien tai (dau tien la data tinh theo `SlotState`).
  - `GET /history`: tra ve lich su tin nhan MQTT moi nhat (co `?limit=`).
  - `GET /health`: endpoint kiem tra nhanh trang thai server.
- Su dung Socket.io:
  - Phat realtime event `slots:update` khi backend nhan duoc tin MQTT va da luu vao MongoDB.
- Ket noi MQTT:
  - Dung `mqtt` client de connect den `MQTT_URL`.
  - Subscribe topic `MQTT_TOPIC` khi connect.
  - Khi nhan message:
    - Parse JSON
    - Validate `deviceId` va `slots[]`
    - Normalize `status` ve `empty/occupied`
    - Luu vao MongoDB 2 loai document: `SlotState` va `SlotHistory`

## 4) MongoDB Schema (Mongoose)
- `SlotState`
  - `deviceId` (unique, index)
  - `slots[]` voi `id` va `status` (`empty`/`occupied`)
  - `timestamp`
  - Dung `upsert` de cap nhat trang thai hien tai theo `deviceId`.
- `SlotHistory`
  - `deviceId`
  - `slots[]`
  - `timestamp`
  - `rawPayload` (luu payload goc, loai Mixed)
  - Duoc query theo `timestamp` giam dan de lay thong tin moi nhat.

## 5) Frontend React (`frontend/src/App.jsx`)
- Hien thi dashboard grid cac slot.
- Lay du lieu ban dau qua REST API:
  - `GET http://localhost:4000/slots`
- Nhận realtime realtime update qua Socket.io:
  - Lang nghe event `slots:update`
  - Cap nhat trang thai tung slot trong UI ngay khi nhan du lieu moi
- Render trang thai:
  - `occupied` hien thi mau/phan loai theo class CSS
  - `empty` hien thi mau/phan loai theo class CSS
- Hien thi thong tin tong quan:
  - Tong so slot, so luong `empty` va `occupied`
  - Trang thai ket noi Socket.io
  - Thoi gian cap nhat `lastUpdate`

## 6) Gia tri cau hinh mac dinh (co ban)
- MQTT topic: `parking/slots`
- Backend default:
  - `PORT=4000`
  - `MONGO_URI=mongodb://127.0.0.1:27017/smart_parking`
  - `MQTT_URL=mqtt://127.0.0.1:1883`
- Frontend default:
  - `API_BASE=http://localhost:4000`

## 7) Vi du payload MQTT
Payload duoc ESP32 publish (vi du):
```json
{
  "deviceId": "esp32_1",
  "timestamp": 1711024380,
  "slots": [
    { "id": "A1", "status": "occupied" },
    { "id": "A2", "status": "empty" }
  ]
}
```

