const Book = require('../models/Book');
const mongoose = require('mongoose');
const fs = require('fs');

exports.createBook = (req, res, next) => {
    console.log("Enter createBook");
    const bookObject = JSON.parse(req.body.book);
    delete bookObject._id;
    delete bookObject._userId;
    const book = new Book({
        ...bookObject,
        userId: req.auth.userId,
        imageUrl: `${req.protocol}://${req.get('host')}/images/${req.file.filename}`
    });
    console.log("Toujours dans createBook");
    book.save()
        .then(() => { res.status(201).json({ message: 'Objet enregistré !' }) })
        .catch(error => { res.status(400).json({ error }) })
};

exports.modifyBook = (req, res, next) => {
    console.log('enter modifyBook');
    const bookObject = req.file ? {
        ...JSON.parse(req.body.book),
        imageUrl: `${req.protocol}://${req.get('host')}/images/${req.file.filename}`
    } : { ...req.body };

    delete bookObject._userId;
    Book.findOne({ _id: req.params.id })
        .then((book) => {
            if (book.userId != req.auth.userId) {
                res.status(401).json({ message: 'Not authorized' });
            } else {
                Book.updateOne({ _id: req.params.id }, { ...bookObject, _id: req.params.id })
                    .then(() => res.status(200).json({ message: 'Objet modifié!' }))
                    .catch(error => res.status(401).json({ error }));
            }
        })
        .catch((error) => {
            res.status(400).json({ error });
        });
};

exports.deleteBook = (req, res, next) => {
    console.log('enter deleteBook');

    // Vérifier si l'ID du livre est valide
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        console.log('deleteBook livre inexistant');
        return res.status(404).json({ message: 'Livre non trouvé' });
    }

    Book.findOne({ _id: req.params.id })
        .then(book => {
            console.log('enter then.deleteBook');
            if (book.userId != req.auth.userId) {
                res.status(401).json({ message: 'Not authorized' });
            } else {
                console.log('enter else deleteBook');
                const filename = book.imageUrl.split('/images/')[1];
                console.log('filename = %s', filename);
                fs.unlink(`images/${filename}`, () => {
                    console.log('enter fs.unlink');
                    Book.deleteOne({ _id: req.params.id })
                        .then(() => { res.status(200).json({ message: 'Objet supprimé !' }) })
                        .catch(error => res.status(401).json({ error }));
                });
            }
        })
        .catch(error => {
            console.log('Error DeleteBook');
            res.status(500).json({ error });
        });
};

exports.deleteThing = (req, res, next) => {
    Thing.findOne({ _id: req.params.id })
        .then(thing => {
            if (thing.userId != req.auth.userId) {
                res.status(401).json({ message: 'Not authorized' });
            } else {
                const filename = thing.imageUrl.split('/images/')[1];
                fs.unlink(`images/${filename}`, () => {
                    Thing.deleteOne({ _id: req.params.id })
                        .then(() => { res.status(200).json({ message: 'Objet supprimé !' }) })
                        .catch(error => res.status(401).json({ error }));
                });
            }
        })
        .catch(error => {
            res.status(500).json({ error });
        });
};

exports.getOneBook = (req, res, next) => {
    console.log('enter getOneBook');
    Book.findOne({ _id: req.params.id })
        .then(book => {
            res.status(200).json(book);
            console.log('good result getOneBook');
            next();
        })
        .catch(error => res.status(404).json({ error }));
    console.log('exit getOneBook');
}

exports.getAllBook = (req, res, next) => {
    console.log('getAllBook');
    Book.find()
        .then(books => res.status(200).json(books))
        .catch(error => res.status(400).json({ error }));
}

exports.bestRating = (req, res, next) => {
    console.log('enter bestRating');
    // Utilisez la méthode aggregate de Mongoose pour calculer la note moyenne de chaque livre
    Book.aggregate([
        {
            $project: {
                userId: 1,
                title: 1,
                author: 1,
                imageUrl: 1,
                year: 1,
                genre: 1,
                ratings: 1,
                averageRating: { $avg: "$ratings.grade" } // Utilisez le champ "grade" pour calculer la moyenne des notes
            }
        },
        {
            $sort: { averageRating: -1 } // Triez par ordre décroissant de la note moyenne
        },
        {
            $limit: 3 // Limitez le résultat à 3 livres
        }
    ])
        .then(books => res.status(200).json(books))
        .catch(error => res.status(500).json({ error }));
}

exports.rating = (req, res, next) => {
    console.log('enter rating')
    const userId = req.auth.userId;
    const rating = req.body.rating;

    // Vérifier si la note est comprise entre 0 et 5
    if (rating < 0 || rating > 5) {
        return res.status(400).json({ message: 'La note doit être comprise entre 0 et 5.' });
    }

    // Chercher le livre par son ID
    Book.findById(req.params.id)
        .then(book => {
            if (!book) {
                return res.status(404).json({ message: 'Livre non trouvé.' });
            }

            // Vérifier si l'utilisateur a déjà noté ce livre
            const userRating = book.ratings.find(rating => rating.userId === userId);
            if (userRating) {
                return res.status(400).json({ message: 'Vous avez déjà noté ce livre.' });
            }

            // Ajouter la nouvelle note à la liste des notes
            book.ratings.push({ userId, grade: rating });

            // Mettre à jour la note moyenne du livre
            const totalRatings = book.ratings.length;
            const sumRatings = book.ratings.reduce((sum, rating) => sum + rating.grade, 0);
            book.averageRating = sumRatings / totalRatings;

            // Sauvegarder le livre mis à jour dans la base de données
            return book.save();
        })
        .then(updatedBook => {
            res.status(200).json(updatedBook);
        })
        .catch(error => {
            res.status(500).json({ error });
        });
}