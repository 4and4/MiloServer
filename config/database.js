var mongoose = require('mongoose');

var state ={
    db : null,
};

exports.connect = function(url) {
    var db = mongoose.connect(url);

    db = db.connection;
    db.on('connected', function(){
        console.log("Connected");
    });
    db.on('error', console.error.bind());
    // TODO: Handle connection failure gracefully
    db.on('disconnected', function(){
        console.log("DB Disconnected");
    });
    // db.on('disconnected', exports.connect);
    state.db = db;
    console.log("connect" + state.db);
};

exports.getdb = function(){
      return state.db;
};
