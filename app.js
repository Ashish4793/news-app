//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const apiKey = process.env.API_KEY;
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require('connect-mongo')(session);
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");

const app = express();

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(session({
    resave: false,
    saveUninitialized: false,
    secret: process.env.PASSPORT_KEY,
    cookie: {
        expires: 2000000
    },
    store: new MongoStore({ mongooseConnection: mongoose.connection })
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.set("strictQuery", false);
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);

    } catch (error) {
        console.log(error);
        process.exit(1);
    }
};

const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, require: true },
    name: { type: String, require: true },
    country: { type: String, require: true },
    langauge: { type: String, require: true },
    password: String
});

userSchema.plugin(passportLocalMongoose);

const User = mongoose.model("User", userSchema);

passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());



app.get("/login", function (req, res) {
    res.render("login");
});

app.get("/logout", function (req, res) {
    req.logout(function(){});
    res.render("alerts/logoutsuc");
});

app.get("/editprofile" , function(req,res){
    if (req.isAuthenticated()){
        res.render("editprofile");
    } else {
        res.redirect("/login");
    }
});
app.get("/deleteaccount" , function(req,res){
    if (req.isAuthenticated()){
        res.render("delaccount");
    } else {
        res.redirect("/login");
    }
});

app.get("/wrongpass" , function(req,res){
    res.render("alerts/badcred");
});

app.post("/login", passport.authenticate("local", {
    successReturnToOrRedirect: '/',
    failureRedirect: "/wrongpass"
}), function (req, res) {
});

app.get("/register", function (req, res) {
    res.render("register");
});

app.post("/register", function (req, res) {
    User.register({ username: req.body.username, name: req.body.name, country: req.body.country, langauge: req.body.langauge }, req.body.password, function (err, user) {
        if (err) {
            res.render("alerts/uaxerror")
        } else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/");
            });
        }
    });
});

app.get("/account" , function(req,res){
    if (req.isAuthenticated()){
        res.render("account" , {user : req.user})
    } else {
        res.redirect("/login")
    }
})

app.get("/", function (req, res) {
    let loggedIn;
    let userCountry;
    let userLangauge;
    if (req.isAuthenticated()) {
        loggedIn = true;
        userCountry = req.user.country;
        userLangauge = req.user.langauge;
    } else {
        loggedIn = false;
        userCountry = "in";
        userLangauge = "en";
    }

    const url = "https://gnews.io/api/v4/top-headlines?category=general&lang=" + userLangauge + "&country=" + userCountry + "&max=10&apikey=" + apiKey;
    fetch(url)
        .then(function (response) {
            return response.json();
        })
        .then(function (data) {
            results = data.articles;
            res.render("home", { data: results, loggedIn: loggedIn });
        });
});

app.get("/search/:keyword", function (req, res) {
    let loggedIn;
    let userCountry;
    let userLangauge;
    if (req.isAuthenticated()) {
        loggedIn = true;
        userCountry = req.user.country;
        userLangauge = req.user.langauge;

        const squery = req.params.keyword;
        const b = squery.charAt(0).toUpperCase() + squery.slice(1); //to capitalize first letter of search keyword
        const url = "https://gnews.io/api/v4/search?q=" + squery + "&lang=" + userLangauge + "&country=" + userCountry + "&apikey=" + apiKey;
    
        fetch(url)
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                results = data.articles;
                res.render("catresponse", { data: results, q: b, loggedIn: loggedIn });
            });
    } else {
        res.redirect("/login");
    }
});


app.post("/handler", function (req, res) {
    let loggedIn;
    let userCountry;
    let userLangauge;
    if (req.isAuthenticated()) {
        loggedIn = true;
        userCountry = req.user.country;
        userLangauge = req.user.langauge;

        const squery = req.body.query;
        const url = "https://gnews.io/api/v4/search?q=" + squery + "&lang=" + userLangauge + "&country=" + userCountry + "&apikey=" + apiKey;

        fetch(url)
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                results = data.articles;
                res.render("response", { data: results, q: squery, loggedIn: loggedIn });
            });
    } else {
        res.redirect("/login");
    }
});

app.post("/editprofile" , function(req,res){
    if (req.isAuthenticated()){
        User.findOneAndUpdate({username : req.user.username} , {country : req.body.country , langauge : req.body.langauge} , function(err){
            if (!err){
                res.render("alerts/proupsuc")
            } else {
                console.log(err);
            }
        });
    } else {
        res.redirect("/login")
    }
});

app.post("/deleteaccount" , function(req,res){
   if (req.isAuthenticated()){
    User.findOneAndDelete({username : req.user.username} , function(err){
        if (!err){
            res.render("alerts/accdelsuc");
        } else {
            console.log(err);
        }
    });
   } else {
    res.redirect("/login")
   } 
});

connectDB().then(() => {
    console.log("newsGdb CONNECTED SUCCESFULLY");
    app.listen(3000, () => {
        console.log("newsG Server STARTED");
    })
});



