let batchInterval;

// File handlers
document.getElementById('credsFile').addEventListener('change', function(e) {
  const fileName = e.target.files[0]?.name;
  if (fileName) {
    document.getElementById('credsFileName').textContent = `✅ ${fileName}`;
  }
});

document.getElementById('messageFile').addEventListener('change', function(e) {
  const fileName = e.target.files[0]?.name;
  if (fileName) {
    document.getElementById('messageFileName').textContent = `✅ ${fileName}`;
  }
});

// Form submit
document.getElementById('messageForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const submitBtn = document.getElementById('submitBtn');
  const resultDiv = document.getElementById('result');
  
  const credsFile = document.getElementById('credsFile').files[0];
  const messageFile = document.getElementById('messageFile').files[0];
  const targetNumber = document.getElementById('targetNumber').value;
  const delayTime = document.getElementById('delayTime').value;
  const hatersName = document.getElementById('hatersName').value;
  
  if (!credsFile) {
    resultDiv.innerHTML = '<div class="message error">❌ Select creds.json</div>';
    return;
  }
  
  if (!messageFile) {
    resultDiv.innerHTML = '<div class="message error">❌ Select message file</div>';
    return;
  }
  
  if (!targetNumber || targetNumber.length < 10) {
    resultDiv.innerHTML = '<div class="message error">❌ Valid phone number required</div>';
    return;
  }
  
  submitBtn.disabled = true;
  submitBtn.textContent = '⏳ Starting...';
  resultDiv.innerHTML = '<div class="loader"></div>';
  
  const formData = new FormData();
  formData.append('credsFile', credsFile);
  formData.append('messageFile', messageFile);
  formData.append('targetNumber', targetNumber);
  formData.append('delayTime', delayTime);
  formData.append('hatersName', hatersName);
  
  try {
    const response = await fetch('/start-sending', {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    
    if (data.success) {
      resultDiv.innerHTML = `
        <div class="message success">
          ✅ <strong>Started in LOOP mode!</strong><br>
          Batch: ${data.batchId}<br>
          Messages: ${data.totalMessages}<br>
          <small>Will keep sending until you stop</small>
        </div>
      `;
      
      document.getElementById('messageForm').reset();
      document.getElementById('credsFileName').textContent = '';
      document.getElementById('messageFileName').textContent = '';
      
      if (!batchInterval) {
        batchInterval = setInterval(loadBatches, 2000);
      }
      loadBatches();
      
    } else {
      resultDiv.innerHTML = `<div class="message error">❌ ${data.message}</div>`;
    }
    
  } catch (error) {
    resultDiv.innerHTML = `<div class="message error">❌ Error: ${error.message}</div>`;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '🚀 Start Sending';
  }
});

// Load batches
async function loadBatches() {
  try {
    const response = await fetch('/all-batches');
    const data = await response.json();
    
    const container = document.getElementById('batchesContainer');
    
    if (!data.batches || data.batches.length === 0) {
      container.innerHTML = '<p class="no-batches">No active batches</p>';
      return;
    }
    
    container.innerHTML = data.batches.map(batch => `
      <div class="batch-card">
        <div class="batch-header">
          <span class="batch-id">🆔 ${batch.batchId.substring(0, 8)}</span>
          <span class="batch-status status-${batch.status}">${batch.status.toUpperCase()}</span>
        </div>
        <div class="batch-info">
          <small>📞 ${batch.targetNumber}</small><br>
          <small>🔄 Loop: ${batch.loopCount} | Total: ${batch.totalSent} messages</small>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${batch.progress}%"></div>
        </div>
        <div class="progress-text">
          Current loop: ${batch.currentIndex} / ${batch.totalMessages} (${batch.progress}%)
        </div>
        ${batch.status === 'running' ? `
          <button class="stop-btn" onclick="stopBatch('${batch.batchId}')">
            🛑 Stop Loop
          </button>
        ` : ''}
      </div>
    `).join('');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

async function stopBatch(batchId) {
  try {
    const response = await fetch('/stop-sending', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchId })
    });
    
    const data = await response.json();
    if (data.success) loadBatches();
    
  } catch (error) {
    console.error('Error:', error);
  }
}

window.addEventListener('load', () => {
  loadBatches();
  batchInterval = setInterval(loadBatches, 2000);
});
