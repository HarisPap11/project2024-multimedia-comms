const X_CLASS = 'x';
const O_CLASS = 'o';
let currentClass = X_CLASS;
const board = document.getElementById('tictactoe-board');
const cells = document.querySelectorAll('[data-cell]');

function startTicTacToeGame() {
    board.classList.remove('d-none');
    cells.forEach(cell => {
        cell.classList.remove(X_CLASS);
        cell.classList.remove(O_CLASS);
        cell.removeEventListener('click', handleCellClick);
        cell.addEventListener('click', handleCellClick, { once: true });
    });
}

function handleCellClick(e) {
    const cell = e.target;
    placeMark(cell, currentClass);
    if (state.dataChannel) {
        state.dataChannel.send(JSON.stringify({ type: 'move', move: getCellIndex(cell), class: currentClass }));
    }
    if (checkWin(currentClass)) {
        endGame(false);
    } else if (isDraw()) {
        endGame(true);
    } else {
        swapTurns();
    }
}

function getCellIndex(cell) {
    return Array.from(cells).indexOf(cell);
}

function placeMark(cell, currentClass) {
    cell.classList.add(currentClass);
}

function swapTurns() {
    currentClass = currentClass === X_CLASS ? O_CLASS : X_CLASS;
}

function checkWin(currentClass) {
    const WINNING_COMBINATIONS = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6]
    ];
    return WINNING_COMBINATIONS.some(combination => {
        return combination.every(index => {
            return cells[index].classList.contains(currentClass);
        });
    });
}

function isDraw() {
    return Array.from(cells).every(cell => {
        return cell.classList.contains(X_CLASS) || cell.classList.contains(O_CLASS);
    });
}

function endGame(draw) {
    if (draw) {
        alert('Draw!');
    } else {
        alert(`${currentClass === X_CLASS ? 'X' : 'O'} Wins!`);
    }
    startTicTacToeGame(); // Restart the game
}

function handleTicTacToeMessage(data) {
    const message = JSON.parse(data);
    if (message.type === 'move') {
        const cell = cells[message.move];
        placeMark(cell, message.class);
        if (checkWin(message.class)) {
            endGame(false);
        } else if (isDraw()) {
            endGame(true);
        }
    }
}

function startTicTacToe(roomID) {
    console.log(`Starting Tic Tac Toe in room: ${roomID}`);
    const currentUsername = localStorage.getItem('username');
    const targetUser = state.users.find(user => user.sessionID !== state.sessionID);

    const peerConnection = new RTCPeerConnection();

    const dataChannel = peerConnection.createDataChannel('tictactoe');

    dataChannel.onopen = () => {
        console.log('Data channel is open');
        startTicTacToeGame();
    };

    dataChannel.onmessage = (event) => {
        console.log('Data channel message:', event.data);
        handleTicTacToeMessage(event.data);
    };

    peerConnection.ondatachannel = (event) => {
        event.channel.onopen = () => {
            console.log('Data channel is open');
            startTicTacToeGame();
        };
        event.channel.onmessage = (event) => {
            console.log('Data channel message:', event.data);
            handleTicTacToeMessage(event.data);
        };
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            state.socket.emit('iceCandidate', {
                candidate: event.candidate,
                roomID: roomID,
                to: targetUser.name
            });
        }
    };

    peerConnection.createOffer().then(offer => {
        return peerConnection.setLocalDescription(offer);
    }).then(() => {
        state.socket.emit('offer', {
            offer: peerConnection.localDescription,
            roomID: roomID,
            to: targetUser.name
        });
    });

    state.peerConnection = peerConnection;
    state.dataChannel = dataChannel;
}
