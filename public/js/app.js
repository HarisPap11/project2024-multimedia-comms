$(document).ready(() => {
    let forumPage = $("#forum-page");
    let roomsList = $("#rooms-list");
    let createRoomButton = $("#create-room");
    let userSelection = $("#user-selection");
    let userCheckboxList = $("#user-checkbox-list");
    let selectUserButton = $("#select-user");
    let roomNameInput = $("#room-name");
    let usersList = $("#users-list");
    let chatBox = $("#chat-box");
    let messageForm = $("#message-form");
    let messageInput = $("#message-input");
    let logoutButton = $("#logout-button");
    let chatTitle = $("#chat-title");
    let videoCallButton = $("#start-video-call");
    let videoCallModal = new bootstrap.Modal($("#videoCallModal")[0]);
    let callFromText = $("#call-from");
    let acceptCallButton = $("#accept-call");
    let publicRoomJoinButton = $("#room-public .join-btn");
    let videoContainer = $("#video-container");
    let endCallButton = $("#end-call");
    let previousRoomID = null;

    let state = {
        selfieDataURL: localStorage.getItem("selfieDataURL"),
        socket: io(),
        sessionID: localStorage.getItem("sessionID"),
        currentRoomID: "public",
        currentRoomName: "Public Chat",
        users: [],
        rooms: [],
        peerConnection: null,
        localStream: null,
        remoteStream: null,
        iceCandidatesQueue: [], // Initialize the queue for ICE candidates
        dataChannel: null,
    };

    if (!state.sessionID || !localStorage.getItem("username")) {
        window.location.href = "login.html";
    }

    $("#reject-call").on("click", () => {
        state.socket.emit("rejectCall", {
            callerSessionID: state.callerSessionID, // Store callerSessionID when initiating the call
            roomID: state.currentRoomID,
        });
    });

    initSocketIo(localStorage.getItem("username"), state.sessionID);

    // Initialize Tic Tac Toe functionality
    initTicTacToe(state.socket, state.users, state.currentRoomID);

    function initSocketIo(username, sessionID) {
        state.socket.emit("signin", {
            user: username,
            sessionID: sessionID,
            photo: state.selfieDataURL,
        });

        state.socket.on("signin", data => {
            console.log("Signin data received:", data);
            updateUserList(data.users);
            if (data.rooms) {
                updateRoomList(data.rooms); // Ensure rooms are updated on sign-in
            }
            messageForm.on("submit", e => {
                e.preventDefault();
                sendMessage();
            });

            logoutButton.on("click", () => {
                state.socket.emit("logout", {
                    user: username,
                    sessionID: sessionID,
                });
                localStorage.removeItem("username");
                localStorage.removeItem("sessionID");
                localStorage.removeItem("selfieDataURL");
                window.location.href = "login.html";
            });

            // Hide the public room join button on signin
            publicRoomJoinButton.hide();
        });

        state.socket.on("updateUsers", data => {
            updateUserList(data.users);
        });

        state.socket.on("newRoom", data => {
            data.rooms.forEach(room => {
                if (!state.rooms.some(r => r.roomID === room.roomID)) {
                    state.rooms.push(room);
                    addRoomToList(room);
                }
            });
            console.log("Updated room list:", state.rooms);
        });

        state.socket.on("message", data => {
            handleMessage(data);
        });

        state.socket.on("videoCallInvite", data => {
            handleVideoCallInvite(data);
        });

        state.socket.on("videoCallAccept", data => {
            handleVideoCallAccept(data);
        });

        state.socket.on("offer", data => {
            handleOffer(data);
        });

        state.socket.on("answer", data => {
            handleAnswer(data);
        });

        state.socket.on("iceCandidate", data => {
            handleIceCandidate(data);
        });

        state.socket.on("updateUnread", data => {
            const room = state.rooms.find(r => r.roomID === data.roomID);
            if (room) {
                room.unread = (room.unread || 0) + 1;
                updateRoomUnreadCount(room);
            }
        });

        state.socket.on("roomMessages", data => {
            const room = state.rooms.find(r => r.roomID === data.roomID);
            if (room) {
                room.messages = data.messages;
                if (data.roomID === state.currentRoomID) {
                    chatBox.empty();
                    room.messages.forEach(msg => {
                        chatBox.append(
                            `<div><strong>${msg.user}:</strong> ${msg.message}</div>`
                        );
                    });
                    chatBox.scrollTop(chatBox[0].scrollHeight);
                }
            }
        });

        state.socket.on("callEnded", data => {
            if (data.roomID === state.currentRoomID) {
                console.log("Received call ended signal from server.");
                endCall();
            }
        });

        state.socket.on("peerDisconnected", data => {
            if (data.roomID === state.currentRoomID) {
                endCall();
            }
        });

        // Ensure the public room is initialized and joined on page load
        state.socket.emit("joinRoom", {
            user: username,
            roomID: "public",
            sessionID: sessionID,
        });
        joinRoom({
            roomID: "public",
            roomName: "Public Room",
            messages: [],
            unread: 0,
        });

        // Initialize Tic Tac Toe functionality
        initTicTacToe(state.socket, state.users, state.currentRoomID);
    }

    function sendMessage() {
        const message = messageInput.val().trim();
        if (message !== "") {
            state.socket.emit("message", {
                message: message,
                user: localStorage.getItem("username"),
                roomID: state.currentRoomID,
                sessionID: state.sessionID,
            });
            messageInput.val("");
        }
    }

    function handleMessage(data) {
        console.log("Message received:", data);
        let room = state.rooms.find(r => r.roomID === data.roomID);
        if (!room) {
            room = {
                roomID: data.roomID,
                roomName:
                    data.roomID === "public"
                        ? "Public Room"
                        : data.roomName || "New Room",
                messages: [],
                unread: 0,
            };
            state.rooms.push(room);
            addRoomToList(room);
        }

        room.messages.push({
            user: data.user,
            message: data.message,
        });

        // Check if the current room ID matches the message's room ID
        if (data.roomID === state.currentRoomID) {
            chatBox.append(
                `<div><strong>${data.user}:</strong> ${data.message}</div>`
            );
            chatBox.scrollTop(chatBox[0].scrollHeight);
            room.unread = 0; // Reset unread count if the user is in the room
            updateRoomUnreadCount(room); // Update the badge immediately
        } else {
            room.unread++;
            updateRoomUnreadCount(room);
        }
    }

    function updateRoomUnreadCount(room) {
        const roomElement = $(`#room-${room.roomID}`);
        let unreadBadge = roomElement.find(".unread-badge");
        if (!unreadBadge.length) {
            unreadBadge = $("<span>")
                .addClass("badge bg-danger unread-badge me-2")
                .text(room.unread)
                .hide();
            roomElement.prepend(unreadBadge);
        }
        unreadBadge.text(room.unread).toggle(room.unread > 0); // Ensure this hides the badge when unread is 0
    }

    function updateUserList(userList) {
        const currentUsername = localStorage.getItem("username");
        state.users = userList;
        usersList.empty();
        userCheckboxList.empty();

        const currentUser = state.users.find(user => user.name === currentUsername);
        const otherUsers = state.users.filter(
            user => user.name !== currentUsername
        );

        const appendUserToList = (user, isCurrentUser = false) => {
            const listItem = $("<li>").addClass(
                "list-group-item d-flex align-items-center"
            );
            if (user.photo) {
                const img = $("<img>")
                    .attr("src", user.photo)
                    .addClass("rounded-circle me-2")
                    .css({
                        width: "40px",
                        height: "40px",
                    });
                listItem.append(img);
            }
            listItem.append(
                document.createTextNode(`${user.name}${isCurrentUser ? " (me)" : ""}`)
            );
            usersList.append(listItem);

            if (!isCurrentUser) {
                const radioItem = $("<li>").addClass(
                    "list-group-item d-flex align-items-center"
                );
                const radio = $("<input>").attr({
                    type: "radio",
                    name: "userSelection",
                    class: "form-check-input me-2",
                    value: user.sessionID,
                });
                radioItem.append(radio);
                if (user.photo) {
                    const img = $("<img>")
                        .attr("src", user.photo)
                        .addClass("rounded-circle me-2")
                        .css({
                            width: "40px",
                            height: "40px",
                        });
                    radioItem.append(img);
                }
                radioItem.append(document.createTextNode(user.name));
                userCheckboxList.append(radioItem);
            } else {
                const selectedUserItem = $("<li>").addClass(
                    "list-group-item d-flex align-items-center"
                );
                selectedUserItem.append(document.createTextNode(`${user.name} (me)`));
                userCheckboxList.prepend(selectedUserItem);
            }
        };

        if (currentUser) appendUserToList(currentUser, true);
        otherUsers.forEach(user => appendUserToList(user));
        console.log("Updated user list:", state.users);
    }

    function updateRoomList(roomList) {
        state.rooms = roomList || [];
        roomsList.find("li:not(#room-public)").remove(); // Clear the room list completely except public room
        state.rooms.forEach(room => addRoomToList(room));
        console.log("Updated room list:", state.rooms);

        // Ensure the public room join button is correctly set up
        const publicRoomElement = $("#room-public");
        if (publicRoomElement.length) {
            const publicJoinButton = publicRoomElement.find(".join-btn");
            if (publicJoinButton.length) {
                publicJoinButton.toggle(state.currentRoomID !== "public");
            }
        }
    }

    createRoomButton.on("click", () => {
        userSelection.removeClass("d-none");
    });

    selectUserButton.on("click", () => {
        const selectedUser = userCheckboxList.find(
            'input[name="userSelection"]:checked'
        );
        if (selectedUser.length) {
            const selectedUserId = selectedUser.val();
            const selectedUserName = selectedUser.next().text().trim();
            const roomName = roomNameInput.val().trim();
            console.log("Selected User ID:", selectedUserId);
            console.log("Selected User Name:", selectedUserName);

            if (roomName) {
                const roomID = `room_${Math.random().toString(36).substring(2, 15)}`;
                const newRoom = {
                    roomID: roomID,
                    roomName: roomName,
                    messages: [],
                    unread: 0,
                    users: [
                        {
                            sessionID: state.sessionID,
                            name: localStorage.getItem("username"),
                        },
                        {
                            sessionID: selectedUserId,
                            name: selectedUserName,
                        },
                    ],
                };
                addRoomToList(newRoom);
                state.rooms.push(newRoom); // Ensure room is added to the state
                state.socket.emit("createRoom", {
                    roomID: newRoom.roomID,
                    roomName: newRoom.roomName,
                    users: newRoom.users,
                });
                userSelection.addClass("d-none");
                roomNameInput.val("");
                userCheckboxList.find('input[type="radio"]').prop("checked", false);
            } else {
                alert("Please provide a room name.");
            }
        } else {
            alert("Please select a user.");
        }
    });

    function addRoomToList(room) {
        console.log(`Adding room to list: ${room.roomName}`);
        if ($(`#room-${room.roomID}`).length === 0) {
            const listItem = $("<li>")
                .addClass(
                    "list-group-item d-flex justify-content-between align-items-center"
                )
                .attr("id", `room-${room.roomID}`);
            listItem.html(
                `<span><span class="badge bg-danger unread-badge me-2" style="display: none;">0</span>${
                    room.roomName
                }</span>${
                    room.roomID !== state.currentRoomID
                        ? '<button class="btn btn-primary btn-sm join-btn">Join</button>'
                        : ""
                }`
            );
            const joinButton = listItem.find(".join-btn");
            if (joinButton.length) {
                joinButton.on("click", () => joinRoom(room));
            }
            roomsList.append(listItem);
        }
    }

    roomsList.on("click", ".join-btn", e => {
        const roomElement = $(e.target).closest("li");
        const roomID = roomElement.attr("id").split("-")[1];
        const room = state.rooms.find(r => r.roomID === roomID) || {
            roomID: "public",
            roomName: "Public Room",
            messages: [],
        };
        joinRoom(room);
    });

    function inviteToVideoCall(room) {
        const currentUsername = localStorage.getItem("username");
        const targetUser = room.users.find(
            user => user.sessionID !== state.sessionID
        );
        console.log("Current User:", currentUsername);
        console.log("Target User:", targetUser);

        if (targetUser && targetUser.sessionID) {
            state.callerSessionID = state.sessionID; // Store caller's session ID
            console.log(`Inviting ${targetUser.name} to a video call`);
            state.socket.emit("videoCallInvite", {
                from: currentUsername,
                to: targetUser.name,
                targetSessionID: targetUser.sessionID,
                roomID: room.roomID,
            });
        } else {
            console.log("Target user not found or has no name for video call invite");
        }
    }

    function handleVideoCallInvite(data) {
        if (callFromText) {
            console.log(`Received video call invite from ${data.from}`);
            callFromText.text(`Call from ${data.from}`);
            acceptCallButton
                .off("click")
                .on("click", () => acceptVideoCall(data.from, data.roomID));
            videoCallModal.show();
        } else {
            console.error("callFromText element not found");
        }
    }

    function acceptVideoCall(from, roomID) {
        videoCallModal.hide();
        state.socket.emit("videoCallAccept", {
            from: localStorage.getItem("username"),
            to: from,
            roomID: roomID,
        });
        const room = state.rooms.find(r => r.roomID === roomID);
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
        startVideoCall(roomID);
    }

    function handleVideoCallAccept(data) {
        console.log(`Video call accepted by ${data.from}`);
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
        startVideoCall(data.roomID);
    }


    function handleOffer(data) {
        console.log("Received offer:", data);
        if (!state.peerConnection) {
            startPeerConnection(data.roomID);
        }
        state.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer))
            .then(() => navigator.mediaDevices.getUserMedia({ video: true, audio: true }))
            .then(stream => {
                state.localStream = stream;
                $("#local-video")[0].srcObject = stream;
                stream.getTracks().forEach(track => state.peerConnection.addTrack(track, stream));
                return state.peerConnection.createAnswer();
            })
            .then(answer => state.peerConnection.setLocalDescription(answer))
            .then(() => {
                state.socket.emit("answer", {
                    answer: state.peerConnection.localDescription,
                    roomID: data.roomID,
                    to: data.from,
                });
            })
            .catch(error => console.error("Error handling offer:", error));
    }
    
    function handleAnswer(data) {
        console.log("Received answer:", data);
        if (state.peerConnection) {
            state.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer))
                .catch(error => console.error("Error handling answer:", error));
        }
    }
    

    function handleIceCandidate(data) {
        console.log("Received ICE candidate:", data);
        if (state.peerConnection) {
            state.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate))
                .catch(error => console.error("Error adding received ice candidate:", error));
        } else {
            console.error("PeerConnection not established yet.");
        }
    }
    
    function startPeerConnection(roomID) {
        console.log(`Starting peer connection for room: ${roomID}`);
        state.peerConnection = new RTCPeerConnection();
    
        state.peerConnection.ontrack = event => {
            state.remoteStream = event.streams[0];
            $("#remote-video")[0].srcObject = state.remoteStream;
        };
    
        state.peerConnection.onicecandidate = event => {
            if (event.candidate) {
                state.socket.emit("iceCandidate", {
                    candidate: event.candidate,
                    roomID: roomID,
                });
            }
        };
    }
    

    function startVideoCall(roomID) {
        console.log(`Starting video call in room: ${roomID}`);
        const localVideo = $("#local-video")[0];
        const remoteVideo = $("#remote-video")[0];
        const currentUsername = localStorage.getItem("username");
        const targetUser = state.users.find(
            user => user.sessionID !== state.sessionID
        );

        navigator.mediaDevices
            .getUserMedia({
                video: true,
                audio: true,
            })
            .then(stream => {
                state.localStream = stream;
                localVideo.srcObject = stream;
                $("#local-username").text(currentUsername);

                const peerConnection = new RTCPeerConnection();

                stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

                peerConnection.ontrack = event => {
                    state.remoteStream = event.streams[0];
                    remoteVideo.srcObject = state.remoteStream;
                    if (targetUser) {
                        $("#remote-username").text(targetUser.name);
                    }
                };

                peerConnection.onicecandidate = event => {
                    if (event.candidate) {
                        state.socket.emit("iceCandidate", {
                            candidate: event.candidate,
                            roomID: roomID,
                            to: targetUser.name,
                        });
                    }
                };

                peerConnection
                    .createOffer()
                    .then(offer => {
                        return peerConnection.setLocalDescription(offer);
                    })
                    .then(() => {
                        state.socket.emit("offer", {
                            offer: peerConnection.localDescription,
                            roomID: roomID,
                            to: targetUser.name,
                        });
                    })
                    .catch(error => console.error("Error starting video call:", error));

                state.peerConnection = peerConnection; // Store the peer connection in the state

                // Show the video container and the end call button, hide the start video call button
                videoContainer.removeClass("d-none");
                $("#start-video-call").addClass("d-none");
                $("#end-call").removeClass("d-none");
            })
            .catch(error => console.error("Error accessing media devices.", error));
    }

    state.socket.on("callRejected", data => {
        if (data.roomID === state.currentRoomID) {
            alert("The other user has rejected the call.");
        }
    });



    function endCall() {
        console.log("Ending call...");
        if (state.peerConnection) {
            state.peerConnection.close();
            state.peerConnection = null;
        }
    
        if (state.localStream) {
            state.localStream.getTracks().forEach(track => track.stop());
            state.localStream = null;
        }
    
        if (state.remoteStream) {
            state.remoteStream.getTracks().forEach(track => track.stop());
            state.remoteStream = null;
        }
    
        $("#local-video")[0].srcObject = null;
        $("#remote-video")[0].srcObject = null;
    
        videoContainer.addClass("d-none");
        $("#start-video-call").removeClass("d-none");
        $("#end-call").addClass("d-none");
    
        console.log("Call has been ended and UI elements have been reset.");
    }
    
    endCallButton.on("click", () => {
        console.log("End call button clicked, ending call.");
        endCall();  // This ends the call locally
    
        state.socket.emit("endCall", {
            roomID: state.currentRoomID,
            participants: state.rooms.find(r => r.roomID === state.currentRoomID)?.users.map(user => user.sessionID)
        });
    });
    
    state.socket.on("callEnded", data => {
        console.log("Received call ended signal from server.");
        if (data.roomID === state.currentRoomID) {
            endCall();
        }
    });

    
    endCallButton.on("click", () => {
        console.log("End call button clicked, ending call.");
        endCall();  // This ends the call locally
    
        state.socket.emit("endCall", {
            roomID: state.currentRoomID,
            participants: state.rooms.find(r => r.roomID === state.currentRoomID)?.users.map(user => user.sessionID)
        });
    });
    
    state.socket.on("callEnded", data => {
        console.log("Received call ended signal from server.");
        if (data.roomID === state.currentRoomID) {
            endCall();
        }
    });
    
    // Handling end call on the server side
    state.socket.on('endCall', (data) => {
        console.log("Received end call request for room:", data.roomID);
        data.participants.forEach(participantSessionID => {
            state.socket.to(participantSessionID).emit('callEnded', { roomID: data.roomID });
        });
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

        state.socket.emit("joinRoom", {
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
            videoCallButton.addClass("d-none");
        } else {
            videoCallButton.removeClass("d-none");
            videoCallButton.off("click").on("click", () => {
                console.log(`Video Call button clicked in room: ${room.roomName}`);
                inviteToVideoCall(room);
            });
        }
    }
});
