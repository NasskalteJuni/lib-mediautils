module.exports = handler => (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(err => {
        console.error(err);
        return next(new Error('Internal Server Error'));
    })
};