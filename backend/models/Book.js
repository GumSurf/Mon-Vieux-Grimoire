const mongoose = require('mongoose');

const Book = mongoose.Schema({
    userId: String, //identifiant MongoDB unique de l'utilisateur qui a créé le livre
    title: String, //titre du livre
    author: String, //auteur du livre
    imageUrl: String, //illustration / couverture du livre
    year: Number, //année de publication du livre
    genre: String, //genre du livre
    ratings: [
        {
            userId: String, //identifiant MongoDB unique de l'utilisateur qui a noté le livre
            grade: Number, //note donnée à un livre
        }
    ],
    averageRating: Number //note moyenne du livre
});

module.exports = mongoose.model('Book', Book);