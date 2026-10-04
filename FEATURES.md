# MU LMS — yangilangan imkoniyatlar

| Yo‘nalish | Ustoz | Talaba |
| --- | --- | --- |
| Kurslar | O‘z kursini yaratish, arxivlash, talabani username orqali biriktirish/chiqarish | Faqat biriktirilgan kurslarni ko‘rish |
| Material | Kursga fayl yuklash, yuklab olish, o‘chirish | O‘z kursidagi faylni yuklab olish |
| Topshiriq | Yaratish/tahrirlash, muddat, 1–10 urinish, kechikishga ruxsat | Fayl yuborish, urinishlar tarixini ko‘rish |
| Baholash | Javobni yuklab olish, 0–100 ball va izoh | O‘z bahosi va ustoz izohini ko‘rish |
| Davomat | Dars yaratish, Keldi/Kech qoldi/Kelmadi/Sababli override, 5 soniyalik dinamik QR va ultrasound broadcast, lokatsiya radiusi, yakunlash | Faol sessiyada ultrasound yoki QR + yangi GPS bilan check-in, o‘z davomatini ko‘rish |
| Taqvim | Kurs tadbirlarini yaratish/o‘chirish | O‘z kursi tadbirlarini ko‘rish |
| Profil | Ism, email, bio va joriy parol bilan parolni o‘zgartirish | Ism, email, bio va joriy parol bilan parolni o‘zgartirish |

Administrator Django admin orqali rollarni, eski ma’lumotlarning kursga tegishliligini va akkaunt faolligini boshqaradi. Ustoz bo‘lish ochiq ro‘yxatdan o‘tish orqali berilmaydi.

## Soddalashtirilgan qismlar

- Soxta kirish, soxta baholar, ishlamaydigan video/diskussiya/progress va ortiqcha reklama boshqaruvlari olib tashlandi.
- Takroriy API manzillar moslik uchun saqlandi, biroq bitta umumiy ruxsat tekshiruviga ulandi.
- Ommaviy barcha baholar endpointi va ishlatilmayotgan mock-data/config fayllari olib tashlandi.
- Eski shaxsiy maydonlar bazada saqlandi; yangi profilda ortiqcha ma’lumot talab qilinmaydi.
- `/preview` faqat aniq belgilangan namunaviy dizayn; haqiqiy tizim ma’lumoti sifatida ko‘rsatilmaydi.

## Muhim qoidalar

- Talaba o‘ziga baho qo‘ya olmaydi, o‘zini kursga biriktira olmaydi va boshqa talabaning javobini yuklab ololmaydi.
- Yuborilgan javobi bor topshiriq o‘chirilmaydi. Kurs o‘chirish o‘rniga arxivlanadi; arxivlangan kursga yangi javob qabul qilinmaydi.
- Talabani kursdan chiqarish uning akkaunti va eski javoblarini o‘chirmaydi; kursga kirishini bekor qiladi.
- Baho sahifasi har topshiriqning eng so‘nggi baholangan urinishini hisoblaydi. Barcha urinishlar topshiriq tarixida saqlanadi.
- Manual davomatda belgilanmagan holat avtomatik “kelmadi” bo‘lmaydi. Avtomatik sessiya yakunlanganda esa check-in qilmagan aktiv kurs talabalari `absent` sifatida qayd etiladi; ustoz keyin qo‘lda tuzata oladi.
- Avtomatik davomat hozir BLEsiz ishlaydi: server-signed 5 soniyalik QR fallback + 8 belgili vaqtinchalik ultrasound kodi + scan vaqtida olinadigan yangi lokatsiya/accuracy/radius tekshiruvi. QR kamera mavjud qurilmada zoom va continuous focusni avtomatik qo‘llaydi. BLE kelajakdagi universitet tasdig‘idan keyingi bosqich sifatida qoldirilgan.
- Davomat oynasi kursdagi aktiv talabalar soniga qarab avtomatik kengayadi (30 talabagacha 3 daqiqa, keyin har qo‘shimcha 30 talaba uchun +1 daqiqa, maksimum 10 daqiqa); `late` chegarasi shu oynaga mos hisoblanadi.
- Material/topshiriq biriktirma fayllari 20 MB gacha; talabaning Submission fayli 10 MB gacha. Xavfsiz allowlist ishlatiladi (`.pdf`, Office, matn, rasm va `.zip`); `.html`, `.svg`, `.js`, `.exe`, `.sh` kabi active/xavfli formatlar qabul qilinmaydi. Yuklab olishlar attachment + `X-Content-Type-Options: nosniff` bilan beriladi. Antivirus/malware scanning hali ulanmagan.
- Django 5.2.17, SimpleJWT 5.5.1, Next.js 15.5.27; Django migratsiyalari eski yozuvlarni saqlaydi.

## Ishga tushirish

README.md dagi Docker yoki mahalliy yo‘riqnomadan foydalaning. Talaba ro‘yxatdan o‘tadi; administrator ustoz rolini beradi; ustoz kurs ochib talabani username bilan biriktiradi. Keyin material/topshiriq/davomat haqiqiy API orqali ishlaydi.

Notification tizimi ishlaydi: `Notification` modeli, assignment/material/course/submission/grade triggerlari, foydalanuvchining private GET/read/read-all API’lari va frontend notification bell mavjud.

HEMIS integratsiyasi, email verification, ommaviy/avtomatik parol tiklash, video hosting va universitet bo‘yicha rasmiy hisobotlar bu versiyada yo‘q. Parolini unutgan foydalanuvchi uchun reset faqat administrator tomonidan Django admin orqali bajariladi. Internetga joylash va universitet qabul sinovi alohida bajarilishi kerak.
