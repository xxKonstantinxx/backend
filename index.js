const express = require("express");
const app = express(); // use express as app
const mysql = require("mysql");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const jwt = require("express-jwt");
const jwks = require("jwks-rsa");
const guard = require("express-jwt-permissions")();
const oAuth = require("./middleware/oAuth")
app.use(cors());
app.use(express.json());


//connecting to the database
const db = mysql.createConnection({
  user: "root",
  host: "localhost",
  password: "password",
  database: "tweets",
});

// connect to Authorization API
// var jwtCheck = jwt({
//   secret: jwks.expressJwtSecret({
//     cache: true,
//     rateLimit: true,
//     jwksRequestsPerMinute: 5,
//     jwksUri: "https://zwitscher.us.auth0.com/.well-known/jwks.json",
//   }),
//   audience: "https://www.zwitscherapi.com",
//   issuer: "https://zwitscher.us.auth0.com/",
//   algorithms: ["RS256"],
// });

// app.use(jwtCheck);

// app.use(oAuth);

//check permissions guard middlewhare
const zwitscherAPIEndpoint = "http://localhost:8080/challenges";
app.get("/challenges", async (req, res) => {
  try {
    const { access_token } = req.oauth;
    const response = await axios({ method: "get", url: zwitscherAPIEndpoint });
    res.json(response.data);
  } catch (error) {
    console.log(error);
    if (error.response.status === 401) {
      res.status(401).json("Unauthorized to access data");
    } else if (error.response.status === 403) {
      res.status(403).json("Permission denied");
    } else {
      res.status(500).json("Upsie, my bad. imma fix that later...");
    }
  }
});

app.get("/zwitscher", guard.check(["read:tweets"]), function (req, res) {
  res.json({ tweet: "this is the first tweet" });
});

// deleting all tweets and images in the upload folder
const directory = "../client/public/uploads";
app.delete("/delete", (req, res) => {
  db.query("DELETE FROM Tweets");
  fs.readdir(directory, (err, files) => {
    if (err) throw err;

    for (const file of files) {
      fs.unlink(path.join(directory, file), (err) => {
        if (err) throw err;
      });
    }
    res.send("done");
  });
  console.log("deleted");
});

const fileHandler = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "../client/public/uploads");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "--" + file.originalname);
  },
});

const upload = multer({ storage: fileHandler });

app.put("/update", (req, res) => {
  const id = req.body.id;
  const tweet = req.body.tweet;
  var datetime = new Date().toLocaleString("de-DE");
  db.query("UPDATE Tweets SET tweet = ?, lastEdit = ? WHERE id = ?", [
    tweet,
    datetime,
    id,
  ]);
  res.send("Done");
});

app.post("/search",(req, res) => {
  const query = decodeURI(req.body.query).substring(3)
  console.log(query)
  
  db.query("SELECT * FROM Tweets WHERE Tweet LIKE ? or userName LIKE ? ORDER BY id DESC", [`%${query}%`, `%${query}%`], (err, result) => {
    if (err) {
      console.log(err);
    } else {
      res.send(result);
    }
  })
})

//requesting the variables name and tweet from the body of the page through /create on port 3001
app.post("/create", upload.single("image"), (req, res) => {
  let filePath = null;
  const name = req.body.name;
  const tweet = req.body.tweet;
  console.log(tweet);
  if (req.body.image !== "null") {
    filePath = "/uploads/" + req.file.filename;
  }
  console.log(name, tweet, filePath);
  //inserting values into database

  db.query(
    "INSERT INTO Tweets (userName, Tweet, filePath) VALUES (?,?,?)",
    [name, tweet, filePath],
    (err, result) => {
      if (err) {
        console.log(err);
      } else {
        res.send("Values Inserted");
      }
    }
  );
});

//getting the data from the database
app.get("/tweets", (req, res) => {
  db.query("SELECT * FROM Tweets ORDER BY id DESC", (err, result) => {
    if (err) {
      console.log(err);
    } else {
      res.send(result);
    }
  });
});

//listen to the port 3001
app.listen(3001, () => {
  console.log("Listening on port 3001");
});
