# Gölge İstasyonu

Hafif PC'lerde çalışması için HTML5 Canvas + saf Node.js ile yapılmış sosyal çıkarım prototipi.

> Not: Bu proje Among Us'ın birebir kopyası değildir; oda kodu, toplantı, görev, rol ve bot mantığı gibi sosyal çıkarım fikirlerinden esinlenen özgün bir prototiptir. İsimler, görseller, harita ve kod özgündür.

## Çalıştırma

1. Komut satırında proje klasörüne gir:

```bash
cd golge-istasyonu
```

2. Sunucuyu başlat:

```bash
node server.js
```

3. Tarayıcıda aç:

```text
http://localhost:8080
```

## Aynı bilgisayarda test

- Birden fazla tarayıcı sekmesi aç.
- İlk sekmede **Oda Oluştur**.
- Diğer sekmelerde oda koduyla katıl.

## Aynı Wi‑Fi üzerinden test

- Sunucuyu açan bilgisayarın yerel IP adresini bul.
  - Windows: `ipconfig`
  - Örnek IP: `192.168.1.34`
- Diğer bilgisayarlar şu adrese girsin:

```text
http://192.168.1.34:8080
```

- Oda koduyla katılabilirler.
- Windows Güvenlik Duvarı izin isterse Node.js için izin ver.

## Online internet üzerinden oynatma

Bu prototipte oda kodları **aynı Node sunucusu içinde** çalışır. İnternetten arkadaşlarınla oynamak için projeyi bir sunucuya/VPS'e koymak veya port yönlendirme yapmak gerekir.

Basit seçenekler:

- Kendi modemin üzerinden port yönlendirme: TCP 8080
- Bir VPS'e yükleme
- Render/Fly.io/Railway gibi Node destekli servisler

## Kontroller

- `WASD` / Oklar: hareket
- `E`: görev yap
- `R`: ceset raporla
- `M`: acil toplantı
- `Q`: gölge rolündeysen öldür
- `F`: rol yeteneği
- `X`: sabotaj tamir et
- `C`: gölge rolündeysen sabotaj menüsünü aç
- `K`: gölge rolündeysen kapı kilitle
- `V`: yakınındaki bilgi panelini aç

## Şu anki özellikler

- Web sitesi tarzı ana sayfa
- Oyna / kostüm / profil / roller / nasıl oynanır bölümleri
- Tarayıcı tabanlı yerel profil sistemi:
  - XP
  - Oyun sayısı
  - Galibiyet sayısı
- Gerçek oda kodu mantığı
- Host ayar paneli
- Bot ekleme/silme
- Botlarla oynama
- Çok oyunculu bağlantı: aynı sunucu üzerinde WebSocket
- Görev sistemi
- Mini görev ekranları:
  - Kod girme
  - Kablo sıralama
  - Şalter eşleştirme
  - Matematik konsolu
  - Sekans girme
  - Kadran ayarlama
- Daha büyük ve detaylı istasyon haritası
- Genişletilmiş harita alanı: Hangar, Atölye, Hidroponik ve Gözlem odaları
- Canvas ile her oda için ayrı dekor/görsel tema:
  - Komuta konsolları
  - Seyir ekranları
  - Reaktör çekirdeği
  - Laboratuvar tezgâhları
  - Medikal yatakları
  - Güvenlik monitörleri
  - Elektrik panelleri/kablolar
  - Depo kasaları
  - Kafeterya masaları
  - Oksijen kapsülleri
  - Arşiv rafları
- Kamera/viewport sistemi: oyuncuyu takip eden harita görünümü
- Oda isimleri, koridor düzeni ve geçiş noktaları
- Harita engelleri ve çarpışma sistemi
- Sabotaj sistemi:
  - Işık sabotajı
  - Reaktör krizi
  - İletişim kesintisi
- Sabotaj tamir noktaları
- Bilgi panelleri:
  - Yönetim paneli
  - Kamera paneli
  - Yaşam paneli
- Kapı kilitleme sistemi
- Ölü oyuncu hayalet sistemi:
  - Hayaletler hareket edebilir
  - Hayaletler görev yapmaya devam edebilir
  - Canlı oyuncular hayaletleri göremez
- Botların toplantıda daha akıllı konuşması
- Botların alibi/yalan üretmesi
- Botların uzun süreli gözlem hafızası:
  - Gördüğü oyuncuları hatırlar
  - Son oda geçmişini tutar
  - Şüphe skorunu zamanla artırır
- Oyun sonu istatistik ekranı
- Mobil uyumlu kontrol sistemi:
  - Dokunmatik joystick
  - Mobil aksiyon butonları
- Basit WebAudio ses efektleri ve düşük sesli arka plan tonu
- İnternetten oynanabilir deploy ayarları:
  - render.yaml
  - Procfile
  - Dockerfile
  - DEPLOY.md
- Ceset raporlama
- Acil toplantı
- Toplantı sohbeti
- Oylama
- Kazanma koşulları
- Özgün kozmetik sistemi:
  - Renk seçimi
  - Şapka
  - Vizör
  - Sırt aksesuarı
  - Mini dost/pet
- Kozmetik kilit açma sistemi:
  - Oyun sonu puana göre XP kazanılır
  - XP arttıkça yeni kozmetikler açılır
- Roller:
  - Mürettebat
  - Gölge
  - Taklitçi
  - Sis Hayaleti
  - Çürütücü
  - Alarmcı
  - Sorgucu
  - İz Sürücü
  - Mekanikçi
  - Doktor
  - Koruyucu Ruh
- Host ayarları:
  - Emergency cooldown
  - Kill cooldown
  - Shapeshift cooldown/duration
  - Phantom cooldown/duration
  - Çürütücü body dissolve time
  - Mekanikçi/Doktor/Koruyucu cooldown ayarları
  - Rol şansları
  - Görev sayısı
  - Oylama/tartışma süresi
  - Bot sayısı

## Bot zekası v0

Botlar şu an basit ama oynanabilir bir karar sistemi kullanır:

- Mürettebat botları görev hedeflerine gider.
- Yakındaki cesetleri veya Alarmcı uyarılarını raporlar.
- Gördükleri şüpheli oyunculara toplantıda oy verebilir.
- Gölge botları izole hedef arar.
- Kılık Değiştiren botlar uygun anda şekil değiştirir.
- Hayalet botlar uygun anda görünmez olur.
- Zehirci botun öldürdüğü ceset zamanla çözünür.

## Sonraki geliştirme önerileri

- Gerçek mini görev oyunları
- Harita çarpışmaları ve kapılar
- Sabotaj sistemi
- Kamera/Admin/Vitals panelleri
- Daha gelişmiş bot hafızası ve yalan söyleme sistemi
- Mobil uyumluluk
- Ses efektleri
- Sunucu listesi / bölge seçimi
- Kalıcı hesap ve kozmetik sistemi

## Stabilite testi

Sunucuyu ayrı bir terminalde başlat:

```bash
npm start
```

Başka terminalde kısa duman testini çalıştır:

```bash
npm run stability-test
```

Bu test oda oluşturma, WebSocket bağlantısı, parçalı frame okuma, oyun başlatma ve temel aksiyon akışlarını kontrol eder.
