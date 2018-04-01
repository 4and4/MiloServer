var express = require('express');
var router = express.Router();
var passport = require('passport');
var User = require('../models/user');
var Project = require('../models/project');

function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()){
      return next();
  }
  // IF A USER ISN'T LOGGED IN, THEN REDIRECT THEM to login
  res.redirect('/users/login');
}


router.get('/register',isAuthenticated,function(req, res){
  res.render('register');
});

router.get('/login', function(req, res){
  if (req.isAuthenticated()){
      res.redirect('/');
  }
  const STATUS = {
    "403": "There was an error logging you in or you are unauthorized!",
    "500": "Check your username and password!",
    "200":""
  };
  var message = STATUS[req.query.status || "200"];
  res.render('login',{message:message});
});

router.get('/projects',isAuthenticated, function(req, res){
  res.render('dashboard',{user: req.user});
});

router.post('/projects/list',isAuthenticated, function(req, res){
  var collabQuery= {};
  var emailEscaped = req.user.email.replace(/\./g,'[dot]');
  collabQuery["collaborators."+emailEscaped] = {$exists: true, $ne: null};
  Project.find(
    {$or: [
      {owner : req.user.email},
      collabQuery
    ]},
    function(err, data){
      if (err){
        return res.status(500).json({
        err: err
        });
      }
      res.status(200).json({user: req.user, projects : data});
    }
  );
});


router.post('/projects/update',isAuthenticated, function(req, res){
  var content = req.body;
  Project.findOne(
    {projectKey: content.projectKey},
    function(err,project){
      if (err || project == undefined){
        return res.send({status: 404, message:"Failed to find project!"});
      }
      if (!err && project!=undefined){
        if (req.user.email != project.owner){
            var emailEscaped = req.user.email.replace(/\./g,'[dot]');
            var collabAccess = project.collaborators[emailEscaped] || 'none';
            if (collabAccess == 'none' || collabAccess != 'admin'){
                return res.send({status: 403,message:"You are not authorized to update this project!"});
            }
        }
        // The user has access to update
        if (content.type == "rename"){
          project.projectName = content.newName;
          project.save();
          return res.send({status: 200, type: content.type, project:project});
        } else if (content.type == "trash"){
          project.trashed = content.trashed;
          project.save();
          return res.send({status: 200, type: content.type, project:project});
        } else if (content.type == "delete"){
          project.remove();
          return res.send({status: 200, type: content.type, project:project});
        } else if (content.type == "public"){
          project.public = content.public;
          project.save();
          return res.send({status: 200, type: content.type, project:project});
        } else if (content.type == "collaborator"){
          switch (content.collabAccess){
            case 'add':
              if (project.collaborators[content.collabKey]==undefined){
                var emailKey = content.collabKey.split("[dot]").join(".");
                User.findOne(
                  {email: emailKey},
                  function(err,user){
                    if (err || user == undefined){
                      return res.send({status: 404, message:"Failed to find user!"});
                    }
                    project.collaborators[content.collabKey] = 'view';
                    project.markModified('collaborators.'+content.collabKey);
                    project.save();
                    return res.send({status: 200, type: content.type, project:project});
                  }
                );
              }
              break;
            case 'admin':
              project.collaborators[content.collabKey] = 'admin';
              project.markModified('collaborators.'+content.collabKey);
              project.save();
              return res.send({status: 200, type: content.type, project:project});
            case 'edit':
              project.collaborators[content.collabKey] = 'edit';
              project.markModified('collaborators.'+content.collabKey);
              project.save();
              return res.send({status: 200, type: content.type, project:project});
            case 'view':
              project.collaborators[content.collabKey] = 'view';
              project.markModified('collaborators.'+content.collabKey);
              project.save();
              return res.send({status: 200, type: content.type, project:project});
            case 'remove':
              delete project.collaborators[content.collabKey];
              project.markModified('collaborators.'+content.collabKey);
              project.save();
              return res.send({status: 200, type: content.type, project:project});
            case 'default':
              return res.send({status: 500,message:"Invalid Access Type"});
          }
        }
      }
    }
  );
});


router.post('/register',isAuthenticated,function(req, res){
  var name = req.body.name;
  var email = req.body.email;
  var username = req.body.username;
  var password = req.body.password;
  var role = req.body.optrole == "faculty"? "faculty": "student";
  req.checkBody('name', 'Name is required').notEmpty();
  req.checkBody('email', 'Email is required').notEmpty();
  req.checkBody('email', 'Email is not valid').isEmail();
  req.checkBody('username', 'Username is required').notEmpty();
  req.checkBody('password', 'Password is required').notEmpty();
  req.checkBody('password2', 'Passwords do not match').equals(req.body.password);

  var errors = req.validationErrors();
  if (errors){
    res.render('register');
  }  else {
    User.register(new User({
          username: username,
          email: email,
          name: name,
          role: role
      }),
      password, function(err, account) {
        if (err) {

          return res.status(500).json({
            err: err
          });
        }
        passport.authenticate('local')(req, res, function () {
          return res.redirect('/');
        });
    });
  }
});

router.post('/login',passport.authenticate('local', {successRedirect:'/', failureRedirect:'/users/login?status=500',failureFlash: true}),
  function(req, res) {
    res.redirect('/');
  });

router.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

router.get('/status', function(req, res) {
  if (!req.isAuthenticated()) {
    return res.status(200).json({
      status: false
    });
  }
  res.status(200).json({
    status: true
  });
});

router.get('/auth/google', passport.authenticate('google', {scope : ['profile', 'email']}));

router.get('/auth/google/callback',
        passport.authenticate('google', {
                failureRedirect : '/users/login?status=403' ,
                failureFlash : true
        }),function(req,res){
          res.redirect('/');
        });

module.exports = router;
