const uuid = require('uuid/v4')
const express = require('express')

module.exports = {
    init(app, db) {
        const multer  = require('multer')

        const possibleMimetypes = ['image/jpeg', 'image/png'];
        const folder = 'uploads';

        const storage = multer.diskStorage({
            destination: function (req, file, cb) {
            cb(null, folder)
            },
            filename: function (req, file, cb) {
            const extension = file.originalname.split('.')[1]
            cb(null, `${Date.now()}.${extension}`)
            }
        })
        const fileFilter = (req, file, cb) => {
        if (possibleMimetypes.includes(file.mimetype)) {
            cb(null, true)
        } else {
            cb(null, false)
        }
        }
        const upload = multer({ storage, fileFilter })

        app.use(`/${folder}`, express.static(folder))

        app.post('/upload', upload.array('images[]', 12), function (req, res, next) {
            const uploads = req.files.map(f => ({
                id: uuid(),
                filePath: f.path,
                title: f.filename,
                size: f.size
            }))
            uploads.forEach(upl => db.push(upl))
            res.send(uploads)
        })
    }
}