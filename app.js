const express = require('express')
const cors = require('cors')
const uuid = require('uuid/v4')
const sizeOf = require('image-size')
const bodyParser = require('body-parser')
const app = express()
const port = process.env.PORT || 9000
const swaggerUi = require('swagger-ui-express')
const swaggerDocument = require('./swagger.json')
const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')
// const flatten = require('lodash/flatten')

const adapter = new FileSync('db.json')
const db = low(adapter)
const dbFields = {
  images: 'images',
  sections: 'sections',
}

app.use(cors())
app.use(bodyParser.json()) // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))

// just a handover - default GET is for images (for now)
app.get('/db', (req, res) => res.send(db.getState()))

app.post('/section', (req, res) => {
  try {
    const newSection = {
      id: uuid(),
      imageIds: [],
      ...req.body,
    }
    db.update(dbFields.sections, arr => arr.concat(newSection)).write()
    res.send(db.getState())
  } catch (e) {
    onError(e, res)
  }
})

app.put('/section/:sectionId', (req, res) => {
  try {
    const sectionId = req.params.sectionId
    const data = req.body
    db.update(dbFields.sections, arr =>
      arr.map(section => (section.id === sectionId ? { ...section, ...data, id: sectionId } : section)),
    ).write()
    res.send(db.getState())
  } catch (e) {
    onError(e, res)
  }
})

app.delete('/section/:id', (req, res) => {
  try {
    const sectionId = req.params.id
    const section = db
      .get(dbFields.sections)
      .find({ id: sectionId })
      .value()
    section.imageIds.forEach(imId =>
      db
        .get(dbFields.images)
        .remove({ id: imId })
        .write(),
    )
    db.get(dbFields.sections)
      .remove({ id: sectionId })
      .write()
    res.send(db)
  } catch (e) {
    onError(e, res)
  }
})

const onError = (err, res) => {
  console.log(err)
  res.status(400).send(`Wrong request`)
}

const newImage = (f, { width, height }) => ({
  id: uuid(),
  filePath: f.path,
  title: f.filename,
  size: f.size,
  width,
  height,
})

const uploadCb = function(req, res) {
  const uploads = req.files.map(f => newImage(f, sizeOf(f.path)))
  const sectionId = req.body.sectionId
  db.update(dbFields.images, arr => [...arr, ...uploads]).write()
  if (sectionId) {
    addImagesToSection(sectionId, uploads.map(upl => upl.id))
  }
  res.send(db.getState())
}

const addImagesToSection = (sectionId, imageIds) =>
  db
    .update(dbFields.sections, sections =>
      sections.map(section =>
        section.id === sectionId ? { ...section, imageIds: [...section.imageIds, ...imageIds] } : section,
      ),
    )
    .write()

require('./uploader').init(app, uploadCb)

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
