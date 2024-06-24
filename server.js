const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 8080;

let users = [];
let rooms = [
	{ roomID: "public", roomName: "Public Room", messages: [], users: [] },
];

app.use(express.static("public"));

io.on("connection", socket => {
	console.log("New client connected", socket.id);

	socket.on("checkUsername", data => {
		const userExists = users.some(user => user.name === data.user);
		if (userExists) {
			socket.emit("usernameExists");
		} else {
			socket.emit("usernameAvailable");
		}
	});

    socket.on("signin", data => {
        const user = {
            sessionID: data.sessionID,
            name: data.user,
            photo: data.photo,
            socketID: socket.id,
        };
        users.push(user);
    
        // Filter rooms for the current user
        const userRooms = rooms.filter(room => 
            room.users.some(u => u.sessionID === user.sessionID) || room.roomID === 'public'
        );
    
        // Send back the users and filtered rooms to the client
        socket.emit("signin", { users: users, rooms: userRooms });
        io.emit("updateUsers", { users: users });
    });
    
    
    

	socket.on("logout", data => {
		users = users.filter(user => user.sessionID !== data.sessionID);
		io.emit("updateUsers", { users: users });
	});

    socket.on("createRoom", data => {
        const newRoom = {
            roomID: data.roomID,
            roomName: data.roomName,
            messages: [],
            users: data.users.map(user =>
                users.find(u => u.sessionID === user.sessionID)
            ),
        };
        rooms.push(newRoom);
    
        // Emit the new room to users who are part of this room
        newRoom.users.forEach(user => {
            io.to(user.socketID).emit("newRoom", { rooms: [newRoom] });
        });
    });
    
    
    socket.on("joinRoom", data => {
        const user = users.find(user => user.sessionID === data.sessionID);
        if (user) {
            user.currentRoomID = data.roomID;
            socket.join(data.roomID);
            const room = rooms.find(room => room.roomID === data.roomID);
            if (room) {
                // Add user to the room if not already present
                if (!room.users.some(u => u.sessionID === user.sessionID)) {
                    room.users.push(user);
                }
    
                // Send back the room messages when the user joins
                socket.emit("roomMessages", {
                    roomID: data.roomID,
                    messages: room.messages,
                });
    
                // Update room list for the user
                socket.emit("newRoom", { rooms: [room] });
            }
        }
    });
    

    socket.on("message", data => {
        try {
            const room = rooms.find(room => room.roomID === data.roomID);
            if (room) {
                room.messages.push({ user: data.user, message: data.message });
                io.to(data.roomID).emit("message", {
                    user: data.user,
                    message: data.message,
                    roomID: data.roomID,
                });
    
                // Emit the unread message count update to all users in the room except the sender
                room.users.forEach(user => {
                    if (user.sessionID !== data.sessionID) {
                        io.to(user.socketID).emit("updateUnread", { roomID: data.roomID });
                    }
                });
            }
        } catch (error) {
            console.error('Error handling message event:', error);
        }
    });
    
    
	socket.on("videoCallInvite", data => {
		const targetUser = users.find(
			user => user.sessionID === data.targetSessionID
		);
		if (targetUser) {
			io.to(targetUser.socketID).emit("videoCallInvite", {
				from: data.from,
				roomID: data.roomID,
			});
		}
	});

	socket.on("videoCallAccept", data => {
		const targetUser = users.find(user => user.name === data.to);
		if (targetUser) {
			io.to(targetUser.socketID).emit("videoCallAccept", {
				from: data.from,
				roomID: data.roomID,
			});
		}
	});

	socket.on("tictactoeInvite", data => {
		const targetUser = users.find(
			user => user.sessionID === data.targetSessionID
		);
		if (targetUser) {
			io.to(targetUser.socketID).emit("tictactoeInvite", {
				from: data.from,
				roomID: data.roomID,
			});
		}
	});

	socket.on("tictactoeAccept", data => {
		const targetUser = users.find(user => user.name === data.to);
		if (targetUser) {
			io.to(targetUser.socketID).emit("tictactoeAccept", {
				from: data.from,
				roomID: data.roomID,
			});
		}
	});

	socket.on("offer", data => {
		const targetUser = users.find(user => user.name === data.to);
		if (targetUser) {
			io.to(targetUser.socketID).emit("offer", {
				offer: data.offer,
				roomID: data.roomID,
				from: data.from,
			});
		}
	});

	socket.on("answer", data => {
		const targetUser = users.find(user => user.name === data.to);
		if (targetUser) {
			io.to(targetUser.socketID).emit("answer", {
				answer: data.answer,
				roomID: data.roomID,
				from: data.from,
			});
		}
	});

	socket.on("iceCandidate", data => {
		const targetUser = users.find(user => user.name === data.to);
		if (targetUser) {
			io.to(targetUser.socketID).emit("iceCandidate", {
				candidate: data.candidate,
				roomID: data.roomID,
				from: data.from,
			});
		}
	});

    
    socket.on("endCall", data => {
        const room = rooms.find(room => room.roomID === data.roomID);
        if (room) {
            const otherUsers = room.users.filter(user => user.sessionID !== data.sessionID);
            otherUsers.forEach(user => {
                io.to(user.socketID).emit("callEnded", { roomID: data.roomID });
            });
        }
    });

    
    socket.on('disconnect', () => {
        const user = users.find(user => user.socketID === socket.id);
        if (user) {
            users = users.filter(user => user.socketID !== socket.id);
            io.emit('updateUsers', { users: users });

            // Notify the other users in the current room about the disconnection
            const room = rooms.find(room => room.roomID === user.currentRoomID);
            if (room) {
                const otherUsers = room.users.filter(u => u.socketID !== socket.id);
                otherUsers.forEach(u => {
                    io.to(u.socketID).emit('peerDisconnected', { roomID: user.currentRoomID });
                });
            }
        }
        console.log('Client disconnected', socket.id);
    });

    
});

server.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`);
});
