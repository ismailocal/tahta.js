# Tahta.js 🖌️

Modern, hafif ve genişletilebilir bir HTML5 Canvas tabanlı beyaz tahta (whiteboard) kütüphanesi.

## 🔗 [Canlı Demo](https://ismailocal.github.io/tahta.js/)

## ✨ Özellikler

-   **Sezgisel Araçlar**: Seçim, El (Gezinti), Şekiller (Dikdörtgen, Elips, Çizgi, Ok), Serbest Çizim, Silgi ve Yazı araçları.
-   **Akıllı Render Sistemi**: Spatial Indexing (Mekansal İndeksleme) ile optimize edilmiş yüksek performanslı çizim.
-   **Olay Odaklı Mimari**: EventBus ile tamamen ayrıştırılmış çekirdek mantığı.
-   **Geçmiş Yönetimi**: Gömülü Geri Al (Undo) / İleri Al (Redo) desteği.
-   **Modern Arayüz**: Hızlı entegrasyon için minimal ve şık kullanıcı arayüzü bileşenleri.

## 🚀 Hızlı Başlangıç

Projeyi yerel ortamda çalıştırmak için:

```bash
# Python kullanarak
python3 -m http.server 3000

# Veya bir statik sunucu paketiyle
npx serve .
```

Ardından tarayıcınızda `http://localhost:3000` adresini ziyaret edin.

## 📦 Temel Kullanım

`Tahta.js` kolayca herhangi bir HTML elementine monte edilebilir:

```javascript
import { mountCanvas } from './src/index.js';

const root = document.getElementById('app');
const canvas = document.createElement('canvas');
root.appendChild(canvas);

// Whiteboard'u başlat
const { store, bus, destroy } = mountCanvas(root, canvas);
```

## 🏗️ Mimari Yapı

-   **Core**: State yönetimi (Store), render motoru ve girdi yönetimi.
-   **Tools**: Fare ve klavye etkileşimlerini yöneten bağımsız araç sınıfları.
-   **Plugins**: Şekil çizim ve render mantığını genişleten eklenti sistemi.
-   **Spatial Index**: Büyük sahnelerde bile hızlı nesne sorgulama ve seçim.

---

Geliştirici: [ismailocal](https://github.com/ismailocal)
