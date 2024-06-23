const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 8080;

let users = [];
let rooms = [{ roomID: 'public', roomName: 'Public Room', messages: [], users: [] }];

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('New client connected', socket.id);

    socket.on('checkUsername', (data) => {
        const userExists = users.some(user => user.name === data.user);
        if (userExists) {
            socket.emit('usernameExists');
        } else {
            socket.emit('usernameAvailable');
        }
    });

    socket.on('signin', (data) => {
        const user = { sessionID: data.sessionID, name: data.user, photo: data.photo, socketID: socket.id };
        users.push(user);
        
        // Send back the users and rooms to the client
        socket.emit('signin', { users: users, rooms: rooms });
        io.emit('updateUsers', { users: users });
    });
    

    socket.on('logout', (data) => {
        users = users.filter(user => user.sessionID !== data.sessionID);
        io.emit('updateUsers', { users: users });
    });

    socket.on('createRoom', (data) => {
        const newRoom = {
            roomID: data.roomID,
            roomName: data.roomName,
            messages: [],
            users: data.users.map(user => users.find(u => u.sessionID === user.sessionID))
        };
        rooms.push(newRoom);
        io.emit('newRoom', { rooms: rooms });
    });

    socket.on('joinRoom', (data) => {
        const user = users.find(user => user.sessionID === data.sessionID);
        if (user) {
            user.currentRoomID = data.roomID;
            socket.join(data.roomID);
        }
    });

    socket.on('message', (data) => {
        const room = rooms.find(room => room.roomID === data.roomID);
        if (room) {
            room.messages.push({ user: data.user, message: data.message });
            io.to(data.roomID).emit('message', { user: data.user, message: data.message, roomID: data.roomID });
        }
    });

    socket.on('videoCallInvite', (data) => {
        const targetUser = users.find(user => user.sessionID === data.targetSessionID);
        if (targetUser) {
            io.to(targetUser.socketID).emit('videoCallInvite', { from: data.from, roomID: data.roomID });
        }
    });

    socket.on('videoCallAccept', (data) => {
        const targetUser = users.find(user => user.name === data.to);
        if (targetUser) {
            io.to(targetUser.socketID).emit('videoCallAccept', { from: data.from, roomID: data.roomID });
        }
    });

    socket.on('offer', (data) => {
        const targetUser = users.find(user => user.name === data.to);
        if (targetUser) {
            io.to(targetUser.socketID).emit('offer', { offer: data.offer, roomID: data.roomID });
        }
    });

    socket.on('answer', (data) => {
        const targetUser = users.find(user => user.name === data.to);
        if (targetUser) {
            io.to(targetUser.socketID).emit('answer', { answer: data.answer, roomID: data.roomID });
        }
    });

    socket.on('iceCandidate', (data) => {
        const targetUser = users.find(user => user.name === data.to);
        if (targetUser) {
            io.to(targetUser.socketID).emit('iceCandidate', { candidate: data.candidate, roomID: data.roomID });
        }
    });

    socket.on('disconnect', () => {
        users = users.filter(user => user.socketID !== socket.id);
        io.emit('updateUsers', { users: users });
        console.log('Client disconnected', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
