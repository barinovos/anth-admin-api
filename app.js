const express = require('express')
const fs = require('fs')
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

const user = { token: uuid(), login: 'test@test.com', password: 'password' }
const isAuthenticated = req => req.headers['authorization'] === `Bearer ${user.token}`

const adapter = new FileSync('db.json')
const db = low(adapter)
const dbFields = {
  images: 'images',
  sections: 'sections',
  webview: 'webview',
  pins: 'pins',
}

app.use(cors())
app.use(bodyParser.json()) // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded

const withAuthCheck = cb => {
  return (req, res) => {
    if (!isAuthenticated(req)) {
      return res.status(401).send('User not authenticated')
    }
    cb(req, res)
  }
}

app.post('/login', (req, res) => {
  const { login, password } = req.body
  if (login === user.login && password === user.password) {
    res.send({ data: { token: user.token } })
  } else {
    res.status(401).send('Wrong credentials ')
  }
})

app.get('/authcheck', withAuthCheck((req, res) => res.send('User authenticated')))

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))

// just a handover - default GET is for images (for now), no Auth required
app.get('/db', (req, res) => res.send(db.getState()))

app.post(
  '/section',
  withAuthCheck((req, res) => {
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
  }),
)

app.put(
  '/section/:sectionId',
  withAuthCheck((req, res) => {
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
  }),
)

app.delete(
  '/section/:sectionId',
  withAuthCheck((req, res) => {
    try {
      const sectionId = req.params.sectionId
      const section = db
        .get(dbFields.sections)
        .find({ id: sectionId })
        .value()
      section.imageIds.forEach(imId => {
        const images = db.get(dbFields.images)
        const path = images.find({ id: imId }).value().filePath
        deleteImage(path)
        images.remove({ id: imId }).write()
      })
      db.get(dbFields.sections)
        .remove({ id: sectionId })
        .write()
      res.send(db.getState())
    } catch (e) {
      onError(e, res)
    }
  }),
)

app.put(
  '/webview',
  withAuthCheck((req, res) => {
    try {
      const webview = db.get(dbFields.webview).value()
      db.update(dbFields.webview, () => ({ ...webview, ...req.body })).write()
      res.send(db.get(dbFields.webview).value())
    } catch (e) {
      onError(e, res)
    }
  }),
)

app.post(
  '/pin',
  withAuthCheck((req, res) => {
    try {
      const newPin = {
        id: uuid(),
        ...req.body,
      }
      db.update(dbFields.pins, arr => arr.concat(newPin)).write()
      res.send(db.get(dbFields.pins).value())
    } catch (e) {
      onError(e, res)
    }
  }),
)

app.put(
  '/pin/:pinId',
  withAuthCheck((req, res) => {
    try {
      const pinId = req.params.pinId
      const data = req.body
      db.update(dbFields.pins, arr => arr.map(pin => (pin.id === pinId ? { ...pin, ...data, id: pinId } : pin))).write()
      res.send(db.get(dbFields.pins).value())
    } catch (e) {
      onError(e, res)
    }
  }),
)

app.delete(
  '/pin/:pinId',
  withAuthCheck((req, res) => {
    try {
      const pinId = req.params.pinId
      const imageUrl = db
        .get(dbFields.pins)
        .find({ id: pinId })
        .value().imageUrl
      if (imageUrl) {
        deleteImage(imageUrl)
      }
      db.get(dbFields.pins)
        .remove({ id: pinId })
        .write()
      res.send(db.get(dbFields.pins).value())
    } catch (e) {
      onError(e, res)
    }
  }),
)

app.delete(
  '/image/:id',
  withAuthCheck((req, res) => {
    try {
      const imageId = req.params.id
      const sections = db.get(dbFields.sections).value()
      const imagePath = db
        .get(dbFields.images)
        .find({ id: imageId })
        .value().filePath
      deleteImage(imagePath)
      const section = sections.find(s => s.imageIds.includes(imageId))
      db.update(dbFields.sections, arr =>
        arr.map(s => (s.id === section.id ? { ...s, imageIds: section.imageIds.filter(id => id !== imageId) } : s)),
      ).write()
      db.get(dbFields.images)
        .remove({ id: imageId })
        .write()
      res.send(db.getState())
    } catch (e) {
      onError(e, res)
    }
  }),
)

const deleteImage = path => {
  fs.unlink(path, err => {
    if (err) throw err
    console.log(`${path} was deleted`)
  })
}

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

const uploadCb = (req, res) => {
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

const pinUploadCb = (req, res) => {
  try {
    const pinId = req.body.pinId
    db.update(dbFields.pins, arr =>
      arr.map(pin => (pin.id === pinId ? { ...pin, imageUrl: req.file.path } : pin)),
    ).write()
    res.send(db.get(dbFields.pins).value())
  } catch (e) {
    onError(e, res)
  }
}

require('./uploader').init(app, uploadCb, pinUploadCb)

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
