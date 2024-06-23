document.addEventListener("DOMContentLoaded", () => {
    const elements = {
        loginForm: document.getElementById('login-form'),
        video: document.getElementById('video'),
        captureButton: document.getElementById('captureButton'),
        capture: document.getElementById('capture'),
        selfiePreview: document.getElementById('selfie-preview'),
    };

    let selfieDataURL = null;

    navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
        elements.video.srcObject = stream;
    }).catch(err => console.error("Error accessing the camera:", err));

    elements.capture.addEventListener('click', () => {
        new bootstrap.Modal(document.getElementById('selfieModal')).show();
    });

    elements.captureButton.addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width = elements.video.videoWidth;
        canvas.height = elements.video.videoHeight;
        canvas.getContext('2d').drawImage(elements.video, 0, 0, canvas.width, canvas.height);
        selfieDataURL = canvas.toDataURL('image/png');
        elements.selfiePreview.src = selfieDataURL;
        elements.selfiePreview.classList.remove('d-none');
        elements.capture.textContent = 'Recapture Selfie';
        bootstrap.Modal.getInstance(document.getElementById('selfieModal')).hide();
    });

    elements.loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        checkUsername(username);
    });

    function checkUsername(username) {
        const socket = io();

        socket.emit('checkUsername', { user: username });

        socket.on('usernameExists', () => {
            alert('Username already exists. Please choose another one.');
            socket.disconnect();
        });

        socket.on('usernameAvailable', () => {
            const sessionID = `session_${Math.random().toString(36).substring(2, 15)}`;
            localStorage.setItem('username', username);
            localStorage.setItem('selfieDataURL', selfieDataURL);
            localStorage.setItem('sessionID', sessionID);
            window.location.href = 'index.html';
            socket.disconnect();
        });

        socket.on('connect_error', (error) => {
            console.error('Socket.io connection error:', error);
        });
    }
});
