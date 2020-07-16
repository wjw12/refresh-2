const url = require('url')
const MongoClient = require('mongodb').MongoClient
const axios = require('axios');

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
    res.status(200).end();
    return;
  }
  const {body} = req;
  if (!body) {
      res.status(400).send("");
      return;
  }
  const db = await connectToDatabase(process.env.MONGODB_URI);
  const collection = await db.collection('datasource');
  const ipcache = await db.collection('ipcache');

  if (body.ip) {
    // if ip exist in cache database, retrieve the location info
    let geodata = await ipcache.findOne({ip: body.ip});
    if (!geodata) {
        const resp = await axios.get('http://ip-api.com/json/' + body.ip);
        if (resp.data && resp.data.status == 'success') {
            geodata = resp.data;
            // insert to cache db
            await ipcache.insert({ip: body.ip, data: geodata});
        }
    } 
    else {
        geodata = geodata.data;
    }

    if (!geodata) {
        res.status(400).send("fail to retrieve location from IP");
        return;
    }

    // update visitor information
    const [lat, lon] = [geodata.lat, geodata.lon];
    const query = {
        location: {
            type: 'Point',
            coordinates: [lat, lon]
        }
    };
    const result = await collection.findOne(query);
    if (result) {
        const timeList = result.times;
        timeList.push(Date.now())
        await collection.update(query, {
            times: timeList,
            location: {
                type: 'Point',
                coordinates: [lat, lon]
            }
        })
    }
    else {
        await collection.insert({
            times: [Date.now()],
            location: {
                type: 'Point',
                coordinates: [lat, lon]
            }
        })
    }

    res.status(200).send(result);
  }
  else {
    res.status(400).send("wrong request format")
  }

}