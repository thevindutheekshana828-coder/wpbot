const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const express = require('express');

// 1. Free Server එක Sleep වීම වැළැක්වීමට කුඩා Web Server එකක් සෑදීම
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🤖 WhatsApp Movie Bot is Alive and Running 24/7!');
});

app.listen(PORT, () => {
    console.log(`🌐 Web Server running on port ${PORT}`);
});

// 2. WhatsApp Bot එක ආරම්භ කිරීම
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        auth: state,
        browser: Browsers.ubuntu('Chrome'),
        syncFullHistory: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('📌 අලුත් QR Code එක Scan කරන්න:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log('සම්බන්ධතාවය බිඳ වැටුණා. නැවත සම්බන්ධ වෙමින්...', shouldReconnect);
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log('✅ WhatsApp බොට් සාර්ථකව සම්බන්ධ විය!');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
            const sender = msg.key.remoteJid;

            if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
                
                await sock.sendMessage(sender, { text: '🎬 Movie එක Server එකට Download වෙමින් පවතියි, මදක් රැඳී සිටින්න...' });

                const filePath = path.join(__dirname, `temp_${Date.now()}.mp4`);

                const response = await axios({
                    method: 'GET',
                    url: text,
                    responseType: 'stream',
                    timeout: 0,
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity
                });

                const writer = fs.createWriteStream(filePath);
                response.data.pipe(writer);

                writer.on('finish', async () => {
                    try {
                        await sock.sendMessage(sender, { text: '⬆️ Download වී අවසන්! දැන් WhatsApp එකට Upload වෙනවා...' });

                        await sock.sendMessage(sender, {
                            document: { url: filePath },
                            mimetype: 'video/mp4',
                            fileName: 'Movie.mp4'
                        });

                        await sock.sendMessage(sender, { text: '✅ සාර්ථකව යවා අවසන් කෙරිණි!' });
                    } catch (uploadError) {
                        console.error('Upload Error:', uploadError);
                        await sock.sendMessage(sender, { text: '❌ WhatsApp එකට Upload කිරීමේදී දෝෂයක් ආවා.' });
                    } finally {
                        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                    }
                });

                writer.on('error', (err) => {
                    console.error('Download Error:', err);
                    sock.sendMessage(sender, { text: '❌ Link එකෙන් Download කිරීමේදී දෝෂයක් සිදු විය.' });
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                });
            }
        } catch (error) {
            console.error('Message Processing Error:', error);
        }
    });
}

startBot();