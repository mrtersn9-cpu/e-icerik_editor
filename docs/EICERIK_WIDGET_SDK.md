# EicerikWidget SDK Dokümantasyonu

Sürüm: 0.2.0
Kapsam: Yerleşik widget runtime + deneysel ZIP import önizlemesi

> Durum notu: Yerleşik widgetlar ve editör içi ZIP yükleme önizlemede çalışır. Widget içeren SCORM paketleri henüz yayın için onaylı değildir. Dışa aktarıcı widget dosyalarını hazırlıyor, ancak dosyalar nihai ZIP listesine eklenmediği için paket içinde eksik kalıyor.

Bu doküman, e-içerik editörüne uyumlu özel widget, animasyon, mini oyun ve simülasyon paketlerinin nasıl hazırlanacağını açıklar.

## 1. Ana Prensip

Widget ana sistemi yönetmez.

Widget şunları yapar:

- command alır
- kendi animasyonunu/simülasyonunu çalıştırır
- event gönderir
- hata bildirir
- tamamlanma bilgisi gönderebilir

Ana sistem şunları yapar:

- değişken günceller
- tetikleyici çalıştırır
- katman açar/kapatır
- soru gösterir
- puan/tamamlanma kararını verir
- SCORM kaydını yönetir

Widget doğrudan SCORM'a yazmaz.
Widget doğrudan katman/soru açmaz.
Widget ana React state'ine doğrudan erişmez.

## 2. Widget Paket Yapısı

Bir widget şu dosya yapısıyla hazırlanır:

```
widget-id/
  manifest.json
  index.html
  style.css
  widget.js
  assets/
```

Örnek:

```
plant-growth-v1/
  manifest.json
  index.html
  style.css
  widget.js
  assets/
    seed.png
    sprout.png
    plant.png
    flower.png
```

Yerleşik widgetlar proje içinde tutulur:

```
public/widgets/builtins/
```

ZIP import editörde etkindir. Yüklenen ZIP bellekte Blob URL'lerine açılır; ham assetler SCORM hazırlığı için editör state'inde tutulur. Kalıcı `public/widgets/imported/` klasörü şu an kullanılmaz.

## 3. manifest.json

Her widget bir manifest.json dosyasına sahip olmalıdır.

Minimum örnek:

```json
{
  "id": "dice-v1",
  "name": "Zar Atma",
  "version": "1.0.0",
  "entry": "index.html",
  "defaultWidth": 300,
  "defaultHeight": 260,
  "props": [],
  "commands": [],
  "events": []
}
```

Alanlar:

**id:**
Widget teknik kimliği.

**name:**
Kullanıcıya görünen ad.

**version:**
Widget sürümü.

**entry:**
Başlangıç HTML dosyası.

**defaultWidth:**
Varsayılan genişlik.

**defaultHeight:**
Varsayılan yükseklik.

**props:**
Ayarlar.

**commands:**
Ana sistemden alınacak komutlar.

**events:**
Ana sisteme gönderilecek olaylar.

**eicerik:**
Otomatik kurulum bilgisi. Opsiyoneldir.

## 4. Props

Props, widget ayarlarıdır.

Örnek:

```json
"props": [
  {
    "name": "speed",
    "type": "number",
    "label": "Hız",
    "default": 1
  },
  {
    "name": "animated",
    "type": "boolean",
    "label": "Animasyonlu",
    "default": true
  },
  {
    "name": "theme",
    "type": "select",
    "label": "Tema",
    "options": ["blue", "green", "yellow"],
    "default": "green"
  }
]
```

ZIP doğrulayıcının güncel desteklediği prop tipleri:

- number
- boolean
- text

Yerleşik widget manifestlerinde ek tipler kullanılacaksa ZIP doğrulayıcı ile aynı sözleşmeye getirilmelidir.

## 5. Commands

Command, ana sistemin widget'a gönderdiği komuttur.

Örnek:

```json
"commands": [
  {
    "name": "flyWithFlaps",
    "label": "Kanat çırparak uç",
    "params": {
      "flapCount": "number"
    }
  },
  {
    "name": "reset",
    "label": "Sıfırla"
  }
]
```

Command isimleri camelCase olmalıdır.

Doğru:

- startEngine
- driveToCheckpoint
- checkMeasurement
- continueDriving
- flyWithFlaps

Yanlış:

- Motoru Çalıştır
- start engine
- komut1

## 6. Events

Event, widget'ın ana sisteme gönderdiği olaydır.

Örnek:

```json
"events": [
  {
    "name": "diceRolled",
    "label": "Zar Atıldı"
  },
  {
    "name": "flightComplete",
    "label": "Uçuş Tamamlandı"
  }
]
```

Event isimleri camelCase olmalıdır.

Doğru:

- diceRolled
- flightComplete
- plantStageReached
- measurementSubmitted
- checkpointReached
- letterTraceCompleted

Yanlış:

- zar atıldı
- Event1
- tamamlandı

## 7. EicerikWidget SDK API

Widget içinde kullanılacak API:

```js
EicerikWidget.ready();
EicerikWidget.emit(eventName, payload);
EicerikWidget.onCommand(commandName, handler);
EicerikWidget.getProps();
EicerikWidget.error(errorPayload);
EicerikWidget.complete(payload);
```

## 8. ready()

Widget hazır olduğunda çağrılır.

```js
EicerikWidget.ready();
```

Ana sisteme widget'ın yüklenip hazır olduğunu bildirir.

## 9. emit(eventName, payload)

Widget ana sisteme event gönderir.

```js
EicerikWidget.emit("diceRolled", {
  value: 6
});
```

Ana sistem bu event'i alır, variable binding uygular ve trigger çalıştırır.

## 10. onCommand(commandName, handler)

Ana sistemden gelen command'ları dinler.

```js
EicerikWidget.onCommand("flyWithFlaps", function(payload) {
  const flapCount = Number(payload.flapCount || 1);

  // Animasyon burada çalışır.

  EicerikWidget.emit("flightComplete", {
    flapCount
  });
});
```

## 11. getProps()

Widget'a verilen props değerlerini okur.

```js
const props = EicerikWidget.getProps();
const speed = props.speed || 1;
```

## 12. error(errorPayload)

Widget hata bildirir.

```js
EicerikWidget.error({
  code: "ANIMATION_FAILED",
  message: "Animasyon çalıştırılamadı."
});
```

Widget hata verse bile ana editör çökmemelidir.

## 13. complete(payload)

Widget tamamlanma bilgisi gönderebilir.

```js
EicerikWidget.complete({
  score: 100,
  success: true
});
```

Ana sistem bu bilgiyi SCORM ve tetikleyici sistemiyle işler.

## 14. postMessage Protokolü

Widget iframe içinde çalışır. Ana sistemle postMessage üzerinden konuşur.

**Widget → Ana sistem event:**

```json
{
  "type": "EICERIK_WIDGET_EVENT",
  "widgetInstanceId": "obj_widget_dice_1",
  "eventName": "diceRolled",
  "payload": {
    "value": 6
  }
}
```

**Ana sistem → Widget command:**

```json
{
  "type": "EICERIK_WIDGET_COMMAND",
  "widgetInstanceId": "obj_widget_bird_1",
  "command": "flyWithFlaps",
  "payload": {
    "flapCount": 6
  }
}
```

**Widget ready:**

```json
{
  "type": "EICERIK_WIDGET_READY",
  "widgetInstanceId": "obj_widget_bird_1"
}
```

**Widget error:**

```json
{
  "type": "EICERIK_WIDGET_ERROR",
  "widgetInstanceId": "obj_widget_bird_1",
  "payload": {
    "code": "ANIMATION_FAILED",
    "message": "Animasyon çalıştırılamadı."
  }
}
```

**Widget complete:**

```json
{
  "type": "EICERIK_WIDGET_COMPLETE",
  "widgetInstanceId": "obj_widget_bird_1",
  "payload": {
    "score": 100,
    "success": true
  }
}
```

## 15. Variable Binding

Widget event payload değerleri ana sistem değişkenlerine bağlanabilir.

Örnek:

```json
"bindings": {
  "diceRolled.value": "diceValue",
  "plantStageReached.stage": "plantStage",
  "measurementSubmitted.measuredValue": "measuredValue"
}
```

Bu durumda:

- diceRolled payload.value → diceValue
- plantStageReached payload.stage → plantStage
- measurementSubmitted payload.measuredValue → measuredValue

## 16. Trigger Entegrasyonu

Yeni trigger event:

- `onWidgetEvent`

Yeni trigger action:

- `sendWidgetCommand`

Örnek:

```json
{
  "event": "onWidgetEvent",
  "source": "obj_widget_dice_1",
  "eventName": "diceRolled",
  "actions": [
    {
      "type": "sendWidgetCommand",
      "target": "obj_widget_bird_1",
      "command": "flyWithFlaps",
      "payload": {
        "flapCount": "{{diceValue}}"
      }
    }
  ]
}
```

Layer açma örneği:

```json
{
  "event": "onWidgetEvent",
  "source": "obj_widget_bird_1",
  "eventName": "flightComplete",
  "actions": [
    {
      "type": "showLayer",
      "layerId": "layer_question"
    }
  ]
}
```

## 17. Custom Widget Object Schema

Editör içinde widget nesnesi şöyle tutulur:

```json
{
  "id": "obj_widget_dice_1",
  "type": "custom-widget",
  "name": "Zar Atma",
  "layerId": "base",
  "x": 120,
  "y": 100,
  "width": 300,
  "height": 260,
  "visible": true,
  "locked": false,
  "widget": {
    "widgetId": "dice-v1",
    "source": "builtin",
    "basePath": "/widgets/builtins/dice-v1",
    "entry": "index.html",
    "props": {
      "min": 1,
      "max": 10,
      "animated": true
    }
  },
  "bindings": {
    "diceRolled.value": "diceValue"
  },
  "triggers": []
}
```

## 18. Edit Mode / Preview Mode

**Edit Mode:**
- Widget seçilebilir.
- Widget taşınabilir.
- Widget boyutlandırılabilir.
- Katman kilidi/görünürlüğü çalışır.
- Widget üzerinde edit overlay olabilir.
- Tam interaktif çalışmak zorunda değildir.

**Preview Mode:**
- Widget tam interaktif çalışır.
- Event gönderebilir.
- Command alabilir.
- Ana sistem tetikleyicileri çalıştırabilir.

## 19. Widget Geliştirme Kuralları

Widget geliştirirken şu kurallara uyulmalıdır:

1. Widget ana React uygulamasına doğrudan erişmeyecek.
2. Widget ana DOM'u değiştirmeyecek.
3. Widget SCORM'a doğrudan yazmayacak.
4. Widget soru/katman doğrudan açmayacak.
5. Widget tüm dış iletişimi EicerikWidget SDK ile yapacak.
6. Widget `EicerikWidget.ready` çağıracak.
7. Widget eventlerini `EicerikWidget.emit` ile gönderecek.
8. Widget command'larını `EicerikWidget.onCommand` ile dinleyecek.
9. Widget hata verirse `EicerikWidget.error` gönderecek.
10. Widget preview modunda çalışacak.
11. Widget edit mode'da tam interaktif olmak zorunda değildir.
12. Manifest'te tanımlı event/command/props ile uyumlu olacak.
13. Dış CDN kullanmayacak.
14. Assets klasörü içindeki yerel dosyaları kullanacak.

## 20. SCORM Kuralları

Widget doğrudan SCORM API kullanmaz.

Yanlış:

```
Widget → SCORM SetValue
```

Doğru:

```
Widget → event gönderir
Ana sistem → değişkenleri günceller
Ana sistem → tetikleyici çalıştırır
Ana sistem → SCORM'a yazar
```

Editör dışa aktarıcısı widget assetlerini hazırlamaya başlamıştır. Ancak mevcut uygulamada hazırlanan asset listesi nihai SCORM ZIP dosya listesine eklenmediği için widget içeren paketler yayınlanmamalıdır. Önce dışa aktarıcı düzeltilmeli, ardından yerleşik ve ZIP ile yüklenen widgetlar LMS üzerinde test edilmelidir.

## 21. Örnek Widget: Zar Atma

**manifest.json:**

```json
{
  "id": "dice-v1",
  "name": "Zar Atma",
  "version": "1.0.0",
  "entry": "index.html",
  "defaultWidth": 300,
  "defaultHeight": 260,
  "props": [
    {
      "name": "min",
      "type": "number",
      "label": "Minimum",
      "default": 1
    },
    {
      "name": "max",
      "type": "number",
      "label": "Maksimum",
      "default": 10
    }
  ],
  "commands": [
    {
      "name": "roll",
      "label": "Zarı At"
    },
    {
      "name": "reset",
      "label": "Sıfırla"
    }
  ],
  "events": [
    {
      "name": "diceRolled",
      "label": "Zar Atıldı"
    }
  ]
}
```

**widget.js:**

```js
EicerikWidget.ready();

const props = EicerikWidget.getProps();
const min = Number(props.min || 1);
const max = Number(props.max || 10);

function rollDice() {
  const value = Math.floor(Math.random() * (max - min + 1)) + min;

  EicerikWidget.emit("diceRolled", {
    value
  });
}

EicerikWidget.onCommand("roll", rollDice);

document.getElementById("rollButton")?.addEventListener("click", rollDice);
```

## 22. Örnek Widget: Kuş Uçuşu

**manifest.json:**

```json
{
  "id": "bird-flight-v1",
  "name": "Kuş Uçuş Animasyonu",
  "version": "1.0.0",
  "entry": "index.html",
  "defaultWidth": 500,
  "defaultHeight": 320,
  "props": [
    {
      "name": "speed",
      "type": "number",
      "label": "Hız",
      "default": 1
    }
  ],
  "commands": [
    {
      "name": "flyWithFlaps",
      "label": "Kanat çırparak uç",
      "params": {
        "flapCount": "number"
      }
    },
    {
      "name": "reset",
      "label": "Sıfırla"
    }
  ],
  "events": [
    {
      "name": "flapComplete",
      "label": "Kanat Çırpma Tamamlandı"
    },
    {
      "name": "flightComplete",
      "label": "Uçuş Tamamlandı"
    }
  ]
}
```

**widget.js:**

```js
EicerikWidget.ready();

EicerikWidget.onCommand("flyWithFlaps", function(payload) {
  const flapCount = Math.max(1, Number(payload.flapCount || 1));
  let current = 0;

  function flap() {
    current += 1;

    EicerikWidget.emit("flapComplete", {
      current,
      total: flapCount
    });

    if (current < flapCount) {
      setTimeout(flap, 250);
      return;
    }

    EicerikWidget.emit("flightComplete", {
      flapCount
    });
  }

  flap();
});

EicerikWidget.onCommand("reset", function() {
  EicerikWidget.emit("flightComplete", {
    flapCount: 0,
    reset: true
  });
});
```

## 23. Yeni Widget Üretim Prompt Şablonu

Dışarıdan yapay zekâya widget yaptırmak için:

```
EicerikWidget SDK standardına uygun bir özel etkileşim widget paketi hazırla.

Widget adı:
[Buraya yaz]

Widget ID:
[örnek: plant-growth-v1]

Amaç:
[Widget ne yapacak?]

Paket yapısı:
- manifest.json
- index.html
- style.css
- widget.js
- assets/ gerekiyorsa

Kurallar:
- Widget iframe içinde çalışacak.
- Ana sistemle sadece EicerikWidget SDK üzerinden haberleşecek.
- Widget doğrudan soru/katman/SCORM açmayacak.
- Widget yalnızca event gönderecek.
- Widget ana sistemden command alacak.
- Hata durumunda EicerikWidget.error kullanacak.
- Başlangıçta EicerikWidget.ready çağrılacak.
- Tüm eventler manifest.json içinde tanımlanacak.
- Tüm commandlar manifest.json içinde tanımlanacak.
- Tüm props manifest.json içinde tanımlanacak.
- Dış CDN kullanma.
- Gerekli görsel/ses dosyalarını assets klasörüne koy.
- ZIP paketi olarak teslim edilecek.

Komutlar:
[command listesi]

Eventler:
[event listesi]

Props:
[prop listesi]

Örnek akış:
[Örneğin: Bitki sulanınca plantWatered event'i göndersin. Çiçek aşamasına gelince plantCompleted event'i göndersin.]

Teslim:
- manifest.json
- index.html
- style.css
- widget.js
- assets/
- kısa kullanım açıklaması
- event/command örnekleri
- trigger bağlantısı örneği
```

## 24. Minimum Kabul Standardı

Bir widget sisteme uyumlu sayılmak için:

1. manifest.json içermeli.
2. index.html üzerinden başlamalı.
3. `EicerikWidget.ready` çağırmalı.
4. Eventlerini `EicerikWidget.emit` ile göndermeli.
5. Command'larını `EicerikWidget.onCommand` ile dinlemeli.
6. Ana DOM'a müdahale etmemeli.
7. SCORM'a doğrudan yazmamalı.
8. Soru/katman doğrudan açmamalı.
9. Hata durumunda `EicerikWidget.error` göndermeli.
10. Preview modunda çalışmalı.
11. Manifest'te tanımlı event/command/props ile uyumlu olmalı.
12. Kaydet/aç sonrası props ve widget bağlantısı korunmalı.

## 25. Durum ve Sonraki Fazlar

**Mevcut:**

- Built-in widget runtime.
- Zar → Kuş → Event → Trigger → Katman demosu.
- ZIP import ve manifest doğrulama.
- ZIP içeriği için dış kaynak ve ağ isteği uyarıları.

**Sıradaki:**

- SCORM export içinde hazırlanan widget assetlerini gerçekten ZIP'e ekleme.
- Yerleşik ve ZIP widget paketleri için LMS kabul testi.
- Yüklenen widgetlar için kalıcı registry ve yeniden açma testi.

**Daha sonra:**

Widget kütüphanesi:
- Bitki Büyütme
- Araba Sürme
- Ölçme Aracı
- Harf Çizme
- Çark Çevirme
- Yazı Tura
- Geometri Çizimi
