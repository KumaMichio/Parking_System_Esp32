#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>

// -------------------- User Config --------------------
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

const char* MQTT_BROKER = "192.168.1.10";
const uint16_t MQTT_PORT = 1883;
const char* MQTT_TOPIC = "parking/slots";
const char* DEVICE_ID = "esp32_1";

// Change these pins to match your wiring.
// Slot A1
const int TRIG_PIN_1 = 5;
const int ECHO_PIN_1 = 18;
const int LED_PIN_1 = 23;
// Slot A2
const int TRIG_PIN_2 = 19;
const int ECHO_PIN_2 = 21;
const int LED_PIN_2 = 22;

// Car is considered present if measured distance <= threshold (cm).
const float OCCUPIED_DISTANCE_CM = 12.0f;

// Publish interval to report heartbeat even when unchanged.
const unsigned long HEARTBEAT_MS = 30000;
const unsigned long SENSOR_READ_MS = 800;
// -----------------------------------------------------

enum SlotStatus {
  EMPTY = 0,
  OCCUPIED = 1
};

struct Slot {
  const char* id;
  int trigPin;
  int echoPin;
  int ledPin;
  float distanceCm;
  SlotStatus status;
  SlotStatus lastPublishedStatus;
};

Slot slots[] = {
  {"A1", TRIG_PIN_1, ECHO_PIN_1, LED_PIN_1, 0.0f, EMPTY, EMPTY},
  {"A2", TRIG_PIN_2, ECHO_PIN_2, LED_PIN_2, 0.0f, EMPTY, EMPTY}
};

const size_t SLOT_COUNT = sizeof(slots) / sizeof(slots[0]);

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

unsigned long lastSensorReadAt = 0;
unsigned long lastHeartbeatAt = 0;

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  Serial.print("Connecting WiFi");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.print("WiFi connected, IP: ");
  Serial.println(WiFi.localIP());
}

void reconnectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("Connecting MQTT...");
    if (mqttClient.connect(DEVICE_ID)) {
      Serial.println("connected");
    } else {
      Serial.print("failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(", retry in 2s");
      delay(2000);
    }
  }
}

// Read one HC-SR04 sensor and return distance in cm.
float readDistanceCm(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);

  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  long durationUs = pulseIn(echoPin, HIGH, 30000); // 30ms timeout
  if (durationUs <= 0) {
    return 999.0f; // Treat timeout as far away => empty
  }

  return (durationUs * 0.0343f) / 2.0f;
}

const char* statusToText(SlotStatus status) {
  return status == OCCUPIED ? "occupied" : "empty";
}

void publishSlots(bool forcePublish) {
  bool changed = false;
  for (size_t i = 0; i < SLOT_COUNT; i++) {
    if (slots[i].status != slots[i].lastPublishedStatus) {
      changed = true;
      break;
    }
  }

  if (!forcePublish && !changed) {
    return;
  }

  // Build JSON manually to avoid extra JSON library dependency.
  String payload = "{";
  payload += "\"deviceId\":\"";
  payload += DEVICE_ID;
  payload += "\",\"timestamp\":";
  payload += String((unsigned long)time(nullptr));
  payload += ",\"slots\":[";

  for (size_t i = 0; i < SLOT_COUNT; i++) {
    payload += "{\"id\":\"";
    payload += slots[i].id;
    payload += "\",\"status\":\"";
    payload += statusToText(slots[i].status);
    payload += "\"}";
    if (i < SLOT_COUNT - 1) {
      payload += ",";
    }
  }
  payload += "]}";

  bool ok = mqttClient.publish(MQTT_TOPIC, payload.c_str(), true);
  Serial.print("Publish ");
  Serial.println(ok ? "success" : "failed");
  Serial.println(payload);

  if (ok) {
    for (size_t i = 0; i < SLOT_COUNT; i++) {
      slots[i].lastPublishedStatus = slots[i].status;
    }
  }
}

void setup() {
  Serial.begin(115200);

  // Optional NTP sync for real timestamp.
  configTime(7 * 3600, 0, "pool.ntp.org", "time.nist.gov");

  for (size_t i = 0; i < SLOT_COUNT; i++) {
    pinMode(slots[i].trigPin, OUTPUT);
    pinMode(slots[i].echoPin, INPUT);
    pinMode(slots[i].ledPin, OUTPUT);
    digitalWrite(slots[i].ledPin, LOW);
  }

  connectWiFi();
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  if (!mqttClient.connected()) {
    reconnectMQTT();
  }
  mqttClient.loop();

  unsigned long now = millis();
  if (now - lastSensorReadAt >= SENSOR_READ_MS) {
    lastSensorReadAt = now;

    for (size_t i = 0; i < SLOT_COUNT; i++) {
      float distance = readDistanceCm(slots[i].trigPin, slots[i].echoPin);
      slots[i].distanceCm = distance;
      slots[i].status = (distance <= OCCUPIED_DISTANCE_CM) ? OCCUPIED : EMPTY;

      // LED ON when occupied, OFF when empty.
      digitalWrite(slots[i].ledPin, slots[i].status == OCCUPIED ? HIGH : LOW);
    }

    publishSlots(false); // Publish only if changed.
  }

  // Periodic heartbeat publish.
  if (now - lastHeartbeatAt >= HEARTBEAT_MS) {
    lastHeartbeatAt = now;
    publishSlots(true);
  }
}