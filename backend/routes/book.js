const express = require('express');
const auth = require('../middleware/auth');
const router = express.Router();
const upload = require('../middleware/multer-config');

const bookCtrl = require('../controllers/book');
const uploadImageMiddleware = require('../middleware/uploadImage');

const Multer = require('multer');

const multer = Multer({
    storage: Multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024  // Limite de taille du fichier, ajustez selon vos besoins
    }
});

router.get('/', bookCtrl.getAllBook);
router.get('/bestrating', bookCtrl.bestRating);
router.delete('/:id', auth, bookCtrl.deleteBook);
router.get('/:id', bookCtrl.getOneBook);

// Utilisez le middleware de Multer ici
router.post('/', auth, multer.single('image'), bookCtrl.createBook);

router.put('/:id', auth, multer.single('image'), bookCtrl.modifyBook);
router.post('/:id/rating', auth, bookCtrl.rating);

module.exports = router;
