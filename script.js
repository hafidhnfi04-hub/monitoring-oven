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
let ds1 = 0.0;
let ds2 = 0.0;
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

// HISTORY_SIZE = 360 data point = 30 MENIT (5 detik interval)
const HISTORY_SIZE = 360;
const MAX_POINTS_TO_SHOW = 360; // Tampilkan semua titik seperti Serial Plotter

// Data history untuk grafik
let historyDS1 = [];
let historyDS2 = [];
let historyHum = [];
let historySetpoint = [];
let historyTimestamps = [];

// Chart instances
let ds1Chart, ds2Chart, humChart;

let realtimeListener = null;

// DOM Elements
const ds1Span = document.getElementById('ds1Value');
const ds2Span = document.getElementById('ds2Value');
const humSpan = document.getElementById('humValue');
const avgTempSpan = document.getElementById('avgTemp');
const setpointDisplay = document.getElementById('setpointDisplay');
const ds1CurrentSpan = document.getElementById('ds1Current');
const ds2CurrentSpan = document.getElementById('ds2Current');
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
    return (ds1 + ds2) / 2;
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
    ds1Span.innerText = ds1.toFixed(1);
    ds2Span.innerText = ds2.toFixed(1);
    humSpan.innerText = humidity.toFixed(1);
    ds1CurrentSpan.innerText = ds1.toFixed(1) + "°C";
    ds2CurrentSpan.innerText = ds2.toFixed(1) + "°C";
    humCurrentSpan.innerText = humidity.toFixed(1) + "%";
    
    setpointReadonly.innerText = setpoint.toFixed(1);
    kpReadonly.innerText = kp.toFixed(2);
    kiReadonly.innerText = ki.toFixed(2);
    kdReadonly.innerText = kd.toFixed(2);
    dimmerValue.innerText = dimmer;
    
    updateRelays();
    updateModeDisplay();
    updateEspTimestampDisplay();
    
    // Tambahkan ke history grafik (Serial Plotter Style)
    const currentTime = getCurrentTimeStr();
    historyTimestamps.push(currentTime);
    historyDS1.push(ds1);
    historyDS2.push(ds2);
    historyHum.push(humidity);
    historySetpoint.push(setpoint);
    
    // Batasi history ke HISTORY_SIZE
    while (historyTimestamps.length > HISTORY_SIZE) historyTimestamps.shift();
    while (historyDS1.length > HISTORY_SIZE) historyDS1.shift();
    while (historyDS2.length > HISTORY_SIZE) historyDS2.shift();
    while (historyHum.length > HISTORY_SIZE) historyHum.shift();
    while (historySetpoint.length > HISTORY_SIZE) historySetpoint.shift();
    
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
            
            ds1 = data.ds18b20_1 !== undefined ? parseFloat(data.ds18b20_1) : ds1;
            ds2 = data.ds18b20_2 !== undefined ? parseFloat(data.ds18b20_2) : ds2;
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

// ======================== UPDATE CHARTS (SERIAL PLOTTER STYLE) ========================
function updateCharts() {
    if (ds1Chart) {
        ds1Chart.data.labels = [...historyTimestamps];
        ds1Chart.data.datasets[0].data = [...historyDS1];
        ds1Chart.data.datasets[1].data = [...historySetpoint];
        ds1Chart.update('none');
    }
    if (ds2Chart) {
        ds2Chart.data.labels = [...historyTimestamps];
        ds2Chart.data.datasets[0].data = [...historyDS2];
        ds2Chart.data.datasets[1].data = [...historySetpoint];
        ds2Chart.update('none');
    }
    if (humChart) {
        humChart.data.labels = [...historyTimestamps];
        humChart.data.datasets[0].data = [...historyHum];
        humChart.update('none');
    }
}

// ======================== INIT CHARTS (SERIAL PLOTTER STYLE) ========================
function initCharts() {
    const ctx1 = document.getElementById('ds1Chart').getContext('2d');
    const ctx2 = document.getElementById('ds2Chart').getContext('2d');
    const ctx3 = document.getElementById('humChart').getContext('2d');
    
    // Konfigurasi gaya Serial Plotter
    const serialPlotterOptions = {
        responsive: true,
        maintainAspectRatio: true,
        animation: {
            duration: 0 // Nonaktifkan animasi agar lebih cepat seperti Serial Plotter
        },
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: {
                    boxWidth: 12,
                    padding: 10,
                    font: { size: 10, weight: 'bold' },
                    color: '#1b5e20'
                }
            },
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
                        return `${context.dataset.label}: ${context.raw.toFixed(1)}`;
                    }
                }
            }
        },
        scales: {
            y: { 
                min: 0, 
                max: 120, 
                grid: { 
                    color: 'rgba(0,0,0,0.1)',
                    drawTicks: true,
                    tickColor: 'rgba(0,0,0,0.2)'
                }, 
                title: { display: true, text: 'Nilai', font: { size: 10 }, color: '#2e7d32' }, 
                ticks: { 
                    stepSize: 10, 
                    color: '#1b5e20',
                    font: { size: 9 }
                } 
            },
            x: { 
                grid: { 
                    display: true,
                    color: 'rgba(0,0,0,0.05)'
                }, 
                title: { display: true, text: 'Waktu (30 MENIT History)', font: { size: 10 }, color: '#2e7d32' },
                ticks: { 
                    maxRotation: 45,
                    minRotation: 45,
                    autoSkip: true, 
                    maxTicksLimit: 12, 
                    color: '#1b5e20',
                    font: { size: 8, weight: 'normal' }
                } 
            }
        },
        interaction: { 
            mode: 'nearest', 
            axis: 'x', 
            intersect: false 
        },
        elements: {
            point: {
                radius: 1, // Titik kecil seperti Serial Plotter
                hoverRadius: 4,
                hitRadius: 5
            },
            line: {
                tension: 0, // Garis lurus seperti Serial Plotter (tanpa smoothing)
                borderWidth: 1.5
            }
        }
    };
    
    // Opsi untuk grafik kelembaban (skala 0-100)
    const humOptions = JSON.parse(JSON.stringify(serialPlotterOptions));
    humOptions.scales.y.max = 100;
    humOptions.scales.y.stepSize = 10;
    humOptions.scales.y.title.text = 'Kelembaban (%)';
    
    // Dataset untuk DS18B20 1
    const ds1Dataset = {
        label: 'DS18B20 1',
        data: historyDS1,
        borderColor: '#e74c3c', // Merah seperti Serial Plotter
        backgroundColor: 'rgba(231, 76, 60, 0.1)',
        borderWidth: 1.5,
        fill: false,
        tension: 0,
        pointRadius: 1,
        pointHoverRadius: 4,
        pointBackgroundColor: '#e74c3c',
        pointBorderColor: '#e74c3c',
        pointBorderWidth: 1
    };
    
    const ds1SetpointDataset = {
        label: 'Setpoint',
        data: historySetpoint,
        borderColor: '#2ecc71', // Hijau untuk setpoint
        backgroundColor: 'rgba(46, 204, 113, 0.1)',
        borderWidth: 1.5,
        borderDash: [5, 5], // Garis putus-putus
        fill: false,
        tension: 0,
        pointRadius: 1,
        pointHoverRadius: 4,
        pointBackgroundColor: '#2ecc71',
        pointBorderColor: '#2ecc71',
        pointBorderWidth: 1
    };
    
    // Dataset untuk DS18B20 2
    const ds2Dataset = {
        label: 'DS18B20 2',
        data: historyDS2,
        borderColor: '#3498db', // Biru seperti Serial Plotter
        backgroundColor: 'rgba(52, 152, 219, 0.1)',
        borderWidth: 1.5,
        fill: false,
        tension: 0,
        pointRadius: 1,
        pointHoverRadius: 4,
        pointBackgroundColor: '#3498db',
        pointBorderColor: '#3498db',
        pointBorderWidth: 1
    };
    
    const ds2SetpointDataset = {
        label: 'Setpoint',
        data: historySetpoint,
        borderColor: '#2ecc71',
        backgroundColor: 'rgba(46, 204, 113, 0.1)',
        borderWidth: 1.5,
        borderDash: [5, 5],
        fill: false,
        tension: 0,
        pointRadius: 1,
        pointHoverRadius: 4,
        pointBackgroundColor: '#2ecc71',
        pointBorderColor: '#2ecc71',
        pointBorderWidth: 1
    };
    
    // Dataset untuk Kelembaban
    const humDataset = {
        label: 'Kelembaban',
        data: historyHum,
        borderColor: '#9b59b6', // Ungu
        backgroundColor: 'rgba(155, 89, 182, 0.1)',
        borderWidth: 1.5,
        fill: false,
        tension: 0,
        pointRadius: 1,
        pointHoverRadius: 4,
        pointBackgroundColor: '#9b59b6',
        pointBorderColor: '#9b59b6',
        pointBorderWidth: 1
    };
    
    // Inisialisasi grafik
    ds1Chart = new Chart(ctx1, { 
        type: 'line', 
        data: { 
            labels: historyTimestamps, 
            datasets: [ds1Dataset, ds1SetpointDataset] 
        }, 
        options: serialPlotterOptions 
    });
    
    ds2Chart = new Chart(ctx2, { 
        type: 'line', 
        data: { 
            labels: historyTimestamps, 
            datasets: [ds2Dataset, ds2SetpointDataset] 
        }, 
        options: serialPlotterOptions 
    });
    
    humChart = new Chart(ctx3, { 
        type: 'line', 
        data: { 
            labels: historyTimestamps, 
            datasets: [humDataset] 
        }, 
        options: humOptions 
    });
}

function initHistoryData() {
    historyTimestamps = [];
    historyDS1 = [];
    historyDS2 = [];
    historyHum = [];
    historySetpoint = [];
    
    const now = new Date();
    
    for (let i = 0; i < HISTORY_SIZE; i++) {
        const millisecondsAgo = (HISTORY_SIZE - i) * 5000; // 5 detik interval
        const timestamp = new Date(now.getTime() - millisecondsAgo);
        historyTimestamps.push(formatTimeFromDate(timestamp));
        historyDS1.push(0);
        historyDS2.push(0);
        historyHum.push(0);
        historySetpoint.push(50);
    }
}

// ======================== INISIALISASI ========================
window.onload = async () => {
    initHistoryData();
    initCharts();
    startRealtimeListening();
    
    window.addEventListener('resize', () => {
        if (ds1Chart) ds1Chart.resize();
        if (ds2Chart) ds2Chart.resize();
        if (humChart) humChart.resize();
    });
};

window.onbeforeunload = () => {
    if (realtimeListener) {
        realtimeListener.off();
    }
};
