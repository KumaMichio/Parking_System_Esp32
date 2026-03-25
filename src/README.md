# Giai thich code trong `src/main.cpp`

Tai lieu nay mo ta code ESP32 hien tai dang lam gi trong du an he thong bai do xe.

## 1) Muc tieu cua chuong trinh

Chuong trinh tren ESP32 se:

- Doc du lieu khoang cach tu 2 cam bien sieu am (HC-SR04) cho 2 o xe `A1`, `A2`.
- Xac dinh trang thai tung o: `occupied` (co xe) hoac `empty` (trong).
- Bat/tat LED theo trang thai o xe.
- Gui trang thai len MQTT topic `parking/slots` duoi dang JSON.
- Tu dong reconnect WiFi va MQTT neu bi mat ket noi.

## 2) Cac thu vien duoc dung

- `Arduino.h`: ham co ban cua Arduino/ESP32.
- `WiFi.h`: ket noi WiFi cho ESP32.
- `PubSubClient.h`: giao tiep MQTT (publish message len broker).

## 3) Cau hinh quan trong

Trong dau file co nhom bien cau hinh:

- WiFi: `WIFI_SSID`, `WIFI_PASSWORD`.
- MQTT: `MQTT_BROKER`, `MQTT_PORT`, `MQTT_TOPIC`.
- Dinh danh thiet bi: `DEVICE_ID`.
- Chan phan cung cho 2 slot:
  - `A1`: `TRIG_PIN_1`, `ECHO_PIN_1`, `LED_PIN_1`
  - `A2`: `TRIG_PIN_2`, `ECHO_PIN_2`, `LED_PIN_2`
- Nguong xac dinh co xe: `OCCUPIED_DISTANCE_CM = 12.0`.
- Chu ky:
  - `SENSOR_READ_MS = 800` ms (tan suat doc cam bien)
  - `HEARTBEAT_MS = 30000` ms (gui dinh ky, ke ca khi khong doi)

## 4) Cau truc du lieu trong code

- `enum SlotStatus { EMPTY, OCCUPIED }`: trang thai o xe.
- `struct Slot`: luu thong tin tung o xe:
  - `id`, chan `trig/echo/led`
  - `distanceCm` (khoang cach vua do)
  - `status` (trang thai hien tai)
  - `lastPublishedStatus` (trang thai da gui lan cuoi)
- Mang `slots[]` dang khoi tao 2 slot: `A1`, `A2`.

## 5) Luong hoat dong chinh

### `setup()`

1. Khoi dong serial (`115200`) de log.
2. Goi `configTime(...)` de dong bo gio NTP (phuc vu timestamp).
3. Cau hinh pin cho tung slot:
   - `trig` la output
   - `echo` la input
   - `led` la output, mac dinh tat
4. Ket noi WiFi qua `connectWiFi()`.
5. Cau hinh MQTT server cho `mqttClient`.

### `loop()`

Vong lap chay lien tuc voi cac buoc:

1. Kiem tra WiFi, neu mat thi reconnect.
2. Kiem tra MQTT, neu mat thi reconnect.
3. Goi `mqttClient.loop()` de duy tri session MQTT.
4. Moi `SENSOR_READ_MS`:
   - Doc tung cam bien bang `readDistanceCm(...)`.
   - So sanh voi nguong `OCCUPIED_DISTANCE_CM` de gan `OCCUPIED/EMPTY`.
   - Dieu khien LED: co xe thi LED sang, khong co xe thi tat.
   - Goi `publishSlots(false)` de chi gui khi co thay doi trang thai.
5. Moi `HEARTBEAT_MS`:
   - Goi `publishSlots(true)` de gui heartbeat du lieu dinh ky.

## 6) Cach do khoang cach (`readDistanceCm`)

Ham nay tao xung cho chan `trig` va do do dai xung phan hoi tu chan `echo`:

- Timeout `pulseIn` la `30000` us (30 ms).
- Neu timeout (khong do duoc): tra `999.0` cm, coi nhu khong co xe.
- Cong thuc doi ra cm:
  - `distance = durationUs * 0.0343 / 2`

## 7) Dieu kien xac dinh co xe

Voi moi slot:

- Neu `distance <= 12.0 cm` => `occupied`.
- Neu `distance > 12.0 cm` => `empty`.

Gia tri nguong nay can can chinh theo vi tri lap cam bien thuc te.

## 8) Dinh dang JSON gui len MQTT

Ham `publishSlots(...)` tu tao JSON (khong dung thu vien JSON de giam phu thuoc), dang tong quat:

```json
{
  "deviceId": "esp32_1",
  "timestamp": 1710000000,
  "slots": [
    { "id": "A1", "status": "occupied" },
    { "id": "A2", "status": "empty" }
  ]
}
```

Ghi chu:

- `timestamp` lay tu `time(nullptr)` (Unix time).
- Publish voi cờ `retain = true`, nen broker giu ban tin moi nhat.
- Neu publish thanh cong, `lastPublishedStatus` duoc cap nhat.

## 9) Co che "chi gui khi thay doi" + heartbeat

Trong `publishSlots(false)`:

- Code se kiem tra xem co slot nao thay doi so voi lan gui truoc khong.
- Neu khong thay doi thi bo qua de giam luu luong.

Trong `publishSlots(true)`:

- Bo qua kiem tra thay doi va gui bat buoc (heartbeat), giup backend biet thiet bi van online.

## 10) Cac diem can luu y khi deploy

- Can thay thong tin that cho:
  - `WIFI_SSID`, `WIFI_PASSWORD`
  - `MQTT_BROKER` (IP/host broker trong mang)
- Kiem tra dung wiring pin `TRIG/ECHO/LED`.
- HC-SR04 thuong dung 5V, can dam bao muc logic cho ESP32 an toan.
- Neu timestamp luon sai (0 hoac lech), kiem tra ket noi Internet/NTP.

## 11) Tom tat ngan

`src/main.cpp` hien dang la firmware doc 2 cam bien cho bai do, quy doi thanh trang thai trong/co xe, hien thi bang LED, va dong bo trang thai len MQTT mot cach on dinh (co reconnect, co heartbeat, co co che giam ban tin trung lap).
