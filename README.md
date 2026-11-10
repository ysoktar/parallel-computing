# Paralel Hesaplama: 2. ara sınav çalışma sitesi

BİL 455/533 Paralel Hesaplama (TOBB ETÜ, 2026 Güz) için iki dilli (Türkçe/İngilizce) etkileşimli bir çalışma sitesi. Ders
slaytlarını (Lecture 1–6), alıştırmaları ve ders notlarını izler; öncelik 11 Kasım'daki 2. ara sınav (CUDA).

- **2. vize rehberi**: kapsam ve öncelikler (duyuruya göre), ezberlenecek indeks formülleri, çözümlü sınav tipi sorular
  (`<<<(3,3),(8,32)>>>` ile tiled matmul eşlemesi, "bu kod nerelere dokunuyor", shared memory, `__syncthreads()`,
  coalescing, sayısal sorular) ve bir deneme seti.
- **İndeks ve coalescing laboratuvarı**: grid/blok konfigürasyonundan thread → (row, col) eşlemesi ve warp'lar, rastgele
  indeks antrenmanı, bir warp'ın dokunduğu 32/128 B segmentler, tiled matmul'ün faz faz görselleştirmesi.
- **Coalescing, transpose, unrolling**: Lecture 6'nın global bellek kısmı, NVIDIA'nın transpose kernel serisi (copy, naive,
  shared memory), loop unrolling.
- **Lecture 4–6** (CUDA) ve **Lecture 1–3** (1. vize konuları) sayfaları, her biri sınama sorularıyla.
- **Kopya kâğıdı planı**: el yazısı A4'e ne yazılmalı.

Slaytların dışında kalan (derste anlatılan) içerik "derste" etiketiyle, sınav kapsamı dışındaki içerik (shared memory bank
conflict'leri) "finalde" etiketiyle işaretlidir.

## Kodları çalıştırma

Sitedeki her kod bloğu `site/code/` altındaki tam bir programa bağlıdır (blokta gösterilen kod programda satır satır
vardır; testler bunu kontrol eder). ▶ Çalıştır düğmesi programı **sayfayı görüntüleyen bilgisayarda** derleyip
çalıştırır: `site/tools/runner.py` (Python 3, bağımlılıksız) indirilip `python3 runner.py` ile başlatılır;
127.0.0.1:7457'yi dinler ve sadece sitenin kendi isteklerini kabul eder. C/C++ `g++`/`clang++` ile CPU'da, CUDA `nvcc`
ile GPU'da çalışır. ✎ Düzenle ile kaynak, derleyici bayrakları ve program argümanları değiştirilebilir.

## Geliştirme

Node 20 veya üstü gerekir; bağımlılık yok.

```sh
npm run dev     # site/ klasörünü http://localhost:8000 adresinde sunar
npm test        # site yapısı: iki dilde sayfalar, bağlantılar, çapalar, sınama soruları
npm run build   # yayınlanacak siteyi dist/ klasörüne yazar
```

## Yerleşim

| Yol | İçerik |
|---|---|
| `site/*.html` | Türkçe sayfalar |
| `site/en/*.html` | İngilizce sayfalar (aynı dosya adları) |
| `site/js/layout.js` | menü, başlık, sağdaki içindekiler, sınama soruları, kod renklendirme; site haritası (`NAV`) |
| `site/js/widgets.js` | etkileşimli araçlar (mapping, drill, coalesce, tiling) |
| `test/` | `node --test` testleri |
| `.github/workflows/pages.yml` | test, build ve GitHub Pages'e yayın |

## Yayın

İş akışı her push'ta test ve build yapar; yalnızca `main` dalından yayın yapar (**Settings → Pages → Source: GitHub
Actions**). Site `https://<owner>.github.io/parallel-computing/` adresinde yayınlanır.
