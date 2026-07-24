const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const utilisateurs = new Map();

io.on("connection", (socket) => {

    console.log("Utilisateur connecté :", socket.id);

    socket.on("register", (userId) => {
        utilisateurs.set(userId, socket.id);
        console.log("Utilisateur enregistré :", userId);
    });

    socket.on("call-user", (data) => {
        const destinataire = utilisateurs.get(data.to);

        if (destinataire) {
            io.to(destinataire).emit("incoming-call", data);
        }
    });

    socket.on("answer-call", (data) => {
        const destinataire = utilisateurs.get(data.to);

        if (destinataire) {
            io.to(destinataire).emit("call-answered", data);
        }
    });

    socket.on("ice-candidate", (data) => {
        const destinataire = utilisateurs.get(data.to);

        if (destinataire) {
            io.to(destinataire).emit("ice-candidate", data);
        }
    });

    socket.on("end-call", (data) => {
        const destinataire = utilisateurs.get(data.to);

        if (destinataire) {
            io.to(destinataire).emit("call-ended", data);
        }
    });

    socket.on("disconnect", () => {

        console.log("Utilisateur déconnecté :", socket.id);

        for (const [userId, socketId] of utilisateurs.entries()) {
            if (socketId === socket.id) {
                utilisateurs.delete(userId);
                break;
            }
        }
    });

});

app.get("/", (req, res) => {
    res.send("FriendyChat Signaling Server fonctionne.");
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log("Serveur lancé sur le port", PORT);
});
