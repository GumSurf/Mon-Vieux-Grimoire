const { v4: uuidv4 } = require('uuid');
const Book = require('../models/Book');
const { Storage } = require('@google-cloud/storage');
const { getGCPCredentials } = require('config/GCPCredentials.js'); // Assurez-vous de remplacer par le bon chemin

const storageClient = new Storage(getGCPCredentials());
const bucketName = process.env.GCS_BUCKET_NAME; // Assurez-vous que le nom du bucket est défini dans vos variables d'environnement

const bucket = storageClient.bucket(bucketName);

exports.createBook = (req, res, next) => {
    const bookObject = JSON.parse(req.body.book);
    delete bookObject._id;
    delete bookObject._userId;
    const book = new Book({
        ...bookObject,
        userId: req.auth.userId,
        // Pas besoin d'imageUrl ici, elle sera générée lors de l'upload vers GCS
    });

    // Upload de l'image vers Google Cloud Storage
    const blob = bucket.file(`${uuidv4()}-${req.file.originalname}`); // Utilisez le nom original du fichier
    const blobStream = blob.createWriteStream();

    blobStream.on('error', (err) => {
        console.error('Erreur lors du téléchargement de l\'image vers GCS:', err);
        res.status(500).json({ error: 'Erreur lors du téléchargement de l\'image vers GCS' });
    });

    blobStream.on('finish', () => {
        // Une fois l'image téléchargée, enregistrer le livre dans la base de données avec l'URL de l'image GCS
        book.imageUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
        book.save()
            .then(() => {
                res.status(201).json({ message: 'Objet enregistré !' })
                console.log("Success !")
            })
            .catch(error => { res.status(400).json({ error }) });
    });

    // Écrire le buffer de l'image dans le flux
    blobStream.end(req.file.buffer);
};

exports.modifyBook = (req, res, next) => {
    const bookObject = req.file ? {
        ...JSON.parse(req.body.book),
        // Pas besoin d'imageUrl ici, elle sera mise à jour lors de l'upload vers GCS
    } : { ...req.body };

    delete bookObject._userId;

    let oldImageUrl; // Pour stocker l'ancienne URL de l'image

    Book.findOne({ _id: req.params.id })
        .then((book) => {
            if (!book) {
                return res.status(404).json({ message: 'Livre non trouvé' });
            }

            if (book.userId != req.auth.userId) {
                return res.status(401).json({ message: 'Non autorisé' });
            }

            if (req.file) {
                // Si un nouveau fichier a été téléchargé, supprimer l'ancienne image de GCS (si elle existe)
                oldImageUrl = book.imageUrl; // Sauvegarde de l'ancienne URL

                // Supprimer l'ancienne image de GCS (si elle existe)
                if (oldImageUrl) {
                    const filename = oldImageUrl.split(`/${bucket.name}/`)[1];
                    const file = bucket.file(filename);

                    file.delete()
                        .then(() => {
                            console.log(`Ancienne image supprimée de GCS: ${filename}`);
                            uploadNewImage(book);
                        })
                        .catch(err => {
                            console.error('Erreur lors de la suppression de l\'ancienne image de GCS:', err);
                            res.status(500).json({ error: 'Erreur lors de la suppression de l\'ancienne image de GCS' });
                        });
                } else {
                    uploadNewImage(book);
                }
            } else {
                // Si aucun nouveau fichier n'a été téléchargé, simplement mettre à jour le livre sans changer l'image
                Book.updateOne({ _id: req.params.id }, { ...bookObject })
                    .then(() => {
                        res.status(200).json({ message: 'Objet modifié sans changer l\'image!' });
                        console.log("Succès de la modification sans changement d'image !");
                    })
                    .catch(error => {
                        res.status(400).json({ error });
                    });
            }
        })
        .catch((error) => {
            res.status(400).json({ error });
        });

    function uploadNewImage(book) {
        console.log("req.file.originalname = ", req.file.originalname);
        // Upload de la nouvelle image vers GCS
        const uniqueName = `${uuidv4()}-${encodeURIComponent(req.file.originalname)}`;
        const blob = bucket.file(uniqueName);
        const blobStream = blob.createWriteStream();

        blobStream.on('error', (err) => {
            console.error('Erreur lors du téléchargement de l\'image vers GCS:', err);
            res.status(500).json({ error: 'Erreur lors du téléchargement de l\'image vers GCS' });
        });

        blobStream.on('finish', () => {
            // Mettre à jour le livre dans la base de données avec la nouvelle URL de l'image GCS
            book.imageUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
            Book.updateOne({ _id: req.params.id }, { ...bookObject, imageUrl: book.imageUrl })
                .then(() => {
                    res.status(200).json({ message: 'Objet modifié avec nouvelle image!' });
                    console.log("Succès de la modification avec nouvelle image !");
                })
                .catch(error => {
                    res.status(400).json({ error });
                });
        });

        // Écrire le buffer de l'image dans le flux
        blobStream.end(req.file.buffer);
    }
};

exports.deleteBook = (req, res, next) => {
    Book.findOne({ _id: req.params.id })
        .then(book => {
            if (!book) {
                return res.status(404).json({ message: 'Livre non trouvé' });
            }
            if (book.userId != req.auth.userId) {
                return res.status(401).json({ message: 'Non autorisé' });
            }

            // Récupérer le nom du fichier à partir de l'URL de l'image
            const filename = book.imageUrl.split(`/${bucket.name}/`)[1];
            const file = bucket.file(filename);

            // Supprimer l'image de GCS
            file.delete()
                .then(() => {
                    console.log(`Image supprimée de GCS: ${filename}`);

                    // Supprimer le livre de la base de données
                    Book.deleteOne({ _id: req.params.id })
                        .then(() => {
                            res.status(200).json({ message: 'Objet supprimé !' });
                        })
                        .catch(error => {
                            res.status(401).json({ error });
                        });
                })
                .catch(err => {
                    console.error('Erreur lors de la suppression de l\'image de GCS:', err);
                    res.status(500).json({ error: 'Erreur lors de la suppression de l\'image de GCS' });
                });
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