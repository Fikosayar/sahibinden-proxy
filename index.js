const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const app = express();
app.use(express.json({ limit: '10mb' })); // Büyük cookie verileri için limit artırımı

const TIMEOUT = 60000; // 60 Saniye

app.post('/get-messages', async (req, res) => {
    const { username, password, cookies } = req.body;
    let browser;

    try {
        console.log('Bot (V3) başlatılıyor...');
        browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080'],
            executablePath: '/usr/bin/google-chrome'
        });

        const page = await browser.newPage();
        page.setDefaultNavigationTimeout(TIMEOUT);
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

        // EĞER COOKIE GELDİYSE YÜKLE
        if (cookies && Array.isArray(cookies)) {
            console.log(`${cookies.length} adet cookie yükleniyor...`);
            await page.setCookie(...cookies);
        }

        console.log('Hedef sayfaya gidiliyor...');
        // Cookie varsa direkt mesajlara gitmeyi dene, yoksa login sayfasına git
        const targetURL = (cookies) ? 'https://banaozel.sahibinden.com/mesajlarim' : 'https://secure.sahibinden.com/giris';
        
        await page.goto(targetURL, { waitUntil: 'domcontentloaded' });

        // Login sayfasındaysak (Cookie çalışmadıysa veya yoksa) giriş yap
        const url = page.url();
        if (url.includes('giris')) {
            console.log('Login ekranındayız, manuel giriş deneniyor...');
            if (!username || !password) throw new Error("Cookie geçersiz ve kullanıcı bilgisi yok.");
            
            await page.type('#username', username, { delay: 100 });
            await page.type('#password', password, { delay: 100 });
            await Promise.all([
                page.click('#userLoginSubmitButton'),
                page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
            ]);
        }

        // Kontrol et: SMS ekranı mı?
        const content = await page.content();
        if (content.includes("Doğrulama Kodu") || content.includes("verification code")) {
            throw new Error("SMS Doğrulaması isteniyor! Lütfen Cookie yöntemini kullanın.");
        }

        console.log('Başarılı! Veri çekiliyor...');
        const pageTitle = await page.title();
        
        res.json({ success: true, title: pageTitle, message: "Sayfa açıldı." });

    } catch (error) {
        console.error('Hata:', error.message);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (browser) await browser.close();
    }
});

app.listen(3000, () => console.log('Proxy V3 (Cookie Destekli) 3000 portunda.'));
