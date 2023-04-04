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
    thirdparty_provider: { type: String, require: true },
    name: { type: String, require: true },
    country: { type: String, require: true },
    langauge: { type: String, require: true },
    password: String,
});
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const bookmarkSchema = new mongoose.Schema({
    user_id: String,
    article_title: String,
    article_desc: String,
    article_provider: String,
    article_img_url: String,
    article_link: String,
});

const Bookmark = mongoose.model("Bookmark", bookmarkSchema);
const User = mongoose.model("User", userSchema);
var newUser;

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
},
    function (accessToken, refreshToken, profile, cb) {
        User.findOne({ username: profile.id }, function (err, user) {
            if (user === null) {
                newUser = true;
            } else {
                newUser = false;
            }
        });
        User.findOrCreate({ username: profile.id, name: profile.displayName , thirdparty_provider : profile.provider }, function (err, user) {
            return cb(err, user);
        });
    }
));

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: process.env.FACEBOOK_CALLBACK_URL
},
    function (accessToken, refreshToken, profile, cb) {
        User.findOne({ username: profile.id }, function (err, user) {
            if (user === null) {
                newUser = true;
            } else {
                newUser = false;
            }
        });
        User.findOrCreate({ username: profile.id, name: profile.displayName ,thirdparty_provider : profile.provider }, function (err, user) {
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
    function (req, res) {
        if (newUser === true) {
            res.render("onboarding");
        } else {
            res.redirect('/');
        }
    });


app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile'] }));

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/register' }),
    function (req, res) {
        // Successful authentication, redirect home.
        if (newUser === true) {
            res.render("onboarding");
        } else {
            res.redirect('/');
        }

    });

app.post("/onboarding", function (req, res) {
    if (req.isAuthenticated()) {
        User.findOneAndUpdate({ username: req.user.username }, { country: req.body.country, langauge: req.body.langauge }, function (err) {
            if (!err) {
                res.render("alerts/preupdate");
            } else {
                console.log(err);
            }
        })
    } else {
        res.redirect("/")
    }
});

app.get("/login", function (req, res) {
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
    User.register({ username: req.body.username, name: req.body.name,thirdparty_provider : null, country: req.body.country, langauge: req.body.langauge }, req.body.password, function (err, user) {
        if (err) {
            console.log(err)
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
        let f;
        const auth_provider = req.user.thirdparty_provider;
        let a = req.user.username;
        let b = ".com";
        let decision = a.includes((b));
        if (decision === true){
            f = true;
        } else {
            f = false;
        }
        res.render("account", { user: req.user , f : f , auth_provider : auth_provider});
    } else {
        res.redirect("/login")
    }
});

app.get("/bookmarks", function (req, res) {
    if (req.isAuthenticated()) {
        var loggedIn = true;
        Bookmark.find({ user_id: req.user.username }, function (err, foundData) {
            if (!err) {
                if (!foundData.length) {
                    b = false;
                } else {
                    b = true;
                }
                res.render("bookmarks", { data: foundData, loggedIn: loggedIn, b: b });
            } else {
                console.log(err);
            }
        });
    } else {
        res.redirect("/login");
    }
});

app.post("/bookmark", function (req, res) {
    if (req.isAuthenticated()) {
        const id = req.user.username;
        Bookmark.findOne({ user_id: id, article_title: req.body.title }, function (err, condition) {
            if (condition === null) {
                const newItem = new Bookmark({
                    user_id: id,
                    article_title: req.body.title,
                    article_desc: req.body.description,
                    article_provider: req.body.source_name,
                    article_img_url: req.body.img_url,
                    article_link: req.body.story_link
                });
                newItem.save(function (err) {
                    if (!err) {
                    } else {
                        console.log(err);
                    }
                });
            } else {
                //do nothing
            }
        });
    } else {
        res.redirect("/login");
    }
});

app.post("/deletebookmark", function (req, res) {
    if (req.isAuthenticated()) {
        Bookmark.findOneAndDelete({ _id: req.body.id }, function (err) {
            if (!err) {
                res.redirect("/bookmarks");
            } else {
                console.log(err);
            }
        });
    } else {
        res.redirect("/login");
    }
});

app.get("/", function (req, res) {
    var loggedIn;
    var userCountry;
    var userLangauge;
    if (req.isAuthenticated()) {
        loggedIn = true;
        userCountry = req.user.country;
        userLangauge = req.user.langauge;
        callHandlerAPI(userCountry, userLangauge);
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
        User.findOneAndUpdate({ _id: req.user._id }, { country: req.body.country, langauge: req.body.langauge }, function (err) {
            if (!err) {
                res.render("alerts/preupdate")
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
        Bookmark.deleteMany({ user_id: req.user.username }, function (err) {
            if (!err) {
                User.findOneAndDelete({ _id: req.user._id }, function (err) {
                    if (!err) {
                        res.render("alerts/accdelsuc");
                    } else {
                        console.log(err);
                    }
                });
            } else {
                console.log(err);
            }
        });
    } else {
        res.redirect("/login")
    }
});
//404 route
app.use((req, res, next) => {
    res.status(404).render("404");
});

connectDB().then(() => {
    console.log("newsGdb CONNECTED SUCCESFULLY");
    app.listen(3000, () => {
        console.log("newsG Server STARTED");
    })
});



