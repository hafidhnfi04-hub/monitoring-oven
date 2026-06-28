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
let dimmer = 0, mode = 2;
let kp = 0, ki = 0, kd = 0, espTimestamp = "";

const HISTORY_SIZE = 100;
let historyDS1 = [], historyDS2 = [], historyHum = [], historySetpoint = [], historyTimestamps = [];
let ds1Chart, ds2Chart, humChart;
let realtimeListener = null, lastSyncTime = null;
let dataReceived = false;

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
const firebaseStatus = document.getElementById('firebaseStatus');

// ======================== FUNGSI UTILITY ========================
function getCurrentTimeStr() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function getAverageTemp() {
    return (ds1 + ds2) / 2;
}

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
    
    // PERBAIKAN: Ki pakai 3 desimal
    kiReadonly.textContent = ki.toFixed(3);
    
    kdReadonly.textContent = kd.toFixed(2);
    
    // Mode
    if (mode === 2) {
        modeDisplay.textContent = 'AUTO';
        modeDisplay.style.color = '#1cc88a';
    } else {
        modeDisplay.textContent = 'MANUAL';
        modeDisplay.style.color = '#f6c23e';
    }
    
    // Timestamp ESP32
    if (espTimestamp && espTimestamp !== "") {
        espTime.textContent = espTimestamp;
    } else {
        espTime.textContent = '--:--:--';
    }
    
    // Tambahkan ke history
    const currentTime = getCurrentTimeStr();
    historyTimestamps.push(currentTime);
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
    
    console.log('📊 Data updated:', { ds1, ds2, humidity, setpoint, dimmer, ki, espTimestamp });
    console.log('📈 History size:', historyTimestamps.length);
}

// ======================== FIREBASE ========================
function startRealtimeListening() {
    if (realtimeListener) {
        realtimeListener.off();
        realtimeListener = null;
    }
    
    const ref = database.ref('/oven_data');
    console.log('🔄 Mendengarkan data dari Firebase...');
    
    realtimeListener = ref.on('value', (snapshot) => {
        const data = snapshot.val();
        console.log('📥 Data dari Firebase:', data);
        
        if (data) {
            ds1 = data.ds18b20_1 !== undefined ? parseFloat(data.ds18b20_1) : ds1;
            ds2 = data.ds18b20_2 !== undefined ? parseFloat(data.ds18b20_2) : ds2;
            humidity = data.kelembaban !== undefined ? parseFloat(data.kelembaban) : humidity;
            setpoint = data.setpoint !== undefined ? parseFloat(data.setpoint) : setpoint;
            dimmer = data.dimmer !== undefined ? data.dimmer : dimmer;
            kp = data.kp !== undefined ? parseFloat(data.kp) : kp;
            ki = data.ki !== undefined ? parseFloat(data.ki) : ki;
            kd = data.kd !== undefined ? parseFloat(data.kd) : kd;
            mode = data.mode !== undefined ? data.mode : mode;
            espTimestamp = data.timestamp !== undefined ? data.timestamp : espTimestamp;
            
            dataReceived = true;
            updateAllDisplay();
            
            lastSyncTime = new Date();
            firebaseStatus.innerHTML = `<i class="fas fa-check-circle text-success"></i> ✅ Terhubung ke ESP32 | Update: ${lastSyncTime.toLocaleTimeString()}`;
            firebaseStatus.className = 'firebase-status';
            firebaseStatus.style.background = '#e8f5e9';
        } else {
            console.log('⏳ Menunggu data dari ESP32...');
            firebaseStatus.innerHTML = `<i class="fas fa-clock text-warning"></i> ⏳ Menunggu data dari ESP32...`;
            firebaseStatus.className = 'firebase-status';
            firebaseStatus.style.background = '#fff3e0';
        }
    }, (error) => {
        console.error('❌ Error Firebase:', error);
        firebaseStatus.innerHTML = `<i class="fas fa-exclamation-triangle text-danger"></i> ❌ Gagal: ${error.message}`;
        firebaseStatus.className = 'firebase-status error';
        firebaseStatus.style.background = '#ffebee';
    });
}

// ======================== CHARTS ========================
function updateCharts() {
    if (ds1Chart && historyTimestamps.length > 0) {
        ds1Chart.data.labels = [...historyTimestamps];
        ds1Chart.data.datasets[0].data = [...historyDS1];
        ds1Chart.data.datasets[1].data = [...historySetpoint];
        ds1Chart.update('none');
    }
    if (ds2Chart && historyTimestamps.length > 0) {
        ds2Chart.data.labels = [...historyTimestamps];
        ds2Chart.data.datasets[0].data = [...historyDS2];
        ds2Chart.data.datasets[1].data = [...historySetpoint];
        ds2Chart.update('none');
    }
    if (humChart && historyTimestamps.length > 0) {
        humChart.data.labels = [...historyTimestamps];
        humChart.data.datasets[0].data = [...historyHum];
        humChart.update('none');
    }
}

function initCharts() {
    console.log('📊 Inisialisasi grafik...');
    
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
            y: {
                min: 0,
                max: 120,
                grid: { color: 'rgba(0,0,0,0.05)' },
                ticks: { stepSize: 20 }
            },
            x: {
                grid: { display: false },
                ticks: { maxTicksLimit: 10, maxRotation: 30, minRotation: 30 }
            }
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
                { label: 'Setpoint', data: historySetpoint, borderColor: '#1cc88a', borderDash: [5, 5], fill: false, tension: 0, pointRadius: 0 }
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
                { label: 'Setpoint', data: historySetpoint, borderColor: '#1cc88a', borderDash: [5, 5], fill: false, tension: 0, pointRadius: 0 }
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
    
    console.log('✅ Grafik selesai diinisialisasi');
}

function initHistoryData() {
    const now = new Date();
    for (let i = 0; i < 20; i++) {
        const t = new Date(now.getTime() - (20 - i) * 5000);
        historyTimestamps.push(`${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}:${String(t.getSeconds()).padStart(2, '0')}`);
        historyDS1.push(0);
        historyDS2.push(0);
        historyHum.push(0);
        historySetpoint.push(50);
    }
    console.log('📊 History data initialized, size:', historyTimestamps.length);
}

// ======================== INIT ========================
window.onload = function() {
    console.log('🚀 Dashboard dimulai...');
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
        realtimeListener = null;
    }
};
