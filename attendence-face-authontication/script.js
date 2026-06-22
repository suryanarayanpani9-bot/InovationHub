const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';
const STUDENTS_KEY = 'attendanceFaceAuth.students';
const ATTENDANCE_KEY = 'attendanceFaceAuth.records';
const MATCH_THRESHOLD = 0.52;

const state = {
    modelsReady: false,
    cameraReady: false,
    capturedDescriptor: null,
    stream: null
};

const elements = {
    modelStatus: document.getElementById('modelStatus'),
    video: document.getElementById('video'),
    canvas: document.getElementById('snapshotCanvas'),
    cameraPlaceholder: document.getElementById('cameraPlaceholder'),
    startCameraBtn: document.getElementById('startCameraBtn'),
    captureBtn: document.getElementById('captureBtn'),
    cameraMessage: document.getElementById('cameraMessage'),
    enrollTab: document.getElementById('enrollTab'),
    attendanceTab: document.getElementById('attendanceTab'),
    enrollPanel: document.getElementById('enrollPanel'),
    attendancePanel: document.getElementById('attendancePanel'),
    studentName: document.getElementById('studentName'),
    studentId: document.getElementById('studentId'),
    enrollBtn: document.getElementById('enrollBtn'),
    markAttendanceBtn: document.getElementById('markAttendanceBtn'),
    clearDataBtn: document.getElementById('clearDataBtn'),
    resultText: document.getElementById('resultText'),
    studentCount: document.getElementById('studentCount'),
    attendanceTable: document.getElementById('attendanceTable'),
    exportBtn: document.getElementById('exportBtn')
};

function getStudents() {
    return JSON.parse(localStorage.getItem(STUDENTS_KEY) || '[]');
}

function saveStudents(students) {
    localStorage.setItem(STUDENTS_KEY, JSON.stringify(students));
}

function getAttendance() {
    return JSON.parse(localStorage.getItem(ATTENDANCE_KEY) || '[]');
}

function saveAttendance(records) {
    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(records));
}

function setStatus(message, type = '') {
    elements.resultText.textContent = message;
    elements.resultText.className = `result-text ${type}`.trim();
}

function setCameraMessage(message) {
    elements.cameraMessage.textContent = message;
}

function updateButtons() {
    const canUseFace = state.modelsReady && state.cameraReady;
    const hasStudents = getStudents().length > 0;

    elements.captureBtn.disabled = !canUseFace;
    elements.enrollBtn.disabled = !state.capturedDescriptor;
    elements.markAttendanceBtn.disabled = !canUseFace || !hasStudents;
}

function renderStudentCount() {
    elements.studentCount.textContent = getStudents().length.toString();
}

function renderAttendance() {
    const records = getAttendance();

    if (!records.length) {
        elements.attendanceTable.innerHTML = '<tr><td colspan="5">No attendance marked.</td></tr>';
        return;
    }

    elements.attendanceTable.innerHTML = records.slice(0, 10).map((record) => {
        const date = new Date(record.markedAt);
        return `
            <tr>
                <td>${escapeHtml(record.name)}</td>
                <td>${escapeHtml(record.studentId)}</td>
                <td>${date.toLocaleDateString()}</td>
                <td>${date.toLocaleTimeString()}</td>
                <td>${Math.round(record.confidence)}%</td>
            </tr>
        `;
    }).join('');
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

async function loadModels() {
    try {
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);

        state.modelsReady = true;
        elements.modelStatus.textContent = 'Models ready';
        elements.modelStatus.classList.add('ready');
        setStatus('Face models are ready.');
        updateButtons();
    } catch (error) {
        elements.modelStatus.textContent = 'Model error';
        elements.modelStatus.classList.add('error');
        setStatus('Could not load face models. Check your internet connection.', 'error');
        console.error(error);
    }
}

async function startCamera() {
    try {
        state.stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 960 },
                height: { ideal: 600 },
                facingMode: 'user'
            },
            audio: false
        });

        elements.video.srcObject = state.stream;
        await elements.video.play();
        state.cameraReady = true;
        elements.cameraPlaceholder.style.display = 'none';
        elements.startCameraBtn.textContent = 'Camera On';
        elements.startCameraBtn.disabled = true;
        setCameraMessage('Camera is ready.');
        updateButtons();
    } catch (error) {
        setCameraMessage('Camera access blocked. Use localhost or allow browser permission.');
        console.error(error);
    }
}

async function captureFace() {
    if (!state.modelsReady || !state.cameraReady) {
        setStatus('Start the camera and wait for models to load.', 'error');
        return null;
    }

    const detection = await faceapi
        .detectSingleFace(elements.video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.55 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

    if (!detection) {
        state.capturedDescriptor = null;
        elements.enrollBtn.disabled = true;
        setStatus('No clear face found. Face the camera and try again.', 'error');
        return null;
    }

    drawSnapshot();
    state.capturedDescriptor = Array.from(detection.descriptor);
    setStatus('Face captured successfully.', 'success');
    updateButtons();
    return state.capturedDescriptor;
}

function drawSnapshot() {
    const { video, canvas } = elements;
    const context = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
}

function enrollStudent(event) {
    event.preventDefault();

    const name = elements.studentName.value.trim();
    const studentId = elements.studentId.value.trim();

    if (!name || !studentId) {
        setStatus('Enter student name and ID before enrolling.', 'error');
        return;
    }

    if (!state.capturedDescriptor) {
        setStatus('Capture a face before enrolling.', 'error');
        return;
    }

    const students = getStudents();
    const existingIndex = students.findIndex((student) => student.studentId.toLowerCase() === studentId.toLowerCase());
    const student = {
        id: existingIndex >= 0 ? students[existingIndex].id : crypto.randomUUID(),
        name,
        studentId,
        descriptor: state.capturedDescriptor,
        enrolledAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
        students[existingIndex] = student;
    } else {
        students.push(student);
    }

    saveStudents(students);
    state.capturedDescriptor = null;
    elements.enrollPanel.reset();
    renderStudentCount();
    updateButtons();
    setStatus(`${name} enrolled for face authentication.`, 'success');
}

async function markAttendance() {
    const descriptor = await captureFace();

    if (!descriptor) {
        return;
    }

    const match = findBestMatch(descriptor);

    if (!match || match.distance > MATCH_THRESHOLD) {
        setStatus('Face authentication failed. No registered match found.', 'error');
        return;
    }

    const records = getAttendance();
    const now = new Date();
    const alreadyMarked = records.some((record) => {
        const markedAt = new Date(record.markedAt);
        return record.studentId === match.student.studentId && markedAt.toDateString() === now.toDateString();
    });

    if (alreadyMarked) {
        setStatus(`${match.student.name} is already marked present today.`, 'success');
        return;
    }

    const confidence = Math.max(0, (1 - (match.distance / MATCH_THRESHOLD)) * 100);
    records.unshift({
        name: match.student.name,
        studentId: match.student.studentId,
        markedAt: now.toISOString(),
        confidence
    });

    saveAttendance(records);
    renderAttendance();
    setStatus(`Attendance marked for ${match.student.name}.`, 'success');
}

function findBestMatch(descriptor) {
    const students = getStudents();

    if (!students.length) {
        return null;
    }

    return students
        .map((student) => ({
            student,
            distance: euclideanDistance(descriptor, student.descriptor)
        }))
        .sort((first, second) => first.distance - second.distance)[0];
}

function euclideanDistance(firstDescriptor, secondDescriptor) {
    const sum = firstDescriptor.reduce((total, value, index) => {
        const difference = value - secondDescriptor[index];
        return total + difference * difference;
    }, 0);

    return Math.sqrt(sum);
}

function switchTab(tabName) {
    const enrollActive = tabName === 'enroll';

    elements.enrollTab.classList.toggle('active', enrollActive);
    elements.attendanceTab.classList.toggle('active', !enrollActive);
    elements.enrollPanel.classList.toggle('active', enrollActive);
    elements.attendancePanel.classList.toggle('active', !enrollActive);
    elements.enrollTab.setAttribute('aria-selected', enrollActive.toString());
    elements.attendanceTab.setAttribute('aria-selected', (!enrollActive).toString());
}

function exportCsv() {
    const records = getAttendance();

    if (!records.length) {
        setStatus('No attendance records to export.', 'error');
        return;
    }

    const rows = [
        ['Name', 'Student ID', 'Marked At', 'Match Confidence'],
        ...records.map((record) => [
            record.name,
            record.studentId,
            new Date(record.markedAt).toLocaleString(),
            `${Math.round(record.confidence)}%`
        ])
    ];

    const csv = rows
        .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
        .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'attendance-records.csv';
    link.click();
    URL.revokeObjectURL(url);
}

function clearData() {
    const confirmed = confirm('Clear all enrolled students and attendance records?');

    if (!confirmed) {
        return;
    }

    localStorage.removeItem(STUDENTS_KEY);
    localStorage.removeItem(ATTENDANCE_KEY);
    state.capturedDescriptor = null;
    renderStudentCount();
    renderAttendance();
    updateButtons();
    setStatus('Demo data cleared.');
}

function bindEvents() {
    elements.startCameraBtn.addEventListener('click', startCamera);
    elements.captureBtn.addEventListener('click', captureFace);
    elements.enrollPanel.addEventListener('submit', enrollStudent);
    elements.markAttendanceBtn.addEventListener('click', markAttendance);
    elements.clearDataBtn.addEventListener('click', clearData);
    elements.exportBtn.addEventListener('click', exportCsv);
    elements.enrollTab.addEventListener('click', () => switchTab('enroll'));
    elements.attendanceTab.addEventListener('click', () => switchTab('attendance'));
}

function init() {
    bindEvents();
    renderStudentCount();
    renderAttendance();
    updateButtons();
    loadModels();
}

window.addEventListener('DOMContentLoaded', init);
