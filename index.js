const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const app = express();
app.use(express.json());

// Zaman aşımı ayarları (90 saniye)
const TIMEOUT = 90000; 

app.post('/get-messages', async (req, res) => {
    const { username, password } = req.body;
    let browser;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Eksik bilgi' });
    }

    try {
        console.log('Bot başlatılıyor...');
        browser = await puppeteer.launch({
            headless: "new",
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage',
                '--window-size=1920,1080'
            ],
            executablePath: '/usr/bin/google-chrome'
        });

        const page = await browser.newPage();
        
        // Genel zaman aşımını artır
        page.setDefaultNavigationTimeout(TIMEOUT);

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

        console.log('Giriş sayfasına gidiliyor...');
        await page.goto('https://secure.sahibinden.com/giris', { waitUntil: 'domcontentloaded' });

        console.log('Bilgiler giriliyor...');
        // Selector'ların yüklenmesini bekle
        await page.waitForSelector('#username', { visible: true });
        
        await page.type('#username', username, { delay: 100 });
        await page.type('#password', password, { delay: 100 });
        
        console.log('Giriş butonuna basılıyor...');
        
        // Navigation hatasını önlemek için Promise.all kullanımı
        await Promise.all([
            page.click('#userLoginSubmitButton'),
            // networkidle2 yerine domcontentloaded kullanıyoruz (daha hızlı ve az hata verir)
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: TIMEOUT }),
        ]);

        console.log('Mesajlar sayfasına geçiliyor...');
        // Giriş sonrası yönlendirmeyi bekle
        await page.goto('https://banaozel.sahibinden.com/mesajlarim', { waitUntil: 'domcontentloaded', timeout: TIMEOUT });

        // Sayfa başlığını al
        const pageTitle = await page.title();
        const content = await page.content();

        // Basit bir kontrol: Giriş yapıldı mı?
        if (content.includes("Giriş Yap") || content.includes("Üye Ol")) {
            console.log("Giriş başarısız olabilir, hala giriş ekranı görünüyor.");
            return res.json({ success: false, message: "Giriş yapılamadı veya Captcha çıktı.", title: pageTitle });
        }

        console.log('İşlem Başarılı!');
        res.json({ 
            success: true, 
            title: pageTitle, 
            message: "Mesajlar sayfasına erişildi." 
            // İstersen buraya content'i de ekleyebilirsin ama çok uzun olur
        });

    } catch (error) {
        console.error('Hata Detayı:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (browser) await browser.close();
    }
});

app.listen(3000, () => console.log('Sahibinden Bridge 3000 portunda (v2 - 90sn timeout) aktif.'));
