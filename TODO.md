# TODO

Qoida: har bir bosqichdan keyin GitHub'ga push qilinadi, nima qilingani va keyin nima qilinishi shu faylga yoziladi.

## Hozir bajarilayotgan ish

- [ ] Admin va ustoz akkauntlari bilan kirib, ularning sahifalaridagi tugmalarni tekshirish

## Keyingi rejalar

- [ ] Brauzerda attendance oqimini (QR skan, kod, ultrasound fallback) backend bilan birga tekshirish
- [ ] Topilgan xatolarni tuzatish va qayta tekshirish

## Bajarilgan ishlar jurnali (ketma-ket)

1. Backend (Django) GitHub `origin/main` bilan solishtirildi: 47 ta fayl, farq yo'q.
2. Demo ma'lumotlar `seed_demo_lms` orqali yaratildi: 26 foydalanuvchi, 9 kurs, 6 topshiriq, 50 topshiriq javobi, 19 dars, 95 davomat yozuvi.
3. Login endpointi `/api/login/` ekani aniqlandi; admin, ustoz va talaba akkauntlari 200 qaytardi.
4. Talaba sifatida kirish brauzerda tekshirildi, bosh sahifa demo ma'lumot bilan ochildi.
5. Talaba sahifalari (darslar, topshiriqlar, skaner, xabarlar, profil) xatosiz ochildi.

## Demo akkauntlar

- Admin: `admin_demo` / `AdminDemo!2026`
- Ustoz: `ustoz_demo` / `UstozDemo!2026`
- Talaba: `talaba_demo` / `TalabaDemo!2026`
- Boshqa demo talabalarning paroli o'rnatilmagan (faqat `talaba_demo` bilan kiriladi)
