const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt-nodejs");
const cors = require("cors");
const knex = require("knex");
const Clarifai = require('clarifai');

// Using Knex to connect server and database
const db = knex({
  // connect to your own database here:
  client: "pg",
  connection: {
    host: "127.0.0.1",
    user: "postgres",
    password: "bobby",
    database: "smart_brain",
  },
});

const app = express();
app.use(cors());
const PORT = 3000;
app.use(bodyParser.json());

// ============================ root path routing of server ===================================
app.get("/", (req, res) => {
  res.send("running");
});

// ========================================== SIGN IN ==========================================
app.post("/signin", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json("incorrect form submission");
  }
  db.select("email", "hash")
    .from("login")
    .where("email", "=", email)
    .then((data) => {
      const isValid = bcrypt.compareSync(password, data[0].hash);
      if (isValid) {
        return db
          .select("*")
          .from("users")
          .where("email", "=", email)
          .then((user) => {
            res.json(user[0]);
          })
          .catch((err) => res.status(400).json("unable to get user"));
      } else {
        res.status(400).json("wrong credentials");
      }
    })
    .catch((err) => res.status(400).json("wrong credentials"));
});

// ============================================ REGISTER =========================================
app.post("/register", (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !name || !password) {
    return res.status(400).json("incorrect form submission");
  }
  const hash = bcrypt.hashSync(password);
  db.transaction((trx) => {
    trx
      .insert({
        hash: hash,
        email: email,
      })
      .into("login")
      .returning("email")
      .then((loginEmail) => {
        return trx("users")
          .returning("*")
          .insert({
            email: loginEmail[0].email,
            name: name,
            joined: new Date(),
          })
          .then((user) => {
            res.json(user[0]);
          });
      })
      .then(trx.commit)
      .catch(trx.rollback);
  }).catch((err) => res.status(400).json("unable to register"));
});

// ============================================= PROFILE =========================================
app.get("/profile/:id", (req, res) => {
  const { id } = req.params;
  db.select("*")
    .from("users")
    .where({ id: id })
    .then((user) => {
      if (user.length) {
        res.json(user[0]);
      } else {
        res.status(400).json("Not Found");
      }
    })
    .catch((err) => res.status(404).json("Error getting user"));
});

//================================================ IMAGE ===========================================
app.put("/image", (req, res) => {
  const { id } = req.body;
  db("users")
    .where("id", "=", id)
    .increment("entries", 1)
    .returning("entries")
    .then((entries) => {
      res.json(entries[0].entries);
    })
    .catch((err) => res.status(400).json("unable to get entries"));
});

// ============================================= Image Clarifai ====================================
app.post("/imageurl", (req, res) => {
  const app = new Clarifai.App({
    apiKey: "7fde0333fa9b419189004df2254258b4", 
  });
  app.models
    .predict(Clarifai.FACE_DETECT_MODEL, req.body.input)
    .then((data) => {
      res.json(data);
    })
    .catch((err) => res.status(400).json("unable to work with API"));
});

//====================================Port======================================== 
app.listen(PORT, () => {
  console.log(`app is running on port ${PORT}`);
});

// ========
//res = this is working
//sign in --> POST = return success/fail
//register --> POST = adding User to database
//profile/:userId --> GET = getting User from database
//image --> PUT = updating sth in User profie
// ========
