/*
 * Tali receiver: reference skeleton for the ESP32 receiver (Arduino core 3.x).
 *
 * Implements the HTTP API in docs/API.md and ports the alert state machine from js/engine.js.
 * NOT YET COMPILED OR TESTED ON HARDWARE. Treat it as a starting point for the hardware lead.
 *
 * Libraries: NimBLE-Arduino (h2zero) 1.4.x, ArduinoJson 7.x, built-in WiFi / WebServer / Preferences / LittleFS.
 * Board settings: Partition scheme "Huge APP" or "Minimal SPIFFS" (BLE + Wi-Fi need the space).
 *
 * Stability notes (the PRD reports receiver reboots):
 *  - Use NimBLE, not Bluedroid: much less RAM, and Wi-Fi + BLE coexist better.
 *  - Scan with a duty cycle (interval 100 ms, window 50 ms), passive, with duplicates allowed so RSSI keeps updating.
 *  - Never do HTTP work inside BLE callbacks: callbacks only copy (id, rssi, time) into a small queue.
 *  - Keep JSON documents small; watch heap with ESP.getFreeHeap() in /api/status during testing.
 *  - Power the board from a stable supply when testing; brown-outs look like random reboots.
 */
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <LittleFS.h>
#include <ArduinoJson.h>
#include <NimBLEDevice.h>

// ---------------- pins ----------------
static const int PIN_MOTOR = 23;   // demo: LED on GPIO23 stands in for the vibration motor

// ---------------- config ----------------
struct Config {
  uint32_t dropMs = 1500, confirmMs = 3000, aroundDepartureMs = 3000;
  uint8_t  recoverPackets = 3;
  uint32_t recoverWindowMs = 2500, recoveredHoldMs = 8000, ringGraceMs = 1500;
  int      heardRssi = -80;
} cfg;

static NimBLEUUID TALI_SERVICE("7a1e0001-5a1f-4c3b-9d1e-7a11b0000001");
static NimBLEUUID TALI_RING("7a1e0002-5a1f-4c3b-9d1e-7a11b0000001");

// ---------------- items ----------------
enum State : uint8_t { WAITING, NEARBY, RECHECKING, AWAY, CHECK, RECOVERED };
static const char* STATE_NAME[] = { "waiting", "nearby", "rechecking", "away", "check", "recovered" };

struct Item {
  char tagId[24]; char name[24]; char kind[8];
  NimBLEAddress addr; bool addrKnown = false;
  State state = WAITING;
  uint32_t lastHeard = 0, lastAdv = 0, lossAt = 0, recoveredAt = 0, ringingUntil = 0;
  int rssi = -127; bool rssiValid = false; int battery = -1;
  uint32_t heard[8]; uint8_t heardN = 0;   // recent strong-advert timestamps
  NimBLEClient* ringClient = nullptr;       // held open while ringing (toggle)
};
static const int MAX_ITEMS = 8;
static Item items[MAX_ITEMS];
static int itemCount = 0;
static char listId[24] = "", listName[32] = "";
static uint32_t listRev = 0;

// ---------------- motion ----------------
static bool moving = false;
static uint32_t moveSince = 0;
bool readMotion() {
  // TODO: replace with IMU (e.g. MPU6050 / LIS3DH) step or variance detection.
  return true;   // demo boards have no IMU: assume the wearer is moving
}

// ---------------- events ----------------
struct Event { uint32_t id, t; char type[12]; char tagId[24]; char name[24]; char msg[72]; };
static Event events[30];
static uint32_t eventSeq = 0;
void emit(const char* type, Item* it, const char* fmt, ...) {
  Event& e = events[eventSeq % 30];
  e.id = ++eventSeq; e.t = millis();
  strlcpy(e.type, type, sizeof e.type);
  strlcpy(e.tagId, it ? it->tagId : "", sizeof e.tagId);
  strlcpy(e.name, it ? it->name : "", sizeof e.name);
  va_list ap; va_start(ap, fmt); vsnprintf(e.msg, sizeof e.msg, fmt, ap); va_end(ap);
}

// ---------------- persistence ----------------
Preferences prefs;
void saveList(const String& json) { prefs.begin("tali", false); prefs.putString("list", json); prefs.end(); }
void saveConfig() { prefs.begin("tali", false); prefs.putUInt("confirm", cfg.confirmMs); prefs.putInt("rssi", cfg.heardRssi); prefs.end(); }

bool applyList(JsonDocument& doc) {
  JsonArray tags = doc["tags"].as<JsonArray>();
  if (tags.isNull() || tags.size() > MAX_ITEMS) return false;
  Item next[MAX_ITEMS]; int n = 0;
  for (JsonObject t : tags) {
    const char* id = t["tag_id"] | "";
    Item* prev = nullptr;
    for (int i = 0; i < itemCount; i++) if (!strcmp(items[i].tagId, id)) prev = &items[i];
    next[n] = prev ? *prev : Item();
    strlcpy(next[n].tagId, id, sizeof next[n].tagId);
    strlcpy(next[n].name, t["name"] | id, sizeof next[n].name);
    strlcpy(next[n].kind, t["kind"] | "tag", sizeof next[n].kind);
    n++;
  }
  memcpy(items, next, sizeof(Item) * n); itemCount = n;
  strlcpy(listId, doc["id"] | "", sizeof listId);
  strlcpy(listName, doc["name"] | "", sizeof listName);
  listRev = doc["rev"] | 0;
  return true;
}

void loadPersisted() {
  prefs.begin("tali", true);
  cfg.confirmMs = prefs.getUInt("confirm", cfg.confirmMs);
  cfg.heardRssi = prefs.getInt("rssi", cfg.heardRssi);
  String json = prefs.getString("list", "");
  prefs.end();
  if (json.length()) {
    JsonDocument doc;
    if (!deserializeJson(doc, json) && applyList(doc)) {
      for (int i = 0; i < itemCount; i++) items[i].state = WAITING;   // re-arm only after seeing each item
      emit("reboot", nullptr, "Restarted: reloaded \"%s\" rev %lu", listName, (unsigned long)listRev);
    }
  }
}

// ---------------- BLE scanning ----------------
struct Adv { char tagId[24]; int rssi; uint32_t t; NimBLEAddress addr; int battery; };
static QueueHandle_t advQueue;

class ScanCB : public NimBLEAdvertisedDeviceCallbacks {
  void onResult(NimBLEAdvertisedDevice* d) override {
    if (!d->isAdvertisingService(TALI_SERVICE)) return;
    std::string md = d->getManufacturerData();   // [0..1] company id, [2] battery, [3..] tag id
    if (md.size() < 4) return;
    Adv a{};
    a.battery = (uint8_t)md[2];
    size_t len = min(md.size() - 3, sizeof(a.tagId) - 1);
    memcpy(a.tagId, md.data() + 3, len); a.tagId[len] = 0;
    a.rssi = d->getRSSI(); a.t = millis(); a.addr = d->getAddress();
    xQueueSend(advQueue, &a, 0);   // never block inside the BLE task
  }
};

void startScan() {
  NimBLEScan* s = NimBLEDevice::getScan();
  s->setAdvertisedDeviceCallbacks(new ScanCB(), true);   // wantDuplicates = true: keep RSSI fresh
  s->setActiveScan(false);
  s->setInterval(100); s->setWindow(50);
  s->start(0, nullptr, false);                           // scan forever
}

void drainAdverts() {
  Adv a;
  while (xQueueReceive(advQueue, &a, 0) == pdTRUE) {
    for (int i = 0; i < itemCount; i++) {
      Item& it = items[i];
      if (strcmp(it.tagId, a.tagId)) continue;
      it.rssi = (!it.rssiValid || a.t - it.lastAdv > 3000) ? a.rssi : (it.rssi * 6 + a.rssi * 4) / 10;
      it.rssiValid = true; it.lastAdv = a.t; it.addr = a.addr; it.addrKnown = true; it.battery = a.battery;
      if (a.rssi >= cfg.heardRssi) {
        it.lastHeard = a.t;
        if (it.heardN < 8) it.heard[it.heardN++] = a.t;
        else { memmove(it.heard, it.heard + 1, 7 * sizeof(uint32_t)); it.heard[7] = a.t; }
      }
    }
  }
}

// ---------------- haptics ----------------
static uint32_t motorOffAt = 0;
void tap() { digitalWrite(PIN_MOTOR, HIGH); motorOffAt = millis() + 400; }

// ---------------- state machine (port of ReceiverLogic.tick) ----------------
void setState(Item& it, State s) { it.state = s; }

void tickItems(uint32_t now) {
  for (int i = 0; i < itemCount; i++) {
    Item& it = items[i];
    uint8_t k = 0;   // prune heard[] to the recover window
    for (uint8_t j = 0; j < it.heardN; j++) if (now - it.heard[j] <= cfg.recoverWindowMs) it.heard[k++] = it.heard[j];
    it.heardN = k;
    bool recent = it.lastHeard && now - it.lastHeard < cfg.dropMs;
    bool consistent = recent && it.heardN >= cfg.recoverPackets;
    bool grace = now < it.ringingUntil + cfg.ringGraceMs;

    switch (it.state) {
      case WAITING:
        if (recent) { setState(it, NEARBY); emit("armed", &it, "%s seen, monitoring armed", it.name); }
        break;
      case NEARBY:
        if (!recent && !grace) { it.lossAt = it.lastHeard; setState(it, RECHECKING); emit("state", &it, "%s signal dropped, rechecking", it.name); }
        break;
      case RECHECKING: {
        uint8_t since = 0;
        for (uint8_t j = 0; j < it.heardN; j++) if (it.heard[j] > it.lossAt) since++;
        if (recent && (consistent || since >= 2)) { setState(it, NEARBY); emit("state", &it, "%s back, interruption ignored", it.name); break; }
        if (moving) {
          bool seenAround = (int32_t)(moveSince - it.lastHeard) <= (int32_t)cfg.aroundDepartureMs;
          if (!seenAround) { setState(it, AWAY); emit("suppressed", &it, "%s already away before you moved", it.name); break; }
          uint32_t ref = max(it.lossAt, moveSince);
          if (now - ref >= cfg.confirmMs) { setState(it, CHECK); tap(); emit("alert", &it, "Check %s: left behind as you moved", it.name); }
        } else if (now - it.lossAt >= max(cfg.confirmMs, (uint32_t)2000) + 1000) {
          setState(it, AWAY); emit("suppressed", &it, "%s moved away while you were still", it.name);
        }
        break;
      }
      case AWAY:
        if (consistent) { setState(it, NEARBY); emit("state", &it, "%s nearby again", it.name); }
        break;
      case CHECK:
        if (consistent) { it.recoveredAt = now; setState(it, RECOVERED); emit("recovered", &it, "%s recovered", it.name); }
        break;
      case RECOVERED:
        if (!recent && !grace) { it.lossAt = it.lastHeard; setState(it, RECHECKING); }
        else if (now - it.recoveredAt >= cfg.recoveredHoldMs) setState(it, NEARBY);
        break;
    }
  }
}

// ---------------- ringing (toggle) ----------------
bool writeRing(NimBLEClient* c, uint8_t v) {
  NimBLERemoteService* s = c->getService(TALI_SERVICE);
  NimBLERemoteCharacteristic* ch = s ? s->getCharacteristic(TALI_RING) : nullptr;
  return ch && ch->writeValue(&v, 1, true);
}

void stopRing(Item& it, const char* why) {
  if (it.ringClient) {
    if (it.ringClient->isConnected()) { writeRing(it.ringClient, 0x00); it.ringClient->disconnect(); }   // PRD: disconnect after ringing
    NimBLEDevice::deleteClient(it.ringClient);
    it.ringClient = nullptr;
  }
  if (it.ringingUntil > millis()) emit("ring", &it, "Stopped ringing %s (%s)", it.name, why);
  it.ringingUntil = 0;
  if (!NimBLEDevice::getScan()->isScanning()) startScan();
}

bool startRing(Item& it, uint32_t maxMs) {
  if (it.ringClient) return true;                       // already ringing
  if (!it.addrKnown || millis() - it.lastHeard > 2000) return false;
  NimBLEClient* c = NimBLEDevice::createClient();
  if (!c->connect(it.addr) || !writeRing(c, 0xFF)) { NimBLEDevice::deleteClient(c); return false; }
  it.ringClient = c;                                    // keep the link open until stopped
  it.ringingUntil = millis() + maxMs;
  emit("ring", &it, "Ringing %s until stopped", it.name);
  if (!NimBLEDevice::getScan()->isScanning()) startScan();
  return true;
}

void serviceRinging(uint32_t now) {
  for (int i = 0; i < itemCount; i++) {
    Item& it = items[i];
    if (!it.ringClient) continue;
    if (it.ringClient->isConnected()) { it.lastHeard = now; it.rssi = it.ringClient->getRssi(); }   // presence via the link
    if (now >= it.ringingUntil) stopRing(it, "auto-stop");
    else if (!it.ringClient->isConnected()) stopRing(it, "link lost");
  }
}

// ---------------- HTTP ----------------
WebServer server(80);

void cors() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Cache-Control", "no-store");
}
void sendJson(int code, JsonDocument& doc) { cors(); String out; serializeJson(doc, out); server.send(code, "application/json", out); }

void handleStatus() {
  uint32_t now = millis();
  JsonDocument d;
  d["receiver"] = "Tali Band"; d["fw"] = "tali-rx 0.4.0"; d["uptime_ms"] = now;
  d["battery_pct"] = 86;   // TODO: read the battery ADC
  d["motion"] = moving ? "moving" : "still";
  d["heap"] = ESP.getFreeHeap();
  if (listRev) { JsonObject l = d["list"].to<JsonObject>(); l["id"] = listId; l["name"] = listName; l["rev"] = listRev; }
  JsonObject c = d["config"].to<JsonObject>(); c["confirm_ms"] = cfg.confirmMs; c["drop_ms"] = cfg.dropMs; c["heard_rssi"] = cfg.heardRssi;
  JsonArray arr = d["items"].to<JsonArray>();
  for (int i = 0; i < itemCount; i++) {
    Item& it = items[i]; JsonObject o = arr.add<JsonObject>();
    o["tag_id"] = it.tagId; o["name"] = it.name; o["state"] = STATE_NAME[it.state];
    if (it.rssiValid && now - it.lastAdv < 3000) o["rssi"] = it.rssi; else o["rssi"] = nullptr;
    if (it.lastHeard) o["last_heard_ms"] = now - it.lastHeard; else o["last_heard_ms"] = nullptr;
    if (it.battery >= 0) o["battery_pct"] = it.battery; else o["battery_pct"] = nullptr;
    o["ringing"] = now < it.ringingUntil;
  }
  JsonArray ev = d["events"].to<JsonArray>();
  uint32_t first = eventSeq > 30 ? eventSeq - 29 : 1;
  for (uint32_t id = first; id <= eventSeq; id++) {
    Event& e = events[(id - 1) % 30]; JsonObject o = ev.add<JsonObject>();
    o["id"] = e.id; o["t"] = e.t; o["type"] = e.type; o["msg"] = e.msg;
    if (e.tagId[0]) { o["tag_id"] = e.tagId; o["name"] = e.name; }
  }
  sendJson(200, d);
}

void handleCarry() {
  JsonDocument doc, res;
  String body = server.arg("plain");
  if (deserializeJson(doc, body) || !applyList(doc)) { res["ack"] = false; sendJson(400, res); return; }
  saveList(body);                                   // ack only after it is in flash
  emit("list", nullptr, "Saved \"%s\" (rev %lu)", listName, (unsigned long)listRev);
  res["ack"] = true; res["rev"] = listRev; sendJson(200, res);
}

void handleRing() {
  JsonDocument doc, res;
  deserializeJson(doc, server.arg("plain"));
  const char* id = doc["tag_id"] | "";
  bool on = doc["on"] | true;
  uint32_t maxMs = doc["max_ms"] | 60000;
  for (int i = 0; i < itemCount; i++) if (!strcmp(items[i].tagId, id)) {
    if (!on) { stopRing(items[i], "stopped from app"); res["ringing"] = false; sendJson(200, res); }
    else if (startRing(items[i], maxMs)) { res["ringing"] = true; sendJson(200, res); }
    else { res["error"] = "not reachable"; sendJson(409, res); }
    return;
  }
  res["error"] = "unknown tag"; sendJson(404, res);
}

void handleConfig() {
  JsonDocument doc, res;
  deserializeJson(doc, server.arg("plain"));
  cfg.confirmMs = doc["confirm_ms"] | cfg.confirmMs;
  cfg.heardRssi = doc["heard_rssi"] | cfg.heardRssi;
  saveConfig();
  res["ok"] = true; sendJson(200, res);
}

void handleScan() {
  // TODO: track unpaired Tali tags seen in drainAdverts() and list them here, strongest first.
  JsonDocument res; res["tags"].to<JsonArray>(); sendJson(200, res);
}

void setupHttp() {
  server.on("/api/status", HTTP_GET, handleStatus);
  server.on("/api/carry", HTTP_POST, handleCarry);
  server.on("/api/ring", HTTP_POST, handleRing);
  server.on("/api/config", HTTP_POST, handleConfig);
  server.on("/api/scan", HTTP_GET, handleScan);
  server.onNotFound([] {
    if (server.method() == HTTP_OPTIONS) { cors(); server.send(204); return; }
    String path = server.uri(); if (path == "/") path = "/app.html";
    if (LittleFS.exists(path)) {
      String type = path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "application/javascript" : "text/html";
      File f = LittleFS.open(path, "r"); server.streamFile(f, type); f.close();
    } else server.send(404, "text/plain", "not found");
  });
  server.begin();
}

// ---------------- main ----------------
void setup() {
  Serial.begin(115200);
  pinMode(PIN_MOTOR, OUTPUT);
  advQueue = xQueueCreate(64, sizeof(Adv));
  LittleFS.begin(true);
  loadPersisted();

  uint8_t mac[6]; WiFi.macAddress(mac);
  char ssid[16]; snprintf(ssid, sizeof ssid, "Tali-%02X%02X", mac[4], mac[5]);
  WiFi.mode(WIFI_AP);
  WiFi.softAP(ssid, "tali1234");                    // TODO: per-device password printed on the box
  WiFi.setSleep(true);                              // required for Wi-Fi + BLE coexistence

  NimBLEDevice::init("");
  startScan();
  setupHttp();
}

void loop() {
  uint32_t now = millis();
  drainAdverts();
  bool m = readMotion();
  if (m && !moving) moveSince = now;
  moving = m;
  serviceRinging(now);
  tickItems(now);
  if (motorOffAt && now >= motorOffAt) { digitalWrite(PIN_MOTOR, LOW); motorOffAt = 0; }
  server.handleClient();
  delay(20);
}
