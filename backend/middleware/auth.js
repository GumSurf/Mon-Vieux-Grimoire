const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    console.log("dans auth.js");
    try {
        const token = req.headers.authorization.split(' ')[1];
        const decodedToken = jwt.verify(token, 'RANDOM_TOKEN_SECRET');
        const userId = decodedToken.userId;
        req.auth = {
            userId: userId
        };
    next();
    } catch(error) {
        res.status(401).json({ error });
    }
    console.log("Exit auth.js");
};