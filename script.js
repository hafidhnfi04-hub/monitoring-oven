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

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ======================== STATE AWAL ========================
let ds1 = 0.0, ds2 = 0.0, humidity = 0.0, setpoint = 50.0;
let relay1 = 0, relay2 = 0, dimmer = 0, mode = 2;
let kp = 0, ki = 0, kd = 0, espTimestamp = "";

const HISTORY_SIZE = 180; // 15 menit (5 detik interval)
let historyDS1 = [], historyDS2 = [], historyHum = [], historySetpoint = [], historyTimestamps = [];
let ds1Chart, ds2Chart, humChart;
let realtimeListener = null, lastSyncTime = null;

// DOM Elements
const ds1Value = document.getElementById('ds1Value');
const ds2Value = document.getElementById('ds2Value');
const humValue = document.getElementById('humValue');
const avgTemp = document.getElementById('avgTemp');
const setpointDisplay = document.getElementById('setpointDisplay');
const dimmerValue = document.getElementById('dimmerValue');
const modeDisplay = document.getElementById('modeDisplay');
const espTime = document.getElementById('espTime');
const setpointReadonly = document.getElementById('setpointReadonly');
const kpReadonly = document.getElementById('kpReadonly');
const kiReadonly = document.getElementById('kiReadonly');
const kdReadonly = document.getElementById('kdReadonly');
const relay1Badge = document.getElementById('relay1Badge');
const relay2Badge = document.getElementById('relay2Badge');
const relay1Indicator = document.getElementById('relay1Indicator');
const relay2Indicator = document.getElementById('relay2Indicator');
const firebaseStatus = document.getElementById('firebaseStatus');

// ======================== FUNGSI UTILITY ========================
function getCurrentTimeStr() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}

function getAverageTemp() { return (ds1 + ds2) / 2; }

// ======================== UPDATE TAMPILAN ========================
function updateAllDisplay() {
    const avg = getAverageTemp();
    avgTemp.innerHTML = `${avg.toFixed(1)} <small style="font-size:0.8rem;">°C</small>`;
    setpointDisplay.innerHTML = `${setpoint.toFixed(1)} <small style="font-size:0.8rem;">°C</small>`;
    ds1Value.innerHTML = `${ds1.toFixed(1)} <small style="font-size:0.8rem;">°C</small>`;
    ds2Value.innerHTML = `${ds2.toFixed(1)} <small style="font-size:0.8rem;">°C</small>`;
    humValue.innerHTML = `${humidity.toFixed(1)} <small style="font-size:0.8rem;">%</small>`;
    dimmerValue.innerHTML = `${dimmer} <small style="font-size:0.8rem;">%</small>`;
    setpointReadonly.textContent = setpoint.toFixed(1);
    kpReadonly.textContent = kp.toFixed(2);
    kiReadonly.textContent = ki.toFixed(2);
    kdReadonly.textContent = kd.toFixed(2);
    
    // Mode
    if (mode === 2) {
        modeDisplay.textContent = 'AUTO';
        modeDisplay.style.color = '#1cc88a';
    } else {
        modeDisplay.textContent = 'MANUAL';
        modeDisplay.style.color = '#f6c23e';
    }
    
    // Relay
    if (relay1 === 1) {
        relay1Badge.textContent = 'ON';
        relay1Badge.className = 'badge-status badge-on';
        relay1Indicator.className = 'relay-indicator on';
    } else {
        relay1Badge.textContent = 'OFF';
        relay1Badge.className = 'badge-status badge-off';
        relay1Indicator.className = 'relay-indicator off';
    }
    if (relay2 === 1) {
        relay2Badge.textContent = 'ON';
        relay2Badge.className = 'badge-status badge-on';
        relay2Indicator.className = 'relay-indicator on';
    } else {
        relay2Badge.textContent = 'OFF';
        relay2Badge.className = 'badge-status badge-off';
        relay2Indicator.className = 'relay-indicator off';
    }
    
    // Timestamp ESP32
    if (espTimestamp) {
        espTime.textContent = espTimestamp;
    }
    
    // History
    historyTimestamps.push(getCurrentTimeStr());
    historyDS1.push(ds1);
    historyDS2.push(ds2);
    historyHum.push(humidity);
    historySetpoint.push(setpoint);
    
    while (historyTimestamps.length > HISTORY_SIZE) historyTimestamps.shift();
    while (historyDS1.length > HISTORY_SIZE) historyDS1.shift();
    while (historyDS2.length > HISTORY_SIZE) historyDS2.shift();
    while (historyHum.length > HISTORY_SIZE) historyHum.shift();
    while (historySetpoint.length > HISTORY_SIZE) historySetpoint.shift();
    
    updateCharts();
}

// ======================== FIREBASE ========================
function startRealtimeListening() {
    if (realtimeListener) realtimeListener.off();
    const ref = database.ref('/oven_data');
    realtimeListener = ref.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
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
            firebaseStatus.innerHTML = `<i class="fas fa-check-circle text-success"></i> Terhubung ke ESP32 | Update: ${lastSyncTime.toLocaleTimeString()}`;
            firebaseStatus.className = 'firebase-status';
        } else {
            firebaseStatus.innerHTML = `<i class="fas fa-clock text-warning"></i> Menunggu data dari ESP32...`;
            firebaseStatus.className = 'firebase-status';
        }
    }, (error) => {
        firebaseStatus.innerHTML = `<i class="fas fa-exclamation-triangle text-danger"></i> Gagal: ${error.message}`;
        firebaseStatus.className = 'firebase-status error';
    });
}

// ======================== CHARTS ========================
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

function initCharts() {
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 0 },
        plugins: {
            legend: { display: false },
            tooltip: {
                mode: 'index',
                intersect: false,
                callbacks: {
                    label: ctx => `${ctx.dataset.label}: ${ctx.raw.toFixed(1)}`
                }
            }
        },
        scales: {
            y: { min: 0, max: 120, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { stepSize: 20 } },
            x: { grid: { display: false }, ticks: { maxTicksLimit: 10, maxRotation: 30, minRotation: 30 } }
        },
        elements: { point: { radius: 1 }, line: { tension: 0, borderWidth: 1.5 } }
    };
    
    const humOptions = JSON.parse(JSON.stringify(options));
    humOptions.scales.y.max = 100;
    humOptions.scales.y.ticks.stepSize = 20;
    
    ds1Chart = new Chart(document.getElementById('ds1Chart'), {
        type: 'line',
        data: {
            labels: historyTimestamps,
            datasets: [
                { label: 'DS18B20 1', data: historyDS1, borderColor: '#e74a3b', fill: false, tension: 0, pointRadius: 1 },
                { label: 'Setpoint', data: historySetpoint, borderColor: '#1cc88a', borderDash: [5,5], fill: false, tension: 0, pointRadius: 0 }
            ]
        },
        options: options
    });
    
    ds2Chart = new Chart(document.getElementById('ds2Chart'), {
        type: 'line',
        data: {
            labels: historyTimestamps,
            datasets: [
                { label: 'DS18B20 2', data: historyDS2, borderColor: '#4e73df', fill: false, tension: 0, pointRadius: 1 },
                { label: 'Setpoint', data: historySetpoint, borderColor: '#1cc88a', borderDash: [5,5], fill: false, tension: 0, pointRadius: 0 }
            ]
        },
        options: options
    });
    
    humChart = new Chart(document.getElementById('humChart'), {
        type: 'line',
        data: {
            labels: historyTimestamps,
            datasets: [{ label: 'Kelembaban', data: historyHum, borderColor: '#9b59b6', fill: false, tension: 0, pointRadius: 1 }]
        },
        options: humOptions
    });
}

function initHistoryData() {
    const now = new Date();
    for (let i = 0; i < HISTORY_SIZE; i++) {
        const t = new Date(now.getTime() - (HISTORY_SIZE - i) * 5000);
        historyTimestamps.push(`${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}:${String(t.getSeconds()).padStart(2,'0')}`);
        historyDS1.push(0);
        historyDS2.push(0);
        historyHum.push(0);
        historySetpoint.push(50);
    }
}

// ======================== INIT ========================
window.onload = function() {
    initHistoryData();
    initCharts();
    startRealtimeListening();
    window.addEventListener('resize', () => {
        if (ds1Chart) ds1Chart.resize();
        if (ds2Chart) ds2Chart.resize();
        if (humChart) humChart.resize();
    });
};
window.onbeforeunload = () => { if (realtimeListener) realtimeListener.off(); };
