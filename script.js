// ======================== KONFIGURASI FIREBASE ========================
const firebaseConfig = {
    apiKey: "AIzaSyBJ7lFvG1NExFPIDbyyRRJdQYIzBQhLJEI",
    authDomain: "tembakaurajangandb.firebaseapp.com",
    databaseURL: "https://tembakaurajangandb-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "tembakaurajangandb",
    storageBucket: "tembakaurajangandb.firebasestorage.app",
    messagingSenderId: "34154662967",
    appId: "1:34154662967:web:55ab1f3dcda7a43416c3b2"
};

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ======================== STATE AWAL ========================
let tc1 = 0.0;
let tc2 = 0.0;
let humidity = 0.0;
let setpoint = 50.0;
let relay1 = 0;
let relay2 = 0;
let dimmer = 0;
let kp = 3.0;
let ki = 0.30;
let kd = 0.15;
let mode = 2;
let espTimestamp = "";

// HISTORY_SIZE = 900 data point = 30 MENIT
const HISTORY_SIZE = 900;
const TOTAL_POINTS_TO_SHOW = 15;

// Data history untuk grafik
let historyTC1 = [];
let historyTC2 = [];
let historyHum = [];
let historyTimestamps = [];
let historyFirebaseKeys = [];

// Chart instances
let tc1Chart, tc2Chart, humChart;

let realtimeListener = null;

// DOM Elements
const tc1Span = document.getElementById('tc1Value');
const tc2Span = document.getElementById('tc2Value');
const humSpan = document.getElementById('humValue');
const avgTempSpan = document.getElementById('avgTemp');
const setpointDisplay = document.getElementById('setpointDisplay');
const systemTimeSpan = document.getElementById('systemTime');
const tc1CurrentSpan = document.getElementById('tc1Current');
const tc2CurrentSpan = document.getElementById('tc2Current');
const humCurrentSpan = document.getElementById('humCurrent');
const setpointReadonly = document.getElementById('setpointReadonly');
const kpReadonly = document.getElementById('kpReadonly');
const kiReadonly = document.getElementById('kiReadonly');
const kdReadonly = document.getElementById('kdReadonly');
const dimmerValue = document.getElementById('dimmerValue');
const modeStatus = document.getElementById('modeStatus');
const firebaseStatusSpan = document.getElementById('firebaseStatus');
const espTimeSpan = document.getElementById('espTime');
const espDaysSpan = document.getElementById('espDays');
const espHoursSpan = document.getElementById('espHours');
const espMinutesSpan = document.getElementById('espMinutes');
const espSecondsSpan = document.getElementById('espSeconds');

// Relay Elements
const relay1Badge = document.getElementById('relay1Badge');
const relay1Indicator = document.getElementById('relay1Indicator');
const relay1State = document.getElementById('relay1State');
const relay1Card = document.getElementById('relay1Card');
const relay2Badge = document.getElementById('relay2Badge');
const relay2Indicator = document.getElementById('relay2Indicator');
const relay2State = document.getElementById('relay2State');
const relay2Card = document.getElementById('relay2Card');

// ======================== FUNGSI UTILITY ========================
function formatTimeFromDate(date) {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
}

function getCurrentTimeStr() {
    const d = new Date();
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

function getAverageTemp() {
    return (tc1 + tc2) / 2;
}

// ======================== UPDATE RELAY TAMPILAN ========================
function updateRelays() {
    if (relay1 === 1) {
        relay1Badge.textContent = 'ON';
        relay1Badge.className = 'relay-badge badge-on';
        relay1Indicator.className = 'relay-indicator indicator-on';
        relay1State.innerHTML = '🔴 Relay ON (Pemanas Aktif)';
        relay1Card.classList.add('relay-on');
    } else {
        relay1Badge.textContent = 'OFF';
        relay1Badge.className = 'relay-badge';
        relay1Indicator.className = 'relay-indicator';
        relay1State.innerHTML = '⚪ Relay OFF (Pemanas Mati)';
        relay1Card.classList.remove('relay-on');
    }
    
    if (relay2 === 1) {
        relay2Badge.textContent = 'ON';
        relay2Badge.className = 'relay-badge badge-on';
        relay2Indicator.className = 'relay-indicator indicator-on';
        relay2State.innerHTML = '🔴 Relay ON (Pendingin Aktif)';
        relay2Card.classList.add('relay-on');
    } else {
        relay2Badge.textContent = 'OFF';
        relay2Badge.className = 'relay-badge';
        relay2Indicator.className = 'relay-indicator';
        relay2State.innerHTML = '⚪ Relay OFF (Pendingin Mati)';
        relay2Card.classList.remove('relay-on');
    }
}

// ======================== UPDATE TAMPILAN MODE ========================
function updateModeDisplay() {
    if (mode === 2) {
        modeStatus.innerHTML = '🎮 Mode: AUTOMATIC (PID Aktif)';
        modeStatus.className = 'mode-status mode-auto';
    } else {
        modeStatus.innerHTML = '🎮 Mode: MANUAL (Kontrol Manual)';
        modeStatus.className = 'mode-status mode-manual';
    }
}

// ======================== UPDATE TAMPILAN TIMESTAMP ESP32 ========================
function updateEspTimestampDisplay() {
    if (espTimestamp && espTimestamp !== "") {
        espTimeSpan.innerText = espTimestamp;
        
        const match = espTimestamp.match(/(\d+)d\s+(\d+):(\d+):(\d+)/);
        if (match) {
            espDaysSpan.innerText = match[1].padStart(2, '0');
            espHoursSpan.innerText = match[2].padStart(2, '0');
            espMinutesSpan.innerText = match[3].padStart(2, '0');
            espSecondsSpan.innerText = match[4].padStart(2, '0');
        }
    } else {
        espTimeSpan.innerText = '--:--:--';
    }
}

// ======================== UPDATE SEMUA TAMPILAN DARI DATA ESP32 ========================
function updateAllDisplay() {
    const avg = getAverageTemp();
    
    avgTempSpan.innerText = avg.toFixed(1);
    setpointDisplay.innerText = setpoint.toFixed(1);
    tc1Span.innerText = tc1.toFixed(1);
    tc2Span.innerText = tc2.toFixed(1);
    humSpan.innerText = humidity.toFixed(1);
    tc1CurrentSpan.innerText = tc1.toFixed(1) + "°C";
    tc2CurrentSpan.innerText = tc2.toFixed(1) + "°C";
    humCurrentSpan.innerText = humidity.toFixed(1) + "%";
    
    setpointReadonly.innerText = setpoint.toFixed(1);
    kpReadonly.innerText = kp.toFixed(2);
    kiReadonly.innerText = ki.toFixed(2);
    kdReadonly.innerText = kd.toFixed(2);
    dimmerValue.innerText = dimmer;
    
    updateRelays();
    updateModeDisplay();
    updateEspTimestampDisplay();
    
    // Tambahkan ke history grafik
    const currentTime = getCurrentTimeStr();
    historyTimestamps.push(currentTime);
    historyTC1.push(tc1);
    historyTC2.push(tc2);
    historyHum.push(humidity);
    
    while (historyTimestamps.length > HISTORY_SIZE) historyTimestamps.shift();
    while (historyTC1.length > HISTORY_SIZE) historyTC1.shift();
    while (historyTC2.length > HISTORY_SIZE) historyTC2.shift();
    while (historyHum.length > HISTORY_SIZE) historyHum.shift();
    
    updateCharts();
}

// ======================== FUNGSI FIREBASE - MEMBACA DATA ESP32 ========================
let lastSyncTime = null;

function startRealtimeListening() {
    if (realtimeListener) {
        realtimeListener.off();
    }
    
    const ovenDataRef = database.ref('/oven_data');
    
    realtimeListener = ovenDataRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            console.log('Data dari ESP32:', data);
            
            tc1 = data.tc1 !== undefined ? parseFloat(data.tc1) : tc1;
            tc2 = data.tc2 !== undefined ? parseFloat(data.tc2) : tc2;
            humidity = data.kelembaban !== undefined ? parseFloat(data.kelembaban) : humidity;
            setpoint = data.setpoint !== undefined ? parseFloat(data.setpoint) : setpoint;
            relay1 = data.relay1 !== undefined ? data.relay1 : relay1;
            relay2 = data.relay2 !== undefined ? data.relay2 : relay2;
            dimmer = data.dimmer !== undefined ? data.dimmer : dimmer;
            kp = data.kp !== undefined ? parseFloat(data.kp) : kp;
            ki = data.ki !== undefined ? parseFloat(data.ki) : ki;
            kd = data.kd !== undefined ? parseFloat(data.kd) : kd;
            mode = data.mode !== undefined ? data.mode : mode;
            espTimestamp = data.timestamp !== undefined ? data.timestamp : espTimestamp;
            
            updateAllDisplay();
            
            lastSyncTime = new Date();
            updateFirebaseStatus(true, '✅ Terhubung ke ESP32');
        } else {
            console.log('Menunggu data dari ESP32 di node /oven_data...');
            updateFirebaseStatus(true, '⏳ Menunggu data dari ESP32...');
        }
    }, (error) => {
        console.error('Error membaca Firebase:', error);
        updateFirebaseStatus(false, '❌ Gagal membaca dari Firebase: ' + error.message);
    });
}

function updateFirebaseStatus(isConnected, message) {
    if (firebaseStatusSpan) {
        firebaseStatusSpan.innerHTML = `<span style="display: inline-flex; align-items: center; gap: 8px;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: ${isConnected ? '#4caf50' : '#e74c3c'};"></span>
            ${message} ${lastSyncTime ? `<span style="font-size: 0.7rem;">| Update: ${lastSyncTime.toLocaleTimeString()}</span>` : ''}
        </span>`;
        firebaseStatusSpan.style.borderLeftColor = isConnected ? '#4caf50' : '#e74c3c';
        firebaseStatusSpan.style.background = isConnected ? '#e8f5e9' : '#ffebee';
    }
}

// ======================== FUNGSI UNTUK TITIK GRAFIK ========================
function getPointRadiusArray(dataLength) {
    let radiusArray = new Array(dataLength).fill(0);
    let hoverRadiusArray = new Array(dataLength).fill(0);
    
    if (dataLength === 0) return { radius: radiusArray, hoverRadius: hoverRadiusArray };
    
    const step = Math.max(1, Math.floor(dataLength / TOTAL_POINTS_TO_SHOW));
    
    for (let i = 0; i < TOTAL_POINTS_TO_SHOW; i++) {
        const index = Math.min(i * step, dataLength - 1);
        radiusArray[index] = 4;
        hoverRadiusArray[index] = 7;
    }
    
    radiusArray[dataLength - 1] = 4;
    hoverRadiusArray[dataLength - 1] = 7;
    
    return { radius: radiusArray, hoverRadius: hoverRadiusArray };
}

// ======================== UPDATE CHARTS ========================
function updateCharts() {
    const tc1Radius = getPointRadiusArray(historyTC1.length);
    const tc2Radius = getPointRadiusArray(historyTC2.length);
    const humRadius = getPointRadiusArray(historyHum.length);
    
    if (tc1Chart) {
        tc1Chart.data.labels = [...historyTimestamps];
        tc1Chart.data.datasets[0].data = [...historyTC1];
        tc1Chart.data.datasets[0].pointRadius = tc1Radius.radius;
        tc1Chart.data.datasets[0].pointHoverRadius = tc1Radius.hoverRadius;
        tc1Chart.update('none');
    }
    if (tc2Chart) {
        tc2Chart.data.labels = [...historyTimestamps];
        tc2Chart.data.datasets[0].data = [...historyTC2];
        tc2Chart.data.datasets[0].pointRadius = tc2Radius.radius;
        tc2Chart.data.datasets[0].pointHoverRadius = tc2Radius.hoverRadius;
        tc2Chart.update('none');
    }
    if (humChart) {
        humChart.data.labels = [...historyTimestamps];
        humChart.data.datasets[0].data = [...historyHum];
        humChart.data.datasets[0].pointRadius = humRadius.radius;
        humChart.data.datasets[0].pointHoverRadius = humRadius.hoverRadius;
        humChart.update('none');
    }
}

// ======================== INIT CHARTS ========================
function initCharts() {
    const ctx1 = document.getElementById('tc1Chart').getContext('2d');
    const ctx2 = document.getElementById('tc2Chart').getContext('2d');
    const ctx3 = document.getElementById('humChart').getContext('2d');
    
    const initialTc1Radius = getPointRadiusArray(historyTC1.length);
    const initialTc2Radius = getPointRadiusArray(historyTC2.length);
    const initialHumRadius = getPointRadiusArray(historyHum.length);
    
    const tempOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: { display: false },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: 'rgba(0,0,0,0.8)',
                titleColor: '#fff',
                bodyColor: '#ddd',
                borderColor: '#4caf50',
                borderWidth: 1,
                callbacks: {
                    label: function(context) {
                        return `Suhu: ${context.raw.toFixed(1)}°C`;
                    }
                }
            }
        },
        scales: {
            y: { 
                min: 0, 
                max: 120, 
                grid: { color: '#e8f5e9' }, 
                title: { display: true, text: 'Suhu (°C)', font: { size: 10 }, color: '#2e7d32' }, 
                ticks: { stepSize: 20, color: '#1b5e20' } 
            },
            x: { 
                grid: { display: false }, 
                title: { display: true, text: 'Waktu - 30 MENIT HISTORY', font: { size: 10 }, color: '#2e7d32' },
                ticks: { 
                    maxRotation: 45,
                    minRotation: 45,
                    autoSkip: true, 
                    maxTicksLimit: 10, 
                    color: '#1b5e20',
                    font: { size: 10, weight: 'normal' }
                } 
            }
        },
        interaction: { mode: 'nearest', axis: 'x', intersect: false }
    };
    
    const humOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: { display: false },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: 'rgba(0,0,0,0.8)',
                titleColor: '#fff',
                bodyColor: '#ddd',
                borderColor: '#4caf50',
                borderWidth: 1,
                callbacks: {
                    label: function(context) {
                        return `Kelembaban: ${context.raw.toFixed(1)}%`;
                    }
                }
            }
        },
        scales: {
            y: { 
                min: 0, 
                max: 100, 
                grid: { color: '#e8f5e9' }, 
                title: { display: true, text: 'Kelembaban (%)', font: { size: 10 }, color: '#2e7d32' }, 
                ticks: { stepSize: 20, color: '#1b5e20' } 
            },
            x: { 
                grid: { display: false }, 
                title: { display: true, text: 'Waktu - 30 MENIT HISTORY', font: { size: 10 }, color: '#2e7d32' },
                ticks: { 
                    maxRotation: 45,
                    minRotation: 45,
                    autoSkip: true, 
                    maxTicksLimit: 10, 
                    color: '#1b5e20',
                    font: { size: 10, weight: 'normal' }
                } 
            }
        },
        interaction: { mode: 'nearest', axis: 'x', intersect: false }
    };
    
    const tc1Dataset = {
        label: 'Termokopel 1',
        data: historyTC1,
        borderColor: '#4caf50',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.2,
        pointRadius: initialTc1Radius.radius,
        pointHoverRadius: initialTc1Radius.hoverRadius,
        pointBackgroundColor: '#4caf50',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointHoverBackgroundColor: '#ffffff',
        pointHoverBorderColor: '#4caf50',
        pointHoverBorderWidth: 3,
        pointStyle: 'circle'
    };
    
    const tc2Dataset = {
        label: 'Termokopel 2',
        data: historyTC2,
        borderColor: '#66bb6a',
        backgroundColor: 'rgba(102, 187, 106, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.2,
        pointRadius: initialTc2Radius.radius,
        pointHoverRadius: initialTc2Radius.hoverRadius,
        pointBackgroundColor: '#66bb6a',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointHoverBackgroundColor: '#ffffff',
        pointHoverBorderColor: '#66bb6a',
        pointHoverBorderWidth: 3,
        pointStyle: 'circle'
    };
    
    const humDataset = {
        label: 'Kelembaban',
        data: historyHum,
        borderColor: '#81c784',
        backgroundColor: 'rgba(129, 199, 132, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.2,
        pointRadius: initialHumRadius.radius,
        pointHoverRadius: initialHumRadius.hoverRadius,
        pointBackgroundColor: '#81c784',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointHoverBackgroundColor: '#ffffff',
        pointHoverBorderColor: '#81c784',
        pointHoverBorderWidth: 3,
        pointStyle: 'circle'
    };
    
    tc1Chart = new Chart(ctx1, { type: 'line', data: { labels: historyTimestamps, datasets: [tc1Dataset] }, options: tempOptions });
    tc2Chart = new Chart(ctx2, { type: 'line', data: { labels: historyTimestamps, datasets: [tc2Dataset] }, options: tempOptions });
    humChart = new Chart(ctx3, { type: 'line', data: { labels: historyTimestamps, datasets: [humDataset] }, options: humOptions });
}

function initHistoryData() {
    historyTimestamps = [];
    historyTC1 = [];
    historyTC2 = [];
    historyHum = [];
    
    const now = new Date();
    
    for (let i = 0; i < HISTORY_SIZE; i++) {
        const millisecondsAgo = (HISTORY_SIZE - i) * 2000;
        const timestamp = new Date(now.getTime() - millisecondsAgo);
        historyTimestamps.push(formatTimeFromDate(timestamp));
        historyTC1.push(0);
        historyTC2.push(0);
        historyHum.push(0);
    }
}

// ======================== INISIALISASI ========================
window.onload = async () => {
    initHistoryData();
    initCharts();
    startRealtimeListening();
    
    window.addEventListener('resize', () => {
        if (tc1Chart) tc1Chart.resize();
        if (tc2Chart) tc2Chart.resize();
        if (humChart) humChart.resize();
    });
};

window.onbeforeunload = () => {
    if (realtimeListener) {
        realtimeListener.off();
    }
};
