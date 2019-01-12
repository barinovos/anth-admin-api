const express = require('express')
const cors = require('cors')
const uuid = require('uuid/v4')
const sizeOf = require('image-size')
const bodyParser = require('body-parser')
const app = express()
const port = process.env.PORT || 9000

// PROD
let db = [];
// DEV: for testing purpose
// let db = [{"id":"7fcb6ad1-5517-4ed5-b3bb-9e7a2e88bae8","filePath":"uploads/1547302188557.jpg","title":"1547302188557.jpg","size":171702,"width":1280,"height":960,"onCanvas":false,"dimension":1}];
const canvas = {};

app.use(cors())
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
// just a handover - default GET is for images (for now)
app.get('/', (req, res) => res.send(db))

app.get('/canvas', (req, res) => res.send(canvas))

app.get('/images', (req, res) => res.send(db))

app.put('/image/:id', (req, res) => {
    const imageId = req.params.id
    const itemToUpdate = checkForItemWithRespond(imageId, res)
    if (itemToUpdate) {
        const newItem = updateItem(itemToUpdate, req.body)
        db = db.map(im => im.id === imageId ? newItem : im)
        res.send(db)
    }
})

app.delete('/image/:id', (req, res) => {
    const imageId = req.params.id
    if (checkForItemWithRespond(imageId, res)) {
        db = db.filter(im => im.id !== imageId)
        removeFromCanvas(imageId)
        res.send(db)
    }
})

app.put('/add-to-canvas/:id', (req, res) => {
    const imageId = req.params.id;
    const itemToUpdate = checkForItemWithRespond(imageId, res)
    if (itemToUpdate) {
        db = db.map(im => im.id === imageId ? { ...im, onCanvas: true } : im)
        canvas[imageId] = addToCanvas(itemToUpdate)
        res.send(db)
    }
})

app.delete('/remove-from-canvas/:id', (req, res) => {
    const imageId = req.params.id;
    if (checkForItemWithRespond(imageId, res)) {
        removeFromCanvas(imageId)
        db = db.map(im => im.id === imageId ? { ...im, onCanvas: false } : im)
        res.send(db)
    }
})

app.put('/canvas/:id', (req, res) => {
    const data = req.body;
    const imageId = req.params.id;
    if (canvas[imageId]) {
        const oldData = { ...canvas[imageId] };
        canvas[imageId] = { ...oldData, ...data, path: oldData.path }
        res.send(canvas)
    } else {
        res.status(404).send(`Item ${imageId} is not on the canvas`)
    }
})

const checkForItemWithRespond = (imageId, res) => {
    const imageToUpdate = db.find(im => im.id === imageId)
    if (!imageToUpdate) { 
        res.status(404).send(`Image with id ${imageId} not found`)
        return false
    }
    return imageToUpdate
}

const addToCanvas = item => ({
    x: 0,
    y: 0,
    width: item.width,
    height: item.height,
    path: item.filePath
})

const updateItem = (item, data) => ({
    ...item,
    ...data,
    id: item.id,
    filePath: item.filePath,
    size: item.size,
    onCanvas: item.onCanvas
})

const removeFromCanvas = itemId => {
    if (canvas[itemId]) {
        delete canvas[itemId];
    }
}

const uploadCb = function (req, res) {
    const uploads = req.files.map(f => {
        const dimensions = sizeOf(f.path);
        return {
            id: uuid(),
            filePath: f.path,
            title: f.filename,
            size: f.size,
            width: dimensions.width,
            height: dimensions.height,
            onCanvas: false,
            dimension: 1
        }
    })
    uploads.forEach(upl => db.push(upl))
    res.send(db)
}

require('./uploader').init(app, uploadCb);

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
