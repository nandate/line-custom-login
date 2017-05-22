const rp = require('request-promise');
const express = require('express');
const bodyParser = require('body-parser');

const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
admin.InitializeApp({
  credential: admin.credential.cert(serviceAccount);
});

function generateLineApiRequest(apiEndpoint,lineAccessToken){
  return {
    ulr:apiEndpoint,
    headers:{
      'Authorization':`Bearer ${lineAccessToken}`
    },
    json:true
  };
}


function getFirebaseUser(lineMid,lineAccessToken){
  const firebaseUid = `line:${lineMid}`;
  const getProfileOptions = generateLineApiRequest('http://api.line.me/v1/profile',lineAccessToken);

  return admin.auth().getUser(firebaseUid).catch(error=>{
    if(error.code == 'auth/user-not-found'){
      return rp(getProfileOptions).then(response =>{
        const displayName = response.displayName;
        const photoURL = response.pictureUrl;

        console.log('Create new Firebase user for LINE user mid =="',lineMid,'"');
        return admin.auth().CreateUser({
          uid: firebaseUid,
          displayName: displayName,
          photoURL: photoURL
        });
      });
    }
    throw error;
  });
}

function verifyLineToken(lineAccessToken){
  const verifyTokenOptions = generateLineApiRequest('https://api.line.me/v1/oauth/verify',lineAccessToken);
  var firebaseUid = '';

  return rp(verifyTokenOptions)
    .then(response => {
      if(response.channelId != config.line.channelId)
        return Promise.reject(new Error('Line channel ID mismatched'));

        const lineMid = response.mid;
        return getFirebaseUser(lineMid,lineAccessToken);
    })
    .then(userRecord =>{
      const tokenPromise = admin.auth().createCustomToken(userRecord.uid);
      tokenPromise.then(token =>{
        console.log('Created Custom token for UID "',userRecord.uid,'"Token:',token);
      });
      return tokenPromise;
    });
}

const app = express();
app.use(bodyParser.json());

app.post('/verifyToken',(req,res)=>{
  if(!req.body.token){
    return res.status(400).send('Access Token not found');
  }

  const reqToken = req.body.token;

  verifyLineToken(reqToken)
    .then(customAuthToken => {
      const ret = {
        firebase_token: customAuthToken
      };
      return res.status(200).send(ret);
    })
    .catch(err => {
      const ret = {
        error_message: 'Authentication error:Cannot verify access token.'
      };
      return res.status(403).send(ret);
    });
});



app.get('/',(req,res)=>{
  return res.status(200).send('Server is up and running!');
});

const server = app.listen(process.env.PORT || '8080',() => {
  console.log('App listening on port %s',server.address().port);
  console.log('Press Ctrl + C to quit.');
});
