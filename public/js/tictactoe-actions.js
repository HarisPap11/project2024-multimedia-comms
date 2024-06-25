function initTicTacToe(socket, users, currentRoomID) {
    let tictactoeButton = $("#start-tictactoe");
    let tictactoeModal = new bootstrap.Modal($("#tictactoeModal")[0]);
    let acceptTictactoeButton = $("#accept-tictactoe");
    let tictactoeFromText = $("#tictactoe-from");

    function inviteToTicTacToe(room) {
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

    function handleTicTacToeInvite(data) {
        if (tictactoeFromText) {
            console.log(`Received Tic Tac Toe invite from ${data.from}`);
            tictactoeFromText.text(`Tic Tac Toe invite from ${data.from}`);
            acceptTictactoeButton
                .off("click")
                .on("click", () => acceptTicTacToe(data.from, data.roomID));
            tictactoeModal.show();
        } else {
            console.error("tictactoeFromText element not found");
        }
    }

    function acceptTicTacToe(from, roomID) {
        tictactoeModal.hide();
        socket.emit("tictactoeAccept", {
            from: localStorage.getItem("username"),
            to: from,
            roomID: roomID,
        });
        const room = users.find(r => r.roomID === roomID);
        if (room) {
            joinRoom(room); // Redirect to private room with title
        } else {
            joinRoom({
                roomID: roomID,
                roomName: "Private Room",
                messages: [],
                unread: 0,
            });
        }
        startTicTacToe(roomID);
    }

    function handleTicTacToeAccept(data) {
        console.log(`Tic Tac Toe accepted by ${data.from}`);
        const room = state.rooms.find(r => r.roomID === data.roomID);
        if (room) {
            joinRoom(room); // Redirect to private room with title
        } else {
            joinRoom({
                roomID: data.roomID,
                roomName: "Private Room",
                messages: [],
                unread: 0,
            });
        }
        startTicTacToe(data.roomID);
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

    tictactoeButton.on("click", () => {
        const room = state.rooms.find(r => r.roomID === state.currentRoomID);
        inviteToTicTacToe(room);
    });

    socket.on("tictactoeInvite", data => {
        handleTicTacToeInvite(data);
    });

    socket.on("tictactoeAccept", data => {
        handleTicTacToeAccept(data);
    });

    function joinRoom(room) {
        console.log(`Joining room: ${room.roomName}`);

        state.currentRoomID = room.roomID;
        state.currentRoomName = room.roomName;

        chatTitle.text(state.currentRoomName);
        chatBox.empty();

        room.messages.forEach(msg => {
            chatBox.append(`<div><strong>${msg.user}:</strong> ${msg.message}</div>`);
        });
        chatBox.scrollTop(chatBox[0].scrollHeight);

        room.unread = 0; // Reset unread count when joining the room
        updateRoomUnreadCount(room);

        state.rooms.forEach(r => {
            const roomElement = $(`#room-${r.roomID}`);
            const joinButton = roomElement.find(".join-btn");
            if (joinButton.length) {
                joinButton.toggle(r.roomID !== state.currentRoomID);
            }
        });

        socket.emit("joinRoom", {
            user: localStorage.getItem("username"),
            roomID: state.currentRoomID,
            sessionID: state.sessionID,
        });

        // Toggle public room join button visibility
        const publicRoomElement = $("#room-public");
        if (publicRoomElement.length) {
            const publicJoinButton = publicRoomElement.find(".join-btn");
            if (publicJoinButton.length) {
                publicJoinButton.toggle(state.currentRoomID !== "public");
            }
        }

        if (room.roomID === "public") {
            publicRoomJoinButton.hide();
            tictactoeButton.addClass("d-none");
        } else {
            tictactoeButton.removeClass("d-none");
            tictactoeButton.off("click").on("click", () => {
                console.log(`Tic Tac Toe button clicked in room: ${room.roomName}`);
                inviteToTicTacToe(room);
            });
        }
    }
}

