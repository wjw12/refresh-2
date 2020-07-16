const url = require('url')
const MongoClient = require('mongodb').MongoClient

let cachedDb = null

async function connectToDatabase(uri) {
  if (cachedDb) {
    return cachedDb
  }
  const client = await MongoClient.connect(uri, { useNewUrlParser: true })

  const db = await client.db(url.parse(uri).pathname.substr(1))

  cachedDb = db
  return db
}

module.exports = async (req, res) => {
  // handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }
  const {body} = req;
  if (body) {
    const db = await connectToDatabase(process.env.MONGODB_URI)
    const collection = await db.collection('datasource');
    const ipcache = await db.collection('ipcache');

    // assume ip saved in cache
    if (body.ip) {
      let geodata = await ipcache.findOne({ip: body.ip}); 
      if (geodata) {
        geodata = geodata.data;
        const [lat, lon] = [geodata.lat, geodata.lon];
        const query = {
            location: {
                type: 'Point',
                coordinates: [lat, lon]
            }
        };
        const result = await collection.findOne(query);
        if (result) {
          res.status(200).send(result);
          return;
        }
      }
    }
  }
  
  res.status(400).send("");

}