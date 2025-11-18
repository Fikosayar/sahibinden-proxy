const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Cloudflare ve Bot korumasını atlatmak için gizlilik eklentisi
puppeteer.use(StealthPlugin());

const app = express();
app.use(express.json());

app.post('/get-messages', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });
    }

    console.log('Bot başlatılıyor...');
    let browser;

    try {
        browser = await puppeteer.launch({
            headless: "new", // Tarayıcıyı arkaplanda çalıştır
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ],
            executablePath: '/usr/bin/google-chrome' // Docker içindeki Chrome yolu
        });

        const page = await browser.newPage();
        
        // Bot tespit edilmemesi için User-Agent ayarı
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

        console.log('Giriş sayfasına gidiliyor...');
        await page.goto('https://secure.sahibinden.com/giris', { waitUntil: 'networkidle2' });

        // Giriş bilgilerini doldur (Selector'lar değişebilir, kontrol edilmeli)
        console.log('Giriş yapılıyor...');
        await page.type('#username', username, { delay: 100 }); // İnsansı yazma hızı
        await page.type('#password', password, { delay: 100 });
        
        await Promise.all([
            page.click('#userLoginSubmitButton'), // Giriş butonu ID'si
            page.waitForNavigation({ waitUntil: 'networkidle2' }),
        ]);

        console.log('Mesajlar sayfasına gidiliyor...');
        await page.goto('https://banaozel.sahibinden.com/mesajlarim', { waitUntil: 'networkidle2' });

        // Mesaj listesini HTML'den çek (Basit bir örnek selector)
        const messages = await page.evaluate(() => {
            // Bu kısım tarayıcı içinde çalışır (DOM manipülasyonu)
            const msgElements = document.querySelectorAll('.message-list-item'); // Sınıf adı örnektir
            const data = [];
            
            msgElements.forEach(el => {
                const sender = el.querySelector('.sender-name')?.innerText;
                const preview = el.querySelector('.message-preview')?.innerText;
                const date = el.querySelector('.message-date')?.innerText;
                
                if(sender) {
                    data.push({ sender, preview, date });
                }
            });
            return data;
        });

        console.log(`${messages.length} mesaj bulundu.`);
        res.json({ success: true, data: messages });

    } catch (error) {
        console.error('Hata:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Sahibinden Bridge ${PORT} portunda çalışıyor`);
});
