const express = require('express')

module.exports = {
  init(app, uploadCb, pinUploadCb) {
    const multer = require('multer')

    const possibleMimetypes = ['image/jpeg', 'image/png']
    const folder = 'uploads'

    const storage = multer.diskStorage({
      destination: function(req, file, cb) {
        cb(null, folder)
      },
      filename: function(req, file, cb) {
        const extension = file.originalname.split('.')[1]
        cb(null, `${Date.now()}.${extension}`)
      },
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

    app.post('/upload', upload.array('images[]', 12), uploadCb)

    app.post('/pin-upload', upload.single('image'), pinUploadCb)
  },
}
