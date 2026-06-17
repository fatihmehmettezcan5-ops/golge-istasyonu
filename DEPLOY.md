# Deploy Rehberi

Bu proje statik bir site değildir; Node.js + WebSocket sunucusu çalıştırır. Bu yüzden GitHub Pages veya Netlify tek başına uygun değildir.

## Önerilen: Render

1. Projeyi GitHub'a yükle.
2. Render > New > Web Service seç.
3. Repository olarak `golge-istasyonu` seç.
4. Ayarlar:
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Deploy et.

`render.yaml` dosyası bu ayarları otomatikleştirmek için eklidir.

## Railway

- New Project > Deploy from GitHub Repo
- Start command: `npm start`
- Railway `PORT` değişkenini verir; `server.js` bunu otomatik kullanır.

## Fly.io / VPS / Docker

Docker ile:

```bash
docker build -t golge-istasyonu .
docker run -p 8080:8080 golge-istasyonu
```

VPS üzerinde:

```bash
npm install
npm start
```

Daha stabil üretim için `pm2` + `nginx reverse proxy` + HTTPS önerilir.

## Önemli notlar

- Oda kodları RAM'de tutulur. Sunucu yeniden başlarsa açık odalar silinir.
- Ücretsiz Render planında sunucu uykuya geçebilir; ilk açılış yavaş olabilir.
- Kalıcı hesap/profil için ileride veritabanı gerekir. Şu an profil/XP tarayıcı localStorage içinde tutulur.
