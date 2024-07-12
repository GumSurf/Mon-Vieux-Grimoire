const Book = require('../models/Book');
const fs = require('fs');

const { Storage } = require('@google-cloud/storage');

// Configuration du client Google Cloud Storage
const storage = new Storage({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    projectId: process.env.GCS_PROJECT_ID
});

const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

exports.createBook = (req, res, next) => {
    const bookObject = JSON.parse(req.body.book);
    delete bookObject._id;
    delete bookObject._userId;
    const book = new Book({
        ...bookObject,
        userId: req.auth.userId,
        imageUrl: `${req.protocol}://${req.get('host')}/${req.webpPath}`
    });

    // Upload de l'image vers Google Cloud Storage
    const blob = bucket.file(book.imageUrl);
    const blobStream = blob.createWriteStream({
        resumable: false,
        gzip: true,
        metadata: {
            contentType: req.file.mimetype
        }
    });

    blobStream.on('error', (err) => {
        console.error('Erreur lors du téléchargement de l\'image vers GCS:', err);
        res.status(500).json({ error: 'Erreur lors du téléchargement de l\'image vers GCS' });
    });

    blobStream.on('finish', () => {
        // Une fois l'image téléchargée, enregistrer le livre dans la base de données
        book.save()
            .then(() => { res.status(201).json({ message: 'Objet enregistré !' }) })
            .catch(error => { 
                res.status(400).json({ error }) });
    });

    // Écrire le buffer de l'image dans le flux
    blobStream.end(req.file.buffer);

    /*book.save()
        .then(() => { res.status(201).json({ message: 'Objet enregistré !' }) })
        .catch(error => { res.status(400).json({ error }) })*/
};

exports.modifyBook = (req, res, next) => {
    const bookObject = req.file ? {
        ...JSON.parse(req.body.book),
        imageUrl: `${req.protocol}://${req.get('host')}/${req.webpPath}`
    } : { ...req.body };

    delete bookObject._userId;
    Book.findOne({ _id: req.params.id })
        .then((book) => {
            if (book.userId != req.auth.userId) {
                res.status(401).json({ message: 'Not authorized' });
            } else {
                // Supprimer l'ancienne image de GCS
                const oldFileName = book.imageUrl;
                bucket.file(oldFileName).delete()
                    .then(() => {
                        // Upload de la nouvelle image vers GCS
                        const blob = bucket.file(bookObject.imageUrl);
                        const blobStream = blob.createWriteStream({
                            resumable: false,
                            gzip: true,
                            metadata: {
                                contentType: req.file.mimetype
                            }
                        });

                        blobStream.on('error', (err) => {
                            console.error('Erreur lors du téléchargement de l\'image vers GCS:', err);
                            res.status(500).json({ error: 'Erreur lors du téléchargement de l\'image vers GCS' });
                        });

                        blobStream.on('finish', () => {
                            // Mettre à jour le livre dans la base de données avec la nouvelle image
                            Book.updateOne({ _id: req.params.id }, { ...bookObject, _id: req.params.id })
                                .then(() => res.status(200).json({ message: 'Objet modifié!' }))
                                .catch(error => res.status(401).json({ error }));
                        });

                        blobStream.end(req.file.buffer);
                    })
                    .catch(error => {
                        res.status(500).json({ error })});
            }
        })
        .catch((error) => {
            res.status(400).json({ error });
        });
    /*} else {
        Book.updateOne({ _id: req.params.id }, { ...bookObject, _id: req.params.id })
            .then(() => res.status(200).json({ message: 'Objet modifié!' }))
            .catch(error => res.status(401).json({ error }));
    }
})
.catch((error) => {
    res.status(400).json({ error });
});*/
};

exports.deleteBook = (req, res, next) => {
    Book.findOne({ _id: req.params.id })
        .then(book => {
            if (book.userId != req.auth.userId) {
                res.status(401).json({ message: 'Not authorized' });
            } else {
                const filename = book.imageUrl.split('/images/')[1];
                fs.unlink(`images/${filename}`, () => {
                    Book.deleteOne({ _id: req.params.id })
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
    Book.findOne({ _id: req.params.id })
        .then(book => {
            res.status(200).json(book);
            next();
        })
        .catch(error => res.status(404).json({ error }));
}

exports.getAllBook = (req, res, next) => {
    Book.find()
        .then(books => res.status(200).json(books))
        .catch(error => res.status(400).json({ error }));
}

exports.bestRating = (req, res, next) => {
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