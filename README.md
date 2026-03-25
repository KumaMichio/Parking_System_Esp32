# Smart Parking IoT (ESP32 + MQTT + Node.js + React)

He thong gom 4 thanh phan:
- ESP32 doc cam bien HC-SR04 theo tung slot
- Mosquitto MQTT broker nhan du lieu
- Backend Node.js luu MongoDB + phat realtime qua Socket.io
- Frontend React hien thi grid trang thai slot

## 1) Kien truc ket noi

`ESP32 -> MQTT -> Backend -> Socket.io -> Frontend`  
`Frontend -> REST API -> Backend`

## 2) ESP32 firmware

File firmware: `src/main.cpp`  
Config PlatformIO: `platformio.ini`

### Thu vien su dung
- `WiFi.h`
- `PubSubClient.h`

### Chuc nang da co
- Ket noi WiFi, tu reconnect khi mat mang
- Ket noi MQTT, reconnect lien tuc neu mat ket noi
- Doc nhieu cam bien HC-SR04 (mau co 2 slot: A1, A2)
- Xac dinh `empty` / `occupied` theo nguong khoang cach
- Dieu khien LED theo trang thai slot
- Publish MQTT JSON topic `parking/slots`
- Chi publish khi trang thai thay doi (bonus)
- Co heartbeat dinh ky va `timestamp` (bonus)

### JSON du lieu publish
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

### Config can sua trong firmware
Sua cac gia tri trong `src/main.cpp`:
- `WIFI_SSID`, `WIFI_PASSWORD`
- `MQTT_BROKER`, `MQTT_PORT`
- Pin `TRIG/ECHO/LED` theo thuc te dau noi
- `OCCUPIED_DISTANCE_CM` (nguong phat hien xe)

### Nap firmware
```bash
pio run -t upload
pio device monitor
```

## 3) MQTT broker (Mosquitto)

Da co file:
- `infra/docker-compose.yml`
- `infra/mosquitto.conf`

### Chay broker bang Docker
```bash
cd infra
docker compose up -d
```

### Kiem tra nhanh topic
Neu may co cai mosquitto client:
```bash
mosquitto_sub -h localhost -p 1883 -t parking/slots -v
```

## 4) Backend Node.js

Thu muc: `backend/`

### Cong nghe
- Express
- MQTT (`mqtt`)
- Socket.io
- MongoDB (`mongoose`)

### API
- `GET /slots` -> trang thai hien tai
- `GET /history` -> lich su ban tin (ho tro `?limit=100`)
- `GET /health` -> kiem tra server

### MongoDB schema
- `SlotState`: luu trang thai hien tai theo `deviceId`
- `SlotHistory`: luu lich su toan bo message MQTT

### Chay backend
1. Tao file env:
```bash
cd backend
copy .env.example .env
```
2. Cai dependency:
```bash
npm install
```
3. Chay server:
```bash
npm run dev
```

Mac dinh backend chay `http://localhost:4000`.

## 5) Frontend React

Thu muc: `frontend/`

### Tinh nang
- Hien thi slot theo dang grid
- Mau xanh = `empty`, mau do = `occupied`
- Goi API `GET /slots` de lay data ban dau
- Nhan realtime qua Socket.io event `slots:update`

### Chay frontend
```bash
cd frontend
npm install
npm run dev
```

Mo trinh duyet: `http://localhost:5173`

## 6) Trinh tu chay he thong

1. Chay MongoDB (local hoac Docker)
2. Chay Mosquitto broker (`infra/docker-compose.yml`)
3. Chay backend Node.js (`backend/`)
4. Chay frontend React (`frontend/`)
5. Nap firmware ESP32 va mo serial monitor de debug

## 7) Luu y trien khai

- Neu backend/MQTT khong chay tren may local, sua lai:
  - ESP32 `MQTT_BROKER`
  - Backend `.env` (`MQTT_URL`, `MONGO_URI`)
- Co the mo rong so slot bang cach them phan tu vao mang `slots[]` trong firmware.