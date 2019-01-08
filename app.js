const express = require('express')
const cors = require('cors')
const uuid = require('uuid/v4')
const app = express()
const port = process.env.PORT || 9000

const db = [];

app.use(cors())
app.get('/', (req, res) => res.send(db))

const uploadCb = function (req, res, next) {
    const uploads = req.files.map(f => ({
        id: uuid(),
        filePath: f.path,
        title: f.filename,
        size: f.size
    }))
    uploads.forEach(upl => db.push(upl))
    res.send(uploads)
}

require('./uploader').init(app, uploadCb);

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
