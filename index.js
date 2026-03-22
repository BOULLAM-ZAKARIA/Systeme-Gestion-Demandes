require('dotenv').config();
const express = require('express');
//const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require("express-session");
const router = require('./router');
const app = express();

app.use('/brand', express.static(path.join(__dirname, 'public/assets/img/brand')));
app.use('/theme', express.static(path.join(__dirname, 'public/assets/img/theme')));

//app.use(expressLayouts);
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-me',
  resave: false,
  saveUninitialized: true
}));

// Set up the login route before other routes
app.get('/',(_req,res)=>{
  res.render('login',{titl:"Login System"});
})


app.use('/MyGestion-Ocp',router);

const PORT = process.env.PORT || 3009;

app.listen(PORT, () => {
  console.log(`App is listening on url http://localhost:${PORT}`);
});
