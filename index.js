const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const app = express();
app.use(express.json({ limit: '10mb' }));

// Bekleme süresi (60 sn)
const TIMEOUT = 60000;

app.post('/get-messages', async (req, res) => {
    const { username, password, cookies } = req.body;
    let browser;

    try {
        console.log('Bot (V4 - Scraper) başlatılıyor...');
        browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080'],
            executablePath: '/usr/bin/google-chrome'
        });

        const page = await browser.newPage();
        page.setDefaultNavigationTimeout(TIMEOUT);
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

        // Cookie Yükleme
        if (cookies && Array.isArray(cookies)) {
            await page.setCookie(...cookies);
            console.log('Cookie yüklendi.');
        }

        console.log('Mesajlar sayfasına gidiliyor...');
        // Direkt mesajlara git
        await page.goto('https://banaozel.sahibinden.com/mesajlarim', { waitUntil: 'domcontentloaded' });

        // Eğer cookie süresi dolmuşsa ve login ekranına attıysa (Yedek Plan)
        if (page.url().includes('giris')) {
            console.log('Oturum düşmüş, tekrar giriş yapılıyor...');
            if (!username || !password) throw new Error("Oturum kapalı ve şifre yok.");
            await page.type('#username', username, { delay: 50 });
            await page.type('#password', password, { delay: 50 });
            await Promise.all([
                page.click('#userLoginSubmitButton'),
                page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
            ]);
        }

        // Mesaj listesinin yüklenmesini bekle (Selector değişebilir, genel body bekliyoruz)
        await page.waitForSelector('body');

        // --- VERİ ÇEKME İŞLEMİ (SCRAPING) ---
        console.log('Sayfa taraniyor...');
        const data = await page.evaluate(() => {
            // Sahibinden mesaj listesi yapısı (tahmini selectorlar)
            // Genellikle ul/li yapısındadır veya div tablosudur.
            // Burada genel bir tarama yapıyoruz.
            
            const messages = [];
            // Mesaj satırlarını bul (Sınıf isimleri örnektir, site yapısına göre güncellenir)
            // Sahibinden genelde 'message-list-item' veya benzeri kullanır.
            // Garanti olsun diye tüm listeyi çekmeye çalışalım.
            
            const rows = document.querySelectorAll('table tbody tr'); // Eğer tabloysa
            
            if (rows.length > 0) {
                rows.forEach(row => {
                    const text = row.innerText.split('\n'); // Satırdaki tüm yazıları al
                    if(text.length > 1) {
                         messages.push({
                            raw: row.innerText, // AI için ham veri
                            summary: text[0] // Genelde isim veya başlık
                        });
                    }
                });
            } else {
                // Eğer tablo değilse div/ul yapısıdır
                const items = document.querySelectorAll('li'); 
                items.forEach(item => {
                    if (item.innerText.includes('sahibinden.com') || item.innerText.length > 10) {
                         // Gereksiz menü elemanlarını elemek için basit filtre
                         messages.push({ text: item.innerText });
                    }
                });
            }
            
            return messages;
        });

        console.log(`${data.length} mesaj bulundu.`);
        
        // Sayfa başlığını da ekleyelim ki doğru yerde miyiz bilelim
        const title = await page.title();

        res.json({ 
            success: true, 
            pageTitle: title,
            count: data.length,
            messages: data // İşte burası AI'a gidecek
        });

    } catch (error) {
        console.error('Hata:', error.message);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (browser) await browser.close();
    }
});

app.listen(3000, () => console.log('Proxy V4 (Data Scraper) hazır.'));
