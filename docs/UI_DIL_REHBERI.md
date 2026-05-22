# UI Dil Rehberi

Bu rehber, editör arayüzünde kullanıcıya görünen terimlerin tutarlı kalması için kullanılır.

## Temel Terimler

| Teknik terim | Kullanıcıya görünen terim |
| --- | --- |
| object | nesne |
| slide | sahne |
| layer | katman |
| trigger | tetikleyici |
| canvas | çalışma alanı |
| widget | özel etkileşim / etkileşim paketi |
| runtime | önizleme / çalıştırma |
| SCORM | SCORM |
| TTKB | TTKB |

## Kullanım Notları

- Internal `id`, `type`, `value`, enum ve kaydedilmiş JSON alanları değiştirilmez.
- Tetikleyici değerleri sistem anahtarıdır; örneğin `KatmanaGec`, `Goster`, `Gizle`, `NesneToggle`, `SliderGec` ve `SayfaGec` aynen korunur.
- Kullanıcıya görünen label, title, placeholder, toast ve açıklama metinlerinde Türkçe karakterler kullanılmalıdır.
- `runtime` terimi bağlama göre çevrilir: öğrenci akışında “önizleme”, teknik test bağlamında “çalıştırma”.
- SCORM ve TTKB ürün terimi olarak korunur; SCORM standardı bu ürün için SCORM 1.2 olarak kalır.
