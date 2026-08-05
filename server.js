'use strict';

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST']
}));

app.use(express.json());

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling']
});

/*
|--------------------------------------------------------------------------
| Utilisateurs connectés
|--------------------------------------------------------------------------
|
| userId => socketId
|
*/

const utilisateurs = new Map();

function obtenirSocketUtilisateur(userId) {
    return utilisateurs.get(String(userId)) || null;
}

io.on('connection', function (socket) {
    console.log('Connexion Socket.IO :', socket.id);

    /*
    |--------------------------------------------------------------------------
    | Enregistrer l’utilisateur connecté
    |--------------------------------------------------------------------------
    */

    socket.on('register', function (userId) {
        const id = String(userId || '').trim();

        if (!id) {
            return;
        }

        utilisateurs.set(id, socket.id);
        socket.data.userId = id;

        console.log(
            'Utilisateur enregistré :',
            id,
            socket.id
        );

        socket.emit('registered', {
            success: true,
            userId: id
        });
    });

    /*
    |--------------------------------------------------------------------------
    | Appel entrant
    |--------------------------------------------------------------------------
    */

    socket.on('call-user', function (data) {
        const destinataireId = String(data?.to || '');
        const socketDestinataire =
            obtenirSocketUtilisateur(destinataireId);

        console.log(
            'Appel de',
            data?.from,
            'vers',
            destinataireId,
            'appel',
            data?.callId
        );

        if (!socketDestinataire) {
            socket.emit('user-unavailable', {
                to: destinataireId,
                callId: data?.callId || 0,
                message: 'Le contact n’est pas connecté.'
            });

            return;
        }

        io.to(socketDestinataire).emit(
            'incoming-call',
            {
                from: String(data?.from || ''),
                to: destinataireId,
                type: data?.type === 'video'
                    ? 'video'
                    : 'audio',
                callId: Number(data?.callId || 0),
                offer: data?.offer || null
            }
        );
    });

    /*
    |--------------------------------------------------------------------------
    | Appel accepté
    |--------------------------------------------------------------------------
    */

    socket.on('answer-call', function (data) {
        const destinataireId = String(data?.to || '');
        const socketDestinataire =
            obtenirSocketUtilisateur(destinataireId);

        if (!socketDestinataire) {
            return;
        }

        io.to(socketDestinataire).emit(
            'call-answered',
            {
                from: String(data?.from || ''),
                to: destinataireId,
                callId: Number(data?.callId || 0),
                answer: data?.answer || null
            }
        );
    });

    /*
    |--------------------------------------------------------------------------
    | Candidats ICE WebRTC
    |--------------------------------------------------------------------------
    */

    socket.on('ice-candidate', function (data) {
        const destinataireId = String(data?.to || '');
        const socketDestinataire =
            obtenirSocketUtilisateur(destinataireId);

        if (!socketDestinataire) {
            return;
        }

        io.to(socketDestinataire).emit(
            'ice-candidate',
            {
                from: String(data?.from || ''),
                to: destinataireId,
                callId: Number(data?.callId || 0),
                candidate: data?.candidate || null
            }
        );
    });

    /*
    |--------------------------------------------------------------------------
    | Appel terminé ou refusé
    |--------------------------------------------------------------------------
    */

    socket.on('end-call', function (data) {
        const destinataireId = String(data?.to || '');
        const socketDestinataire =
            obtenirSocketUtilisateur(destinataireId);

        if (!socketDestinataire) {
            return;
        }

        io.to(socketDestinataire).emit(
            'call-ended',
            {
                from: String(data?.from || ''),
                to: destinataireId,
                callId: Number(data?.callId || 0),
                status: data?.status || 'termine'
            }
        );
    });

    /*
    |--------------------------------------------------------------------------
    | Déconnexion
    |--------------------------------------------------------------------------
    */

    socket.on('disconnect', function () {
        const userId = socket.data.userId;

        if (
            userId &&
            utilisateurs.get(userId) === socket.id
        ) {
            utilisateurs.delete(userId);
        }

        console.log(
            'Socket déconnecté :',
            socket.id
        );
    });
});

/*
|--------------------------------------------------------------------------
| Page de test
|--------------------------------------------------------------------------
*/

app.get('/', function (req, res) {
    res.send(
        'Le serveur de signalisation FriendyChat fonctionne.'
    );
});

app.get('/status', function (req, res) {
    res.json({
        success: true,
        utilisateurs_connectes: utilisateurs.size
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', function () {
    console.log(
        'Serveur FriendyChat lancé sur le port',
        PORT
    );
});
