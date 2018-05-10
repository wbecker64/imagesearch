"use strict";
var express = require("express");
var path = require('path');
var bodyParser = require("body-parser");
var mongodb = require("mongodb");
var ObjectID = mongodb.ObjectID;
var request = require("request");
var http = require("http");
var app = express();
const GoogleImages = require('google-images');
const client = new GoogleImages(process.env.CSE_ID, process.env.API_KEY);

var COLLECTION = "user_requests";

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Create a database variable outside of the database connection callback to reuse the connection pool in app.
var db;

/***********************************************
 * Mongo connection and server start if db ok
 ***********************************************/

// Connect to the database before starting the application server.
mongodb.MongoClient.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/imagesearch", function(err, client) {
    if (err) {
        console.log(err);
        process.exit(1);
    }

    // Save database object from the callback for reuse.
    db = client.db();
    console.log("Database connection ready");

    // Initialize the app.
    var server = app.listen(process.env.PORT || 8080, function() {
        var port = server.address().port;
        console.log("Image search listening on port", port);
    });
});

/*****************************
 * Routes 
 *****************************/

// Route for index.
app.get('/', function(req, res) {
    res.render('index.html');
});

// Route for search queries (ie : http://host/api/imagesearch/lolcats%20funny?offset=10)
app.get("/api/imagesearch/:query", function(req, res) {

    var query = req.params.query;
    var offset = req.query.offset;

    // do the main job
    doSearch(res, query, offset);

    // Store the query in db
    storeSearch(query);

});

// Route for latest queries list (ie : http://host/api/latest/imagesearch)
app.get("/api/latest/imagesearch", function(req, res) {
    console.log("Get the latest searches")
    var result = [];

    var items = db.collection(COLLECTION).find({}, {
        fields: {
            _id: 0
        }
    }).limit(10).sort({
        when: -1
    }).toArray(function(err, items) {
        res.json(items);
    });
});

app.use(function(req, res) {
    res.status(404).end('This url is not allowed ;)');
});

/*****************************
 * Utilities functions 
 *****************************/

function doSearch(res, query, offset) {
    client.search(query, {
            page: offset ? offset : 1
        })
        .then(images => {
            console.log(JSON.stringify(images));
            var result = [];
            for (var i = images.length - 1; i >= 0; i--) {
                var item = {};
                item.url = images[i].url;
                item.snippet = images[i].description;
                item.thumbnail = images[i].thumbnail.url;
                item.context = images[i].parentPage;
                result.push(item);
            }
            res.json(result);
        })
        .catch(error => {
            console.log(error);
            res.status(404).end('Error during search !');
        });
}

function storeSearch(query) {
    db.collection(COLLECTION).insertOne({
        term: query,
        when: new Date(Date.now()).toLocaleString()
    }, function(err, result) {
        if (err) {
            console.log(err);
        } else {
            console.log(query + " has been saved in db");
        }
    });
}