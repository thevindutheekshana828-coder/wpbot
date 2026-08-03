const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// පරිගණකයේ නම් වින්ඩෝස් ක්‍රෝම් පාත් එක ද, Railway (Cloud) එකේ නම් ඔටෝ ඩිடெක්ට් වීමට සැකසීම
const puppeteerConfig = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
};

// ඔබගේ පරිගණකයේ ක්‍රෝම් ඇති තැන (Railway එකේදී මෙය ස්වයංක්‍රීයව ලිනක්ස් ක්‍රෝම් ලබා ගනී)
if (process.platform === 'win32') {
    puppeteerConfig.executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
}

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: puppeteerConfig
});

client.on('qr', (qr) => {
    console.log('📌 පහත QR කේතය ස්කෑන් කරන්න:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ බොට් සාර්ථකව සූදානම් සහ 24 පැයම ක්‍රියාත්මක වීමට සූදානම්!');
});

client.on('message', async (msg) => {
    if (msg.fromMe) return;

    const messageContent = msg.body.trim();
    const sender = msg.from;
    console.log("📥 ලැබුණු පණිවිඩය:", messageContent);

    if (messageContent.startsWith('http://') || messageContent.startsWith('https://')) {
        await msg.reply('⏳ ලින්ක් එක ලැබුණා! ෆයිල් එක ඩවුන්লোড වෙමින් පවතී, කරුණාකර ටිකක් රැඳී සිටින්න...');

        const filePath = path.resolve(__dirname, 'downloaded_file');
        let finalPath = filePath;

        try {
            const urlPath = new URL(messageContent).pathname;
            let fileName = path.basename(urlPath);
            
            if (!fileName || !fileName.includes('.')) {
                fileName = 'file.mp4';
            }

            finalPath = path.resolve(__dirname, fileName);

            const response = await axios({
                method: 'GET',
                url: messageContent,
                responseType: 'stream',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': '*/*',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive'
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });

            const writer = fs.createWriteStream(finalPath);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            console.log(`✅ ඩවුන්ලෝඩ් සාර්ථකයි: ${fileName}. දැන් WhatsApp වෙත යවමින් පවතී...`);
            await msg.reply('📤 ඩවුන්ලෝඩ් කිරීම සාර්ථකයි! දැන් එය WhatsApp වෙත අප්ලෝඩ් වෙමින් පවතී...');

            const media = MessageMedia.fromFilePath(finalPath);
            await client.sendMessage(sender, media, { caption: `📁 ඔබ ඉල්ලූ ෆයිල් එක මෙන්න: ${fileName}` });

            console.log("✅ ෆයිල් එක සාර්ථකව වට්සප් වෙත යවන ලදී!");

            if (fs.existsSync(finalPath)) {
                fs.unlinkSync(finalPath);
            }

        } catch (error) {
            console.error("❌ දෝෂයක්:", error.message);
            await msg.reply('❌ මෙම ලින්ක් එකෙන් ෆයිල් එක ඩවුන්লোড කර ගැනීමට නොහැකි විය.');
            if (fs.existsSync(finalPath)) {
                fs.unlinkSync(finalPath);
            }
        }
    } else {
        await msg.reply('👋 කරුණාකර ඩවුන්লোড කිරීමට අවශ්‍ය ඕනෑම **Direct Link** එකක් එවන්න.');
    }
});

client.initialize();