const sharp = require('sharp');
const fs = require('fs');

// Middleware pour traiter l'image avant de la sauvegarder
const uploadImageMiddleware = (req, res, next) => {
    // Chemin de sortie pour le fichier WebP
    const webpPath = req.file.path.replace(/\.(jpeg|jpg|png)$/, '.webp');

    // Utiliser Sharp pour redimensionner et convertir l'image en WebP
    sharp(req.file.path)
        .toFormat('webp')
        .toBuffer((err, data, info) => {
            if (err) {
                // Gérer l'erreur de conversion ici
                console.error('Erreur lors de la conversion en WebP :', err);
                return res.status(500).json({ error: 'Une erreur est survenue lors du traitement de l\'image.' });
            }

            // Créer le fichier WebP
            fs.writeFile(webpPath, data, (err) => {
                if (err) {
                    // Gérer l'erreur d'écriture du fichier WebP
                    console.error('Erreur lors de l\'écriture du fichier WebP :', err);
                    return res.status(500).json({ error: 'Une erreur est survenue lors du traitement de l\'image.' });
                }

                // Mettre à jour le chemin de l'image pour qu'il pointe vers le fichier WebP
                req.webpPath = webpPath;

                // Supprimer le fichier d'origine après la conversion
                fs.unlinkSync(req.file.path);
                
                next();
            });
        });
};

module.exports = uploadImageMiddleware;
