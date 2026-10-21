# TODO

Qoida: har bir bosqichdan keyin GitHub'ga push qilinadi, nima qilingani va keyin nima qilinishi shu faylga yoziladi.

## Hozir bajarilayotgan ish

- [x] Sahifalardagi tugmalar uchun mavjud frontend va backend testlarini tekshirish
- [x] Topilgan Neon/Django test ulanish xatosini tuzatish va qayta tekshirish

## Yakuniy holat

- [x] Backend testlari: 56 ta test muvaffaqiyatli
- [x] Frontend attendance/API testlari: 32 ta test muvaffaqiyatli
- [x] Frontend TypeScript tekshiruvi muvaffaqiyatli
- [x] QR va ultrasound oqimi foydalanuvchi tasdig'i asosida ishlayapti deb qabul qilindi
- [x] Django testlari endi Neon remote test bazasiga emas, izolyatsiyalangan SQLite memory bazasiga ishlaydi

## Keyingi rejalar

- [ ] Preview server ishga tushgach, foydalanuvchi oqimlarini brauzerda yakuniy smoke-test qilish

## Neon integratsiyasi

- [x] Neon integratsiyasi ulandi va status tekshirildi
- [x] Neon ulanishi read-only SQL bilan tekshirildi
- [x] Django migratsiyalari Neon bazasiga qo'llandi
- [x] Demo ma'lumotlar Neon bazasiga yuklandi: 24 talaba, 8 fan, 14 haftalik dars va umumiy demo kurs/davomat/topshiriqlar
- [ ] Neon integratsiyasining avtomatik schema ko'rinishi hali xato qaytarmoqda; amaliy SQL va jadval tekshiruvi ishlayapti

## Yakunlangan attendance tekshiruvi

- [x] QR skan, kod va ultrasound fallback ishlayapti deb qabul qilindi (foydalanuvchi tasdig'i asosida)
- [x] Attendance oqimi bo'yicha keyingi ishga o'tildi

## Keyingi rejalar

- [ ] Sahifalardagi tugmalarni bosib (topshiriq yuborish, baho qo'yish, davomat) amaliy tekshirish
- [ ] Topilgan xatolarni tuzatish va qayta tekshirish

## Bajarilgan ishlar jurnali (ketma-ket)

1. Backend (Django) GitHub `origin/main` bilan solishtirildi: 47 ta fayl, farq yo'q.
2. Demo ma'lumotlar `seed_demo_lms` orqali yaratildi: 26 foydalanuvchi, 9 kurs, 6 topshiriq, 50 topshiriq javobi, 19 dars, 95 davomat yozuvi.
3. Login endpointi `/api/login/` ekani aniqlandi; admin, ustoz va talaba akkauntlari 200 qaytardi.
4. Talaba sifatida kirish brauzerda tekshirildi, bosh sahifa demo ma'lumot bilan ochildi.
5. Talaba sahifalari (darslar, topshiriqlar, skaner, xabarlar, profil) xatosiz ochildi.
6. Admin kirdi: bosh sahifa, darslarim, topshiriqlar, taqvim, ta'lim boshqaruvi va admin boshqaruvi xatosiz ochildi.
7. Ustoz kirdi: bosh sahifa, darslarim, topshiriqlar, taqvim, ta'lim boshqaruvi va profil xatosiz ochildi.
8. Ustoz uchun admin-panel himoyalangani tasdiqlandi (rol tekshiruvi `admin-dashboard.tsx` da).
9. Django testlari remote Neon `test_neondb` bazasida qolib ketmasligi uchun test rejimi SQLite memory bazasiga ajratildi.
10. Neon uchun Django runtime ulanishida unpooled URL ustuvor qilindi; bu transaction va management commandlar uchun xavfsizroq.
11. Attendance worker testidagi `connection already closed` xatosi izolyatsiyalangan test bazasi bilan bartaraf etildi.
12. To'liq backend suite 56/56, frontend suite 32/32 va TypeScript tekshiruvi muvaffaqiyatli o'tdi.

## Demo akkauntlar

- Admin: `admin_demo` / `AdminDemo!2026`
- Ustoz: `ustoz_demo` / `UstozDemo!2026`
- Talaba: `talaba_demo` / `TalabaDemo!2026`
- Boshqa demo talabalarning paroli o'rnatilmagan (faqat `talaba_demo` bilan kiriladi)
