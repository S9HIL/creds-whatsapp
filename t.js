const express = require('express');
const fs = require('fs');
const { makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = 3000;

// Ensure directories
if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads', { recursive: true });
if (!fs.existsSync('./sessions')) fs.mkdirSync('./sessions', { recursive: true });
if (!fs.existsSync('./public')) fs.mkdirSync('./public', { recursive: true });

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, './uploads'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.use(express.static('public'));
app.use(express.json());

let activeSockets = {};
let messageProcesses = {};

// Delay function
const delay = (ms, isStopped) => {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      if (isStopped()) {
        clearInterval(interval);
        resolve(true);
      }
      if (Date.now() - startTime >= ms) {
        clearInterval(interval);
        resolve(false);
      }
    }, 100);
  });
};

// Initialize WhatsApp
async function initWhatsAppFromCreds(sessionId) {
  try {
    const sessionPath = `./sessions/${sessionId}`;
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    
    const socket = makeWASocket({
      logger: pino({ level: 'fatal' }),
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.ubuntu('Chrome'),
      getMessage: async (key) => ({ conversation: 'hello' })
    });

    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === 'open') {
        console.log(`✅ Connected: ${sessionId.substring(0,6)}`);
      }

      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log(`❌ Closed: ${sessionId.substring(0,6)} - Reconnect: ${shouldReconnect}`);
        
        if (shouldReconnect) {
          setTimeout(() => initWhatsAppFromCreds(sessionId), 5000);
        }
      }
    });

    socket.ev.on('creds.update', saveCreds);
    activeSockets[sessionId] = socket;
    return socket;

  } catch (error) {
    console.error('Init error:', error.message);
    throw error;
  }
}

// Send Messages in LOOP mode
async function sendMessages(batchId, socket) {
  const process = messageProcesses[batchId];
  if (!process) return;

  try {
    let loopCount = 0;
    
    // Infinite loop until stopped
    while (!process.isStopped) {
      loopCount++;
      console.log(`🔄 [${batchId.substring(0,6)}] Loop #${loopCount} started`);
      
      for (let i = 0; i < process.messageLines.length; i++) {
        if (process.isStopped) {
          process.status = 'stopped';
          console.log(`🛑 [${batchId.substring(0,6)}] Stopped by user`);
          return;
        }

        const messageText = process.messageLines[i];
        
        // Format: hatersName + message (single line, space separated)
        const fullMessage = `${process.hatersName} ${messageText}`;
        
        const jid = `${process.targetNumber}@s.whatsapp.net`;
        
        await socket.sendMessage(jid, { text: fullMessage });
        
        process.currentIndex = i + 1;
        process.totalSent = (loopCount - 1) * process.messageLines.length + i + 1;
        
        console.log(`📩 [${batchId.substring(0,6)}] Loop ${loopCount} | Msg ${i + 1}/${process.messageLines.length}`);

        // Delay between messages
        if (i < process.messageLines.length - 1 || true) { // Always delay
          const isStopped = await delay(process.delayTime * 1000, () => process.isStopped);
          if (isStopped) {
            process.status = 'stopped';
            console.log(`🛑 [${batchId.substring(0,6)}] Stopped during delay`);
            return;
          }
        }
      }
      
      // Reset index for next loop
      process.currentIndex = 0;
      process.loopCount = loopCount;
      
      console.log(`✅ [${batchId.substring(0,6)}] Loop #${loopCount} completed. Total sent: ${process.totalSent}`);
      
      // Small delay before next loop
      await delay(2000, () => process.isStopped);
    }

  } catch (error) {
    console.error(`❌ Error in batch ${batchId.substring(0,6)}:`, error.message);
    process.status = 'error';
    process.error = error.message;
  }
}

// Cleanup session
function cleanupSession(sessionId) {
  try {
    const sessionPath = `./sessions/${sessionId}`;
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      console.log(`🗑️ Cleaned: ${sessionId.substring(0,6)}`);
    }
    
    if (activeSockets[sessionId]) {
      delete activeSockets[sessionId];
    }
  } catch (error) {
    console.error('Cleanup error:', error.message);
  }
}

// ====================== APIs ======================

// Start sending
app.post('/start-sending', upload.fields([
  { name: 'credsFile', maxCount: 1 },
  { name: 'messageFile', maxCount: 1 }
]), async (req, res) => {
  console.log('📥 New request received');

  try {
    const { targetNumber, delayTime, hatersName } = req.body;

    if (!req.files || !req.files.credsFile || !req.files.messageFile) {
      return res.status(400).json({ 
        success: false, 
        message: 'Both files required!' 
      });
    }

    if (!targetNumber || !delayTime || !hatersName) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields required!' 
      });
    }

    // Generate unique IDs
    const batchId = uuidv4();
    const sessionId = uuidv4();

    console.log(`🆔 Batch: ${batchId.substring(0,6)} | Session: ${sessionId.substring(0,6)}`);

    // Create session folder
    const sessionPath = `./sessions/${sessionId}`;
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }

    // Copy creds.json
    const uploadedCredsPath = req.files.credsFile[0].path;
    const sessionCredsPath = path.join(sessionPath, 'creds.json');
    fs.copyFileSync(uploadedCredsPath, sessionCredsPath);

    // Validate creds
    try {
      JSON.parse(fs.readFileSync(sessionCredsPath, 'utf-8'));
      console.log('✅ Creds validated');
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: 'Invalid creds.json format'
      });
    }

    // Read messages
    const messageFilePath = req.files.messageFile[0].path;
    const messageLines = fs.readFileSync(messageFilePath, 'utf-8')
      .split('\n')
      .filter(line => line.trim());

    console.log(`📝 Loaded ${messageLines.length} messages`);

    if (messageLines.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message file is empty!'
      });
    }

    // Initialize WhatsApp
    console.log('🔌 Connecting to WhatsApp...');
    const socket = await initWhatsAppFromCreds(sessionId);

    // Wait for stable connection
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Store process
    messageProcesses[batchId] = {
      sessionId,
      targetNumber,
      messageLines,
      hatersName,
      delayTime: parseInt(delayTime),
      currentIndex: 0,
      totalMessages: messageLines.length,
      totalSent: 0,
      loopCount: 0,
      isStopped: false,
      status: 'running',
      createdAt: new Date()
    };

    // Start sending in background
    sendMessages(batchId, socket);

    // Cleanup uploaded files
    setTimeout(() => {
      try {
        fs.unlinkSync(uploadedCredsPath);
        fs.unlinkSync(messageFilePath);
        console.log('🗑️ Uploaded files cleaned');
      } catch (err) {}
    }, 2000);

    res.json({ 
      success: true, 
      batchId,
      message: 'Sending started in LOOP mode!',
      totalMessages: messageLines.length
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Stop sending
app.post('/stop-sending', (req, res) => {
  const { batchId } = req.body;

  if (!batchId || !messageProcesses[batchId]) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid batch ID!' 
    });
  }

  messageProcesses[batchId].isStopped = true;
  messageProcesses[batchId].status = 'stopped';

  console.log(`🛑 Stopped: ${batchId.substring(0,6)}`);

  // Cleanup session after stop
  const sessionId = messageProcesses[batchId].sessionId;
  setTimeout(() => cleanupSession(sessionId), 3000);

  res.json({ 
    success: true, 
    message: 'Stopped successfully!' 
  });
});

// Get batch status
app.get('/batch-status/:batchId', (req, res) => {
  const { batchId } = req.params;

  if (!messageProcesses[batchId]) {
    return res.status(404).json({ 
      success: false, 
      message: 'Batch not found!' 
    });
  }

  const process = messageProcesses[batchId];
  
  res.json({
    success: true,
    batchId,
    status: process.status,
    currentIndex: process.currentIndex,
    totalMessages: process.totalMessages,
    totalSent: process.totalSent,
    loopCount: process.loopCount,
    progress: Math.round((process.currentIndex / process.totalMessages) * 100)
  });
});

// Get all batches
app.get('/all-batches', (req, res) => {
  const batches = Object.keys(messageProcesses).map(batchId => {
    const p = messageProcesses[batchId];
    return {
      batchId,
      status: p.status,
      progress: Math.round((p.currentIndex / p.totalMessages) * 100),
      currentIndex: p.currentIndex,
      totalMessages: p.totalMessages,
      totalSent: p.totalSent,
      loopCount: p.loopCount,
      targetNumber: p.targetNumber
    };
  });

  res.json({ success: true, batches });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    uptime: process.uptime(),
    activeBatches: Object.keys(messageProcesses).length,
    activeSockets: Object.keys(activeSockets).length
  });
});

// Error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ Exception:', error.message);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Rejection:', error.message);
});

// Start server
app.listen(port, () => {
  console.log(`
╔════════════════════════════════════╗
║   📱 WhatsApp Bulk Sender          ║
║   🔄 LOOP MODE ENABLED             ║
╠════════════════════════════════════╣
║   Port: ${port}                       ║
║   URL: http://localhost:${port}      ║
╚════════════════════════════════════╝

✅ Server ready! Multiple users supported.
  `);
});
