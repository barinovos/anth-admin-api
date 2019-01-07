const express = require('express')
const cors = require('cors')
const app = express()
const port = process.env.PORT || 9000

const db = [];

app.use(cors())
app.get('/', (req, res) => res.send(db))

require('./uploader').init(app, db);

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
