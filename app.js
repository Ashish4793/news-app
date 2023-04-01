//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const apiKey = process.env.API_KEY;
const mongoose = require("mongoose");
const findOrCreate = require("mongoose-findorcreate");
const session = require("express-session");
const MongoStore = require('connect-mongo')(session);
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;

passport.serializeUser(function (user, done) {
    done(null, user);
});
passport.deserializeUser(function (obj, done) {
    done(null, obj);
});



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
    thirdpartyauth_id: { type: String, unique: true, require: true },
    name: { type: String, require: true },
    country: { type: String, require: true },
    langauge: { type: String, require: true },
    password: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
const User = mongoose.model("User", userSchema);
var newUser;

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "https://news-app.cyclic.app/auth/google/callback"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOne({ thirdpartyauth_id: profile.id }, function (err, user) {
        if (user === null) {
            console.log("yes");
            newUser = true;
        } else {
            console.log("no");
            newUser = false;
        }
    });
    User.findOrCreate({ thirdpartyauth_id: profile.id  , name : profile.displayName}, function (err, user) {
      return cb(err, user);
    });
  }
));

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "https://news-app.cyclic.app/auth/facebook/callback"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOne({ thirdpartyauth_id: profile.id }, function (err, user) {
        if (user === null) {
            console.log("yes");
            newUser = true;
        } else {
            console.log("no");
            newUser = false;
        }
    });
    User.findOrCreate({ thirdpartyauth_id: profile.id , name : profile.displayName }, function (err, user) {
      return cb(err, user);
    });
  }
));



passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


app.get('/auth/facebook',
  passport.authenticate('facebook'));

app.get('/auth/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  function(req, res) {
    if (newUser === true){
        res.render("onboarding");
    } else {
        res.redirect('/');
    }
});


app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile'] }));

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/register' }),
  function(req, res) {
    // Successful authentication, redirect home.
    if (newUser === true){
        res.render("onboarding");
    } else {
        res.redirect('/');
    }
    
});

app.post("/onboarding", function (req, res) {
    if (req.isAuthenticated()){
        console.log(req.user);
        User.findOneAndUpdate({ thirdpartyauth_id: req.user.thirdpartyauth_id }, { country: req.body.country, langauge: req.body.langauge }, function (err) {
            if (!err) {
                res.redirect("/");
            } else {
                console.log(err);
            }
        })
    } else {
        res.redirect("/")
    }
});

app.get("/login", function (req, res) {
    console.log(process.env.FACEBOOK_APP_ID);
    console.log(process.env.FACEBOOK_APP_SECRET);
    res.render("login");
});

app.get("/logout", function (req, res) {
    req.logout(function () { });
    res.render("alerts/logoutsuc");
});

app.get("/editprofile", function (req, res) {
    if (req.isAuthenticated()) {
        res.render("editprofile");
    } else {
        res.redirect("/login");
    }
});
app.get("/deleteaccount", function (req, res) {
    if (req.isAuthenticated()) {
        res.render("delaccount");
    } else {
        res.redirect("/login");
    }
});

app.get("/wrongpass", function (req, res) {
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

app.get("/account", function (req, res) {
    if (req.isAuthenticated()) {
        if (req.user.thirdpartyauth_id != null) {
            res.render("account", { user: req.user });
        } else {
            console.log("third party");
        }
    } else {
        res.redirect("/login")
    }
});

app.get("/", function (req, res) {
    var loggedIn;
    var userCountry;
    var userLangauge;
    if (req.isAuthenticated()) {
        if (req.user.provider === "twitter") {
            console.log("twitter");
            User.findOne({ thirdpartyauth_id: req.user.id }, function (err, user) {
                loggedIn = true;
                userCountry = user.country;
                userLangauge = user.langauge;
                callHandlerAPI(userCountry, userLangauge);
            });
        } else {
            loggedIn = true;
            userCountry = req.user.country;
            userLangauge = req.user.langauge;
            callHandlerAPI(userCountry, userLangauge);
        }
    } else {
        loggedIn = false;
        userCountry = "in";
        userLangauge = "en";
        callHandlerAPI(userCountry, userLangauge);
    }

    function callHandlerAPI() {
        const url = "https://gnews.io/api/v4/top-headlines?category=general&lang=" + userLangauge + "&country=" + userCountry + "&max=10&apikey=" + apiKey;
        fetch(url)
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                results = data.articles;
                res.render("home", { data: results, loggedIn: loggedIn });
            });
    }


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

app.post("/editprofile", function (req, res) {
    if (req.isAuthenticated()) {
        User.findOneAndUpdate({ username: req.user.username }, { country: req.body.country, langauge: req.body.langauge }, function (err) {
            if (!err) {
                res.render("alerts/proupsuc")
            } else {
                console.log(err);
            }
        });
    } else {
        res.redirect("/login")
    }
});

app.post("/deleteaccount", function (req, res) {
    if (req.isAuthenticated()) {
        if (req.user.thirdpartyauth_id === null){
            User.findOneAndDelete({ username: req.user.username }, function (err) {
                if (!err) {
                    res.render("alerts/accdelsuc");
                } else {
                    console.log(err);
                }
            });
        } else {
            User.findOneAndDelete({ thirdpartyauth_id: req.user.thirdpartyauth_id }, function (err) {
                if (!err) {
                    res.render("alerts/accdelsuc");
                } else {
                    console.log(err);
                }
            });
        }
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



