const multer = require('multer');

const MIME_TYPES = {
    'image/jpg': 'jpg',
    'image/jpeg': 'jpeg',
    'image/png': 'png',
    'image/webp': 'webp'
};

const storage = multer.diskStorage({
    destination: (req, file, callback) => {
        callback(null, 'images');
    },
    filename: (req, file, callback) => {
        const name = file.originalname.split(' ').join('_');
        const extension = MIME_TYPES[file.mimetype];
        callback(null, name + Date.now() + '.' + extension);
    }
});

// Configurer les limites de poids ici (taille maximale de 2 Mo)
const fileSizeLimit = 2 * 1024 * 1024; // 2 Mo

// Exportez multer en tant que middleware avec les limites de poids
module.exports = multer({
    storage: storage,
    limits: {
        fileSize: fileSizeLimit
    },
    fileFilter: (req, file, callback) => {
        // Vérifier si le type de fichier est une image valide
        const isValidFileType = Object.keys(MIME_TYPES).includes(file.mimetype);
        if (isValidFileType) {
            callback(null, true);
        } else {
            callback(new Error('Invalid file type.'));
        }
    }
});
