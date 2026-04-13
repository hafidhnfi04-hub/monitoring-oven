// ======================== SIMULASI MONITORING OVEN ========================
// Menggunakan Chart.js untuk grafik yang lebih baik
// History: 60 data point (2 menit history dengan update 2 detik)
// Skala Suhu: 10°C - 90°C dengan interval 10°C
// Sumbu X: Waktu real (HH:MM:SS) dengan 15-20 label
// PID: Hanya untuk MONITORING (Read Only)

// ---------- STATE AWAL ----------
let tc1 = 55.3;         // termokopel 1 °C (dari file gambar)
let tc2 = 75.0;         // termokopel 2 °C (dari file gambar)
let humidity = 52.1;    // DHT22 %RH (dari file gambar)

// Parameter PID (nilai tetap, hanya untuk monitoring)
const setpoint = 65.0;
const Kp = 2.5;
const Ki = 0.8;
const Kd = 1.2;

// Variabel PID internal untuk perhitungan
let integral = 0;
let previousError = 0;

// Batasan / alarm
const TEMP_MIN_IDEAL = 55;
const TEMP_MAX_IDEAL = 70;
const TEMP_KRITIS = 80;
const HUM_MIN_IDEAL = 35;
const HUM_MAX_IDEAL = 55;
const HUM_KRITIS = 68;

// Jumlah data point untuk history (60 data = 2 menit dengan update 2 detik)
const HISTORY_SIZE = 60;

// Batas skala suhu
const TEMP_MIN_SCALE = 10;
const TEMP_MAX_SCALE = 90;

// Data history untuk grafik
let historyTC1 = [];
let historyTC2 = [];
let historyHum = [];
let historyTimestamps = []; // Array untuk menyimpan timestamp

// Chart instances
let tc1Chart, tc2Chart, humChart;

// Timer untuk waktu berjalan sistem
let systemStartTime = null;
let runningTimer = null;

// DOM Elements
const tc1Span = document.getElementById('tc1Value');
const tc2Span = document.getElementById('tc2Value');
const humSpan = document.getElementById('humValue');
const tc1StatusSpan = document.getElementById('tc1Status');
const tc2StatusSpan = document.getElementById('tc2Status');
const humStatusSpan = document.getElementById('humStatus');
const avgTempSpan = document.getElementById('avgTemp');
const setpointDisplay = document.getElementById('setpointDisplay');
const pidOutputSpan = document.getElementById('pidOutputValue');
const systemTimeSpan = document.getElementById('systemTime');
const runningHoursSpan = document.getElementById('runningHours');
const runningMinutesSpan = document.getElementById('runningMinutes');
const runningSecondsSpan = document.getElementById('runningSeconds');

// Elemen untuk nilai current di grafik
const tc1CurrentSpan = document.getElementById('tc1Current');
const tc2CurrentSpan = document.getElementById('tc2Current');
const humCurrentSpan = document.getElementById('humCurrent');

// Elemen read-only PID
const setpointReadonly = document.getElementById('setpointReadonly');
const kpReadonly = document.getElementById('kpReadonly');
const kiReadonly = document.getElementById('kiReadonly');
const kdReadonly = document.getElementById('kdReadonly');

let updateInterval = null;

// Helper Waktu
function getTimeStr() {
    const d = new Date();
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

// Format waktu untuk tampilan (HH:MM:SS)
function formatTimeFromDate(date) {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
}

// Update waktu berjalan sistem
function updateRunningTime() {
    if (!systemStartTime) return;
    
    const now = new Date();
    const elapsed = Math.floor((now - systemStartTime) / 1000); // detik
    
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;
    
    runningHoursSpan.innerText = hours.toString().padStart(2, '0');
    runningMinutesSpan.innerText = minutes.toString().padStart(2, '0');
    runningSecondsSpan.innerText = seconds.toString().padStart(2, '0');
    
    // Update juga di avg-temp-bar
    systemTimeSpan.innerText = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Start timer untuk waktu berjalan
function startRunningTimer() {
    systemStartTime = new Date();
    updateRunningTime();
    if (runningTimer) clearInterval(runningTimer);
    runningTimer = setInterval(updateRunningTime, 1000);
}

// Hitung rata-rata suhu
function getAverageTemp() {
    return (tc1 + tc2) / 2;
}

// ======================== PERHITUNGAN PID ========================
function computePID(currentAvgTemp, dt = 2.0) {
    let error = setpoint - currentAvgTemp;
    integral += error * dt;
    integral = Math.min(Math.max(integral, -100), 100);
    let derivative = (error - previousError) / dt;
    let output = (Kp * error) + (Ki * integral) + (Kd * derivative);
    previousError = error;
    output = Math.min(Math.max(output, 0), 100);
    return output;
}

// Aplikasi output PID ke sistem (simulasi efek pemanas terhadap suhu)
function applyPIDEffect(pidOut) {
    let heatEffect = (pidOut - 30) * 0.045;
    let noise1 = (Math.random() - 0.5) * 0.6;
    let noise2 = (Math.random() - 0.5) * 0.6;
    let newTC1 = tc1 + heatEffect + noise1;
    let newTC2 = tc2 + heatEffect + noise2;
    tc1 = Math.min(TEMP_MAX_SCALE, Math.max(TEMP_MIN_SCALE, newTC1));
    tc2 = Math.min(TEMP_MAX_SCALE, Math.max(TEMP_MIN_SCALE, newTC2));
    
    let humEffect = -0.08 * heatEffect;
    let newHum = humidity + humEffect + (Math.random() - 0.5) * 0.8;
    humidity = Math.min(85, Math.max(25, newHum));
}

// Update status indikator
function updateStatusIndicators() {
    // Status untuk TC1
    if (tc1 > TEMP_KRITIS) {
        tc1StatusSpan.innerText = '🔴 KRITIS!';
    } else if (tc1 > TEMP_MAX_IDEAL) {
        tc1StatusSpan.innerText = '⚠️ Tinggi';
    } else if (tc1 < TEMP_MIN_IDEAL) {
        tc1StatusSpan.innerText = '❄️ Rendah';
    } else {
        tc1StatusSpan.innerText = '✅ Normal';
    }
    
    // Status untuk TC2
    if (tc2 > TEMP_KRITIS) {
        tc2StatusSpan.innerText = '🔴 KRITIS!';
    } else if (tc2 > TEMP_MAX_IDEAL) {
        tc2StatusSpan.innerText = '⚠️ Tinggi';
    } else if (tc2 < TEMP_MIN_IDEAL) {
        tc2StatusSpan.innerText = '❄️ Rendah';
    } else {
        tc2StatusSpan.innerText = '✅ Normal';
    }
    
    // Status untuk Humidity
    if (humidity > HUM_KRITIS) {
        humStatusSpan.innerText = '🔴 KRITIS!';
    } else if (humidity > HUM_MAX_IDEAL) {
        humStatusSpan.innerText = '⚠️ Lembab';
    } else if (humidity < HUM_MIN_IDEAL) {
        humStatusSpan.innerText = '🌵 Kering';
    } else {
        humStatusSpan.innerText = '✅ Ideal';
    }
    
    // Warna status
    tc1StatusSpan.style.color = tc1 > TEMP_KRITIS ? '#e74c3c' : (tc1 > TEMP_MAX_IDEAL ? '#f39c12' : '#27ae60');
    tc2StatusSpan.style.color = tc2 > TEMP_KRITIS ? '#e74c3c' : (tc2 > TEMP_MAX_IDEAL ? '#f39c12' : '#27ae60');
    humStatusSpan.style.color = humidity > HUM_KRITIS ? '#e74c3c' : (humidity > HUM_MAX_IDEAL ? '#f39c12' : '#27ae60');
}

// ======================== UPDATE CHARTS ========================
function updateCharts() {
    if (tc1Chart) {
        tc1Chart.data.labels = [...historyTimestamps];
        tc1Chart.data.datasets[0].data = [...historyTC1];
        tc1Chart.update('none');
    }
    if (tc2Chart) {
        tc2Chart.data.labels = [...historyTimestamps];
        tc2Chart.data.datasets[0].data = [...historyTC2];
        tc2Chart.update('none');
    }
    if (humChart) {
        humChart.data.labels = [...historyTimestamps];
        humChart.data.datasets[0].data = [...historyHum];
        humChart.update('none');
    }
}

// Update seluruh UI + Grafik + PID
function updateSystem() {
    const avg = getAverageTemp();
    const currentTime = getTimeStr();
    
    avgTempSpan.innerText = avg.toFixed(1);
    setpointDisplay.innerText = setpoint.toFixed(1);
    tc1Span.innerText = tc1.toFixed(1);
    tc2Span.innerText = tc2.toFixed(1);
    humSpan.innerText = humidity.toFixed(1);
    
    // Update nilai current di header grafik
    tc1CurrentSpan.innerText = tc1.toFixed(1) + "°C";
    tc2CurrentSpan.innerText = tc2.toFixed(1) + "°C";
    humCurrentSpan.innerText = humidity.toFixed(1) + "%";
    
    // Hitung PID dan terapkan
    const pidOut = computePID(avg, 2.0);
    pidOutputSpan.innerText = pidOut.toFixed(1);
    applyPIDEffect(pidOut);
    
    updateStatusIndicators();
    
    // Update history dengan timestamp
    historyTimestamps.push(currentTime);
    historyTC1.push(tc1);
    historyTC2.push(tc2);
    historyHum.push(humidity);
    
    if (historyTimestamps.length > HISTORY_SIZE) historyTimestamps.shift();
    if (historyTC1.length > HISTORY_SIZE) historyTC1.shift();
    if (historyTC2.length > HISTORY_SIZE) historyTC2.shift();
    if (historyHum.length > HISTORY_SIZE) historyHum.shift();
    
    // Update charts
    updateCharts();
}

// ======================== INITIALIZATION =======================
function initCharts() {
    const ctx1 = document.getElementById('tc1Chart').getContext('2d');
    const ctx2 = document.getElementById('tc2Chart').getContext('2d');
    const ctx3 = document.getElementById('humChart').getContext('2d');
    
    // Opsi untuk grafik suhu (skala 10-90°C dengan interval 10°C)
    const tempOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: { display: false },
            tooltip: { 
                mode: 'index', 
                intersect: false,
                callbacks: {
                    label: function(context) {
                        return `${context.dataset.label}: ${context.raw.toFixed(1)}°C`;
                    },
                    title: function(tooltipItems) {
                        return `Waktu: ${tooltipItems[0].label}`;
                    }
                }
            }
        },
        scales: {
            y: {
                min: TEMP_MIN_SCALE,
                max: TEMP_MAX_SCALE,
                grid: { 
                    color: '#e2e8f0',
                    lineWidth: 1,
                    drawBorder: true
                },
                title: { 
                    display: true, 
                    text: 'Suhu (°C)', 
                    color: '#5a6e7a',
                    font: { size: 11, weight: 'bold' }
                },
                ticks: {
                    stepSize: 10,
                    callback: function(value) {
                        return value + '°C';
                    },
                    autoSkip: false,
                    font: { size: 10, weight: 'bold' }
                },
                afterBuildTicks: function(axis) {
                    axis.ticks = [];
                    for (let i = TEMP_MIN_SCALE; i <= TEMP_MAX_SCALE; i += 10) {
                        axis.ticks.push({ value: i });
                    }
                }
            },
            x: {
                grid: { display: false },
                title: { 
                    display: true, 
                    text: 'Waktu (HH:MM:SS)', 
                    color: '#5a6e7a',
                    font: { size: 11, weight: 'bold' }
                },
                ticks: {
                    maxRotation: 45,
                    minRotation: 45,
                    autoSkip: true,
                    maxTicksLimit: 15,
                    font: { size: 9 }
                }
            }
        }
    };
    
    // Opsi untuk grafik kelembaban (skala 0-100% dengan interval 10%)
    const humOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: { display: false },
            tooltip: { 
                mode: 'index', 
                intersect: false,
                callbacks: {
                    label: function(context) {
                        return `${context.dataset.label}: ${context.raw.toFixed(1)}%`;
                    },
                    title: function(tooltipItems) {
                        return `Waktu: ${tooltipItems[0].label}`;
                    }
                }
            }
        },
        scales: {
            y: {
                min: 0,
                max: 100,
                grid: { 
                    color: '#e2e8f0',
                    lineWidth: 1,
                    drawBorder: true
                },
                title: { 
                    display: true, 
                    text: 'Kelembaban (%)', 
                    color: '#5a6e7a',
                    font: { size: 11, weight: 'bold' }
                },
                ticks: {
                    stepSize: 10,
                    callback: function(value) {
                        return value + '%';
                    },
                    autoSkip: false,
                    font: { size: 10, weight: 'bold' }
                },
                afterBuildTicks: function(axis) {
                    axis.ticks = [];
                    for (let i = 0; i <= 100; i += 10) {
                        axis.ticks.push({ value: i });
                    }
                }
            },
            x: {
                grid: { display: false },
                title: { 
                    display: true, 
                    text: 'Waktu (HH:MM:SS)', 
                    color: '#5a6e7a',
                    font: { size: 11, weight: 'bold' }
                },
                ticks: {
                    maxRotation: 45,
                    minRotation: 45,
                    autoSkip: true,
                    maxTicksLimit: 15,
                    font: { size: 9 }
                }
            }
        }
    };
    
    tc1Chart = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: historyTimestamps,
            datasets: [{
                label: 'Termokopel 1',
                data: historyTC1,
                borderColor: '#e67e22',
                backgroundColor: 'rgba(230, 126, 34, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 2,
                pointHoverRadius: 5,
                pointBackgroundColor: '#e67e22'
            }]
        },
        options: tempOptions
    });
    
    tc2Chart = new Chart(ctx2, {
        type: 'line',
        data: {
            labels: historyTimestamps,
            datasets: [{
                label: 'Termokopel 2',
                data: historyTC2,
                borderColor: '#f39c12',
                backgroundColor: 'rgba(243, 156, 18, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 2,
                pointHoverRadius: 5,
                pointBackgroundColor: '#f39c12'
            }]
        },
        options: tempOptions
    });
    
    humChart = new Chart(ctx3, {
        type: 'line',
        data: {
            labels: historyTimestamps,
            datasets: [{
                label: 'Kelembaban',
                data: historyHum,
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 2,
                pointHoverRadius: 5,
                pointBackgroundColor: '#3498db'
            }]
        },
        options: humOptions
    });
}

// Inisialisasi data history awal dengan timestamp
function initHistoryData() {
    const now = new Date();
    for(let i = 0; i < HISTORY_SIZE; i++) {
        const timestamp = new Date(now.getTime() - ((HISTORY_SIZE - i) * 2000));
        historyTimestamps.push(formatTimeFromDate(timestamp));
        
        let baseVal1 = 55.3 + (Math.sin(i * 0.2) * 8);
        let baseVal2 = 75.0 + (Math.cos(i * 0.15) * 6);
        let baseHum = 52.1 + (Math.sin(i * 0.25) * 8);
        
        historyTC1.push(Math.min(TEMP_MAX_SCALE, Math.max(TEMP_MIN_SCALE, baseVal1 + (Math.random() * 2 - 1))));
        historyTC2.push(Math.min(TEMP_MAX_SCALE, Math.max(TEMP_MIN_SCALE, baseVal2 + (Math.random() * 2 - 1))));
        historyHum.push(Math.min(85, Math.max(25, baseHum + (Math.random() * 3 - 1.5))));
    }
}

// Inisialisasi nilai read-only PID
function initReadOnlyValues() {
    setpointReadonly.innerText = setpoint.toFixed(1);
    kpReadonly.innerText = Kp.toFixed(1);
    kiReadonly.innerText = Ki.toFixed(2);
    kdReadonly.innerText = Kd.toFixed(2);
}

// Inisialisasi saat halaman dimuat
window.onload = () => {
    // Start timer untuk waktu berjalan sistem
    startRunningTimer();
    
    // Inisialisasi nilai read-only PID
    initReadOnlyValues();
    
    // Inisialisasi history data dengan timestamp
    initHistoryData();
    
    // Set nilai awal dari file gambar
    tc1 = 55.3;
    tc2 = 75.0;
    humidity = 52.1;
    
    // Inisialisasi chart
    initCharts();
    
    // Update awal
    updateSystem();
    
    // Set interval update setiap 2 detik
    if(updateInterval) clearInterval(updateInterval);
    updateInterval = setInterval(() => {
        updateSystem();
    }, 2000);
    
    // Tambahkan event resize untuk merender ulang grafik saat ukuran berubah
    window.addEventListener('resize', () => {
        if (tc1Chart) tc1Chart.resize();
        if (tc2Chart) tc2Chart.resize();
        if (humChart) humChart.resize();
    });
};