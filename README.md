<div align="center">

# 📱 WhatsApp Bulk Message Sender

### 🔄 Infinite Loop Mode • 👥 Multi-User Support • ⚡ Real-time Monitoring

![Node.js](https://img.shields.io/badge/Node.js-16+-green?style=for-the-badge&logo=node.js)
![Express](https://img.shields.io/badge/Express-4.18-blue?style=for-the-badge&logo=express)
![Baileys](https://img.shields.io/badge/Baileys-Latest-purple?style=for-the-badge)

**Send unlimited WhatsApp messages in continuous loop mode with beautiful glassmorphism UI**

</div>

---

## ✨ Features

🔄 **Infinite Loop Mode** - Messages automatically repeat until stopped  
👥 **Multi-User Support** - Handle multiple campaigns simultaneously  
⚡ **Real-time Progress** - Live tracking with loop counter & total messages  
🎨 **Beautiful UI** - Glassmorphism design with smooth animations  
🔒 **Auto Cleanup** - Sessions automatically deleted after stop  
📊 **Batch Management** - Monitor all active campaigns in one place

---

## 🚀 Quick Start

### 1. Installation

```
# Clone repository
git clone https://github.com/yourusername/whatsapp-bulk-sender.git
cd whatsapp-bulk-sender

# Install dependencies
npm install

# Start server
node server.js
```

### 2. Open Browser

```
http://localhost:3000
```

### 3. Upload & Send

1. Upload your `creds.json` (WhatsApp credentials)
2. Upload your `messages.txt` (one message per line)
3. Enter target number with country code (e.g., 91XXXXXXXXXX)
4. Set delay between messages (seconds)
5. Add message prefix (e.g., "From: John")
6. Click **Start Sending** 🚀

---

## 📁 Project Structure

```
whatsapp-bulk-sender/
├── public/
│   ├── index.html       # Frontend UI
│   ├── style.css        # Glassmorphism styling
│   └── script.js        # Client logic
├── sessions/            # User sessions (auto-created)
├── uploads/             # Temp files (auto-created)
├── server.js            # Main server
├── package.json         # Dependencies
└── README.md            # You are here
```

---

## 🎯 Message Format

**Input:**
```
Prefix: From: John
Message: Hello! Check our offers
```

**Output:**
```
From: John Hello! Check our offers
```

Single line format - no line breaks between prefix and message!

---

## 📡 API Endpoints

### POST `/start-sending`
Start new campaign (FormData with files)

### POST `/stop-sending`
Stop running campaign (JSON with batchId)

### GET `/all-batches`
Get all active batches with real-time status

### GET `/health`
Server health check

---

## 🛡️ Security & Best Practices

⚠️ **Important:**
- Keep `creds.json` private
- Use delays of 5+ seconds to avoid bans
- Test with small batches first
- Follow WhatsApp Terms of Service
- Don't spam people

---

## 🐛 Troubleshooting

**Files not uploading?**  
✅ Check file formats (.json for creds, .txt for messages)

**Connection issues?**  
✅ Verify internet connection & valid creds.json

**Messages not sending?**  
✅ Ensure proper phone format & sufficient delay

---

## 📦 Dependencies

```
{
  "@whiskeysockets/baileys": "latest",
  "express": "^4.18.2",
  "pino": "^8.16.0",
  "multer": "^1.4.5-lts.1",
  "uuid": "^9.0.1"
}
```

---

## 📝 License

MIT License - Use freely with attribution

---

## ⚠️ Disclaimer

Educational purposes only. Users responsible for compliance with WhatsApp ToS and local laws. Developers not liable for misuse.

---

<div align="center">

**Made with ❤️ for bulk messaging**

⭐ Star this repo if you found it helpful!

</div>
```

***
