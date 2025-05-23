const express = require('express');
const axios = require('axios');
const cors = require('cors');
const jwt_decode = require('jwt-decode');
const { v4: uuidv4 } = require('uuid');
require('express-async-errors');
const http = require('http');
const bodyParser = require('body-parser');

require('dotenv').config();

const CONFIG = {
    PORT: process.env.PORT || 80,
    CAS_URL: process.env.CAS_URL,
    API_SECRET: process.env.API_SECRET,
    API_KEY: process.env.API_KEY,
}

const ROOMS = {};

// Delete rooms that almost expired
setInterval(() => {
    for(const [key, value] of Object.entries(ROOMS)) {
        if (value.exp < (Date.now() - 5 * 60 * 1000)) {
            delete ROOMS[key];
        }
    }
}, 60e3)

const app = express();
app.use(bodyParser.json());

app.use(cors());

app.post('/room/create', async function (req, res) {
    const {name, playerId, videoId} = req.body;
    const id = name || uuidv4();
    if (!ROOMS[id]) {
        const [wt, sync] = await Promise.all([
            axios.get(`${CONFIG.CAS_URL}/stream/token/v2/`, {
                headers: {
                    "Auth-API-Key": CONFIG.API_KEY,
                    "Auth-API-Secret": CONFIG.API_SECRET,
                }
            }),
            axios.get(`${CONFIG.CAS_URL}/sync/token/`, {
                headers: {
                    "Auth-API-Key": CONFIG.API_KEY,
                    "Auth-API-Secret": CONFIG.API_SECRET,
                }
            }),
        ])

        const wtToken = wt.data.token;
        const syncToken = sync.data.token;
        const exp = Math.min(jwt_decode(wtToken).exp, jwt_decode(syncToken).exp) * 1000;

        ROOMS[id] = {
            name: id,
            playerId, 
            videoId,
            wtToken,
            syncToken,
            exp,
        };
    }

    res.json(ROOMS[id]);
});

app.get('/room/:id', function (req, res) {
    const id = req.params.id;
    if (!ROOMS[id]) {
        res.status(404).json({error: 'Room not found'});
    } else {
        res.json(ROOMS[id])
    }
});

app.use(function (e, req, res, next) {
    console.error(e);
    res.status(500).json({error: e.message});
});

const server = http.createServer(app);
server.listen(CONFIG.PORT, () => {
    console.log(`listening on *:${CONFIG.PORT}`);
});

module.exports = server;





