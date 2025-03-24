const { v4: uuidv4 } = require('uuid');
const Book = require('../models/Book');
const cloudinary = require("cloudinary").v2;
const multer = require("multer");

cloudinary.config({
    cloud_name: "dopysnsl1",
    api_key: "157758776167552",
    api_secret: "CVmR_Xv36NDMYbTyvoFQ3wcAnNE",
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

exports.createBook = async (req, res) => {
    try {
        const { book } = req.body;
        const parsedBook = JSON.parse(book);

        if (!req.file) {
            return res.status(400).json({ error: "Image required" });
        }

        // Upload l'image sur Cloudinary
        const uploadResponse = await cloudinary.uploader.upload_stream(
            { folder: "books" },
            async (error, result) => {
                if (error) {
                    return res.status(500).json({ error: "Upload failed" });
                }

                // Ajoute l'URL de l'image au livre
                parsedBook.imageUrl = result.secure_url;

                // Sauvegarde en base de données
                const newBook = await Book.create(parsedBook);
                res.status(201).json(newBook);
            }
        );

        uploadResponse.end(req.file.buffer);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.modifyBook = async (req, res) => {
    try {
        const bookObject = req.file
            ? {
                  ...JSON.parse(req.body.book),
                  // L'imageUrl sera mise à jour après le téléchargement vers Cloudinary
              }
            : { ...req.body };

        delete bookObject._userId;

        let oldImageUrl; // Pour stocker l'ancienne URL de l'image

        const book = await Book.findOne({ _id: req.params.id });

        if (!book) {
            return res.status(404).json({ message: "Livre non trouvé" });
        }

        if (book.userId != req.auth.userId) {
            return res.status(401).json({ message: "Non autorisé" });
        }

        // Si une nouvelle image est envoyée
        if (req.file) {
            oldImageUrl = book.imageUrl; // Sauvegarde de l'ancienne URL

            // Supprimer l'ancienne image de Cloudinary si elle existe
            if (oldImageUrl) {
                const publicId = oldImageUrl.split("/").slice(-2).join("/").split(".")[0];
                await cloudinary.uploader.destroy(publicId);
            }

            // Upload de la nouvelle image
            const uploadResponse = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    { folder: "books" },
                    (error, result) => (error ? reject(error) : resolve(result))
                );

                uploadStream.end(req.file.buffer);
            });

            // Mettre à jour l'URL de l'image
            bookObject.imageUrl = uploadResponse.secure_url;
        } else {
            // Si aucune nouvelle image n'est envoyée, on garde l'ancienne image
            bookObject.imageUrl = book.imageUrl;
        }

        // Mettre à jour les autres champs du livre dans la base de données
        const updatedBook = await Book.findByIdAndUpdate(req.params.id, { ...bookObject }, { new: true });

        if (!updatedBook) {
            return res.status(404).json({ message: "Erreur lors de la mise à jour du livre" });
        }

        res.status(200).json({ message: "Livre mis à jour avec succès !" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteBook = async (req, res) => {
    try {
        const book = await Book.findOne({ _id: req.params.id });

        if (!book) {
            return res.status(404).json({ message: "Livre non trouvé" });
        }

        if (book.userId != req.auth.userId) {
            return res.status(401).json({ message: "Non autorisé" });
        }

        // Supprimer l'image sur Cloudinary
        if (book.imageUrl) {
            const publicId = book.imageUrl.split("/").slice(-2).join("/").split(".")[0];
            await cloudinary.uploader.destroy(publicId);
        }

        // Supprimer le livre de la base de données
        await Book.deleteOne({ _id: req.params.id });

        res.status(200).json({ message: "Livre supprimé avec succès !" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
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