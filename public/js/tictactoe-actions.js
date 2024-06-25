let tictactoeButton = $("#start-tictactoe");
let tictactoeModal = new bootstrap.Modal($("#tictactoeModal")[0]);
let acceptTictactoeButton = $("#accept-tictactoe");
let tictactoeFromText = $("#tictactoe-from");

function inviteToTicTacToe(socket, room) {
    const currentUsername = localStorage.getItem("username");
    const targetUser = room.users.find(
        user => user.sessionID !== localStorage.getItem("sessionID")
    );
    console.log("Current User:", currentUsername);
    console.log("Target User:", targetUser);

    if (targetUser && targetUser.name) {
        console.log(`Inviting ${targetUser.name} to play Tic Tac Toe`);
        socket.emit("tictactoeInvite", {
            from: currentUsername,
            to: targetUser.name,
            targetSessionID: targetUser.sessionID,
            roomID: room.roomID,
        });
    } else {
        console.log(
            "Target user not found or has no name for Tic Tac Toe invite"
        );
    }
}

function handleTicTacToeInvite(data, socket, users) {
    if (tictactoeFromText) {
        console.log(`Received Tic Tac Toe invite from ${data.from}`);
        tictactoeFromText.text(`Tic Tac Toe invite from ${data.from}`);
        acceptTictactoeButton
            .off("click")
            .on("click", () => acceptTicTacToe(socket, users, data.from, data.roomID));
        tictactoeModal.show();
    } else {
        console.error("tictactoeFromText element not found");
    }
}

function acceptTicTacToe(socket, users, from, roomID) {
    tictactoeModal.hide();
    socket.emit("tictactoeAccept", {
        from: localStorage.getItem("username"),
        to: from,
        roomID: roomID,
    });
    const room = users.find(r => r.roomID === roomID);
    if (room) {
        joinRoom(room, socket); // Redirect to private room with title
    } else {
        joinRoom({
            roomID: roomID,
            roomName: "Private Room",
            messages: [],
            unread: 0,
        }, socket);
    }
    startTicTacToe(roomID, socket, users);
}

function handleTicTacToeAccept(data, socket, users) {
    console.log(`Tic Tac Toe accepted by ${data.from}`);
    const room = users.find(r => r.roomID === data.roomID);
    if (room) {
        joinRoom(room, socket); // Redirect to private room with title
    } else {
        joinRoom({
            roomID: data.roomID,
            roomName: "Private Room",
            messages: [],
            unread: 0,
        }, socket);
    }
    startTicTacToe(data.roomID, socket, users);
}

function handleTicTacToeMessage(data) {
    const message = JSON.parse(data);
    if (message.type === "move") {
        // Handle Tic Tac Toe move
        updateTicTacToeBoard(message.move);
    }
}

function updateTicTacToeBoard(move) {
    // Update the Tic Tac Toe board with the new move
    console.log("Tic Tac Toe move:", move);
}

// Setup event listeners
tictactoeButton.on("click", () => {
    const room = state.rooms.find(r => r.roomID === state.currentRoomID);
    inviteToTicTacToe(state.socket, room);
});

state.socket.on("tictactoeInvite", data => {
    handleTicTacToeInvite(data, state.socket, state.users);
});

state.socket.on("tictactoeAccept", data => {
    handleTicTacToeAccept(data, state.socket, state.users);
});
