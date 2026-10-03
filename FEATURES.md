# MU LMS — yangilangan imkoniyatlar

| Yo‘nalish | Ustoz | Talaba |
| --- | --- | --- |
| Kurslar | O‘z kursini yaratish, arxivlash, talabani username orqali biriktirish/chiqarish | Faqat biriktirilgan kurslarni ko‘rish |
| Material | Kursga fayl yuklash, yuklab olish, o‘chirish | O‘z kursidagi faylni yuklab olish |
| Topshiriq | Yaratish/tahrirlash, muddat, 1–10 urinish, kechikishga ruxsat | Fayl yuborish, urinishlar tarixini ko‘rish |
| Baholash | Javobni yuklab olish, 0–100 ball va izoh | O‘z bahosi va ustoz izohini ko‘rish |
| Davomat | Dars yaratish, keldi/kelmadi/kechikdi/sababli belgilash va tuzatish | Faqat o‘z davomatini ko‘rish |
| Taqvim | Kurs tadbirlarini yaratish/o‘chirish | O‘z kursi tadbirlarini ko‘rish |
| Profil | Ism, email va bio | Ism, email va bio |

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
- Davomat belgilanmagan holat avtomatik ravishda “kelmadi” hisoblanmaydi. Bo‘sh qiymat bilan saqlash avvalgi belgini tozalaydi.
- Fayllar 20 MB gacha; hujjat, jadval, matn va tasvir kengaytmalari cheklangan. Antivirus tekshiruvi hali ulanmagan.
- Django 5.2.17, SimpleJWT 5.5.1, Next.js 15.5.27; Django migratsiyalari eski yozuvlarni saqlaydi.

## Ishga tushirish

README.md dagi Docker yoki mahalliy yo‘riqnomadan foydalaning. Talaba ro‘yxatdan o‘tadi; administrator ustoz rolini beradi; ustoz kurs ochib talabani username bilan biriktiradi. Keyin material/topshiriq/davomat haqiqiy API orqali ishlaydi.

HEMIS integratsiyasi, avtomatik parol tiklash, video hosting va universitet bo‘yicha rasmiy hisobotlar bu versiyada yo‘q. Internetga joylash va universitet qabul sinovi alohida bajarilishi kerak.
