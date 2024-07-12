const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const multer = require('multer');
const { Storage } = require('@google-cloud/storage');

const bookRoutes = require('./routes/book');
const userRoutes = require('./routes/user');

mongoose.connect('mongodb+srv://GumSurf:RW6UmgSjwKozlA3l@monvieuxgrimoire.oop7i2i.mongodb.net/?retryWrites=true&w=majority',
    {
        useNewUrlParser: true,
        useUnifiedTopology: true
    })
    .then(() => console.log('Connexion à MongoDB réussie !'))
    .catch(() => console.log('Connexion à MongoDB échouée !'));

const app = express();


const corsOptions = {
    origin: ['https://gumsurf.github.io', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content', 'Accept', 'Content-Type', 'Authorization']
};

app.use(cors());

app.use(express.json());

app.get('/', (req, res, next) => {
    res.send('Bienvenue sur mon serveur Mon Vieux Grimoire !');
    next();
});

app.use('/api/books', bookRoutes);
app.use('/api/auth', userRoutes);
app.use('/images', express.static(path.join(__dirname, 'images')));

module.exports = app;

