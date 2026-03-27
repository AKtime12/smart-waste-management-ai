// QR Scanner Module
let scannerActive = false;
let currentStream = null;

async function startScanner(videoElementId, onScanSuccess) {
    if(scannerActive) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        currentStream = stream;
        const video = document.getElementById(videoElementId);
        if(video) { video.srcObject = stream; await video.play(); scannerActive = true; }
        if(typeof Html5Qrcode !== 'undefined') {
            const html5QrCode = new Html5Qrcode(videoElementId);
            html5QrCode.start({ facingMode: 'environment' }, { fps: 10, qrbox: 250 }, onScanSuccess);
        } else { simulateScanner(videoElementId, onScanSuccess); }
    } catch(e) { console.error('Camera error:', e); alert('Could not access camera'); }
}

function simulateScanner(videoElementId, onScanSuccess) {
    setTimeout(() => { if(onScanSuccess) onScanSuccess('SIMULATED_QR_CODE_12345'); }, 3000);
}

function stopScanner() { if(currentStream) { currentStream.getTracks().forEach(t => t.stop()); currentStream = null; } scannerActive = false; }