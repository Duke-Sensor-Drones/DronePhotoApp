// Copyright 2018 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';

// [START app]

const async = require('async');
const bodyParser = require('body-parser');
const config = require('./config.js');
const express = require('express');
const expressWinston = require('express-winston');
const http = require('http');
const persist = require('node-persist');
const request = require('request-promise');
const session = require('express-session');
const sessionFileStore = require('session-file-store');
const uuid = require('uuid');
const winston = require('winston');

const app = express();
const fileStore = sessionFileStore(session);
const server = http.Server(app);

// Use the EJS template engine
app.set('view engine', 'ejs');


// Set up a cache for media items that expires after 55 minutes.
// This caches the baseUrls for media items that have been selected
// by the user for the photo frame. They are used to display photos in
// thumbnails and in the frame. The baseUrls are send to the frontend and
// displayed from there. The baseUrls are cached temporarily to ensure that the
// app is responsive and quick. Note that this data should only be stored for a
// short amount of time and that access to the URLs expires after 60 minutes.
// See the 'best practices' and 'acceptable use policy' in the developer
// documentation.
const mediaItemCache = persist.create({
  dir: 'persist-mediaitemcache/',
  ttl: 3300000,  // 55 minutes
});
mediaItemCache.init();

// Temporarily cache a list of the albums owned by the user. This caches
// the name and base Url of the cover image. This ensures that the app
// is responsive when the user picks an album.
// Loading a full list of the albums owned by the user may take multiple
// requests. Caching this temporarily allows the user to go back to the
// album selection screen without having to wait for the requests to
// complete every time.
// Note that this data is only cached temporarily as per the 'best practices' in
// the developer documentation. Here it expires after 10 minutes.
const albumCache = persist.create({
  dir: 'persist-albumcache/',
  ttl: 600000,  // 10 minutes
});
albumCache.init();

// For each user, the app stores the last search parameters or album
// they loaded into the photo frame. The next time they log in
// (or when the cached data expires), this search is resubmitted.
// This keeps the data fresh. Instead of storing the search parameters,
// we could also store a list of the media item ids and refresh them,
// but resubmitting the search query ensures that the photo frame displays
// any new images that match the search criteria (or that have been added
// to an album).
const storage = persist.create({dir: 'persist-storage/'});
storage.init();

// Stores a key that is a unique group value and then 
// an array of media id's and the identification results
// for the group

// ALSO has a key "groupCounter" that stores an int that is incremented at each id
// this ensures a unique group id. the const below will be the key
const groupsIdentifiedStorage = persist.create({ dir: 'persist-groups-identified/' });
groupsIdentifiedStorage.init();
const groupIdCounter = "uniqueIdentifier";
const groupPrefix = "group";  // every result saved should have this prefix
// then a group id

// Stores a key that is a media item id
// and then an array of group ids that the media item has been
// a part of
const mediaItemsIdentifiedStorage = persist.create({ dir: 'persist-items-groups-identified/' });
mediaItemsIdentifiedStorage.init();

const remainingIDsKey = "remainingPlantNetIDs";

// Set up OAuth 2.0 authentication through the passport.js library.
const passport = require('passport');
const auth = require('./auth');
const { SSL_OP_SSLEAY_080_CLIENT_DH_BUG } = require('constants');
auth(passport);

// Set up a session middleware to handle user sessions.
// NOTE: A secret is used to sign the cookie. This is just used for this sample
// app and should be changed.
const sessionMiddleware = session({
  resave: true,
  saveUninitialized: true,
  store: new fileStore({}),
  secret: 'photo frame sample',
});

// Console transport for winton.
const consoleTransport = new winston.transports.Console();

// Set up winston logging.
const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.simple()
  ),
  transports: [
    consoleTransport
  ]
});

// Enable extensive logging if the DEBUG environment variable is set.
if (process.env.DEBUG) {
  // Print all winston log levels.
  logger.level = 'silly';

  // Enable express.js debugging. This logs all received requests.
  app.use(expressWinston.logger({
    transports: [
          consoleTransport
        ],
        winstonInstance: logger
  }));
  // Enable request debugging.
  require('request-promise').debug = true;
} else {
  // By default, only print all 'verbose' log level messages or below.
  logger.level = 'verbose';
}


// Set up static routes for hosted libraries.
app.use(express.static('static'));
app.use('/js', express.static(__dirname + '/node_modules/jquery/dist/'));
app.use(
    '/fancybox',
    express.static(__dirname + '/node_modules/@fancyapps/fancybox/dist/'));
app.use(
    '/mdlite',
    express.static(__dirname + '/node_modules/material-design-lite/dist/'));


// Parse application/json request data.
app.use(bodyParser.json());

// Parse application/xwww-form-urlencoded request data.
app.use(bodyParser.urlencoded({extended: true}));

// Enable user session handling.
app.use(sessionMiddleware);

// Set up passport and session handling.
app.use(passport.initialize());
app.use(passport.session());

// Middleware that adds the user of this session as a local variable,
// so it can be displayed on all pages when logged in.
app.use((req, res, next) => {
  res.locals.name = '-';
  if (req.user && req.user.profile && req.user.profile.name) {
    res.locals.name =
        req.user.profile.name.givenName || req.user.profile.displayName;
  }

  res.locals.avatarUrl = '';
  if (req.user && req.user.profile && req.user.profile.photos) {
    res.locals.avatarUrl = req.user.profile.photos[0].value;
  }

  next();
});

// GET request to the root.
// Display the login screen if the user is not logged in yet, otherwise the
// photo frame.
app.get('/', (req, res) => {
  if (!req.user || !req.isAuthenticated()) {
    // Not logged in yet.
    res.render('pages/login');
  } else {
    res.render('pages/album');
  }
});

// GET request to log out the user.
// Destroy the current session and redirect back to the log in screen.
app.get('/logout', (req, res) => {
  req.logout();
  req.session.destroy();
  res.redirect('/');
});

// Start the OAuth login process for Google.
app.get('/auth/google', passport.authenticate('google', {
  scope: config.scopes,
  failureFlash: true,  // Display errors to the user.
  session: true,
}));

// Callback receiver for the OAuth process after log in.
app.get(
    '/auth/google/callback',
    passport.authenticate(
        'google', {failureRedirect: '/', failureFlash: true, session: true}),
    (req, res) => {
      // User has logged in.
      logger.info('User has logged in.');
      res.redirect('/');
    });

// Loads the album page if the user is authenticated.
// This page displays a list of albums owned by the user.
app.get('/album', (req, res) => {
  renderIfAuthenticated(req, res, 'pages/album');
});

// Loads the album page if the user is authenticated.
// This page displays a list of albums owned by the user.
app.get('/identification', (req, res) => {
  renderIfAuthenticated(req, res, 'pages/identification');
});

// Loads the results page if the user is authenticated.
// This page displays the identification results.
app.get('/results', (req, res) => {
  renderIfAuthenticated(req, res, 'pages/results');
});

app.get('/getRemainingCalls', async (req, res) => {
  const remIDs = await storage.getItem(remainingIDsKey);
  res.status(200).send([remIDs]);
});

// Handles selections from the album page where an album ID is submitted.
// The user has selected an album and wants to load photos from an album
// into the photo frame.
// Submits a search for all media items in an album to the Library API.
// Returns a list of photos if this was successful, or an error otherwise.
app.post('/loadFromAlbum', async (req, res) => {
  const albumId = req.body.albumId;
  const userId = req.user.profile.id;
  const authToken = req.user.token;

  logger.info(`Importing album: ${albumId}`);

  // To list all media in an album, construct a search request
  // where the only parameter is the album ID.
  // Note that no other filters can be set, so this search will
  // also return videos that are otherwise filtered out in libraryApiSearch(..).
  const parameters = {albumId};

  // Submit the search request to the API and wait for the result.
  const data = await libraryApiSearch(authToken, parameters);

  returnPhotos(res, userId, data, parameters)
});

// Returns all albums owned by the user.
app.get('/getAlbums', async (req, res) => {
  logger.info('Loading albums');
  const userId = req.user.profile.id;

  // Attempt to load the albums from cache if available.
  // Temporarily caching the albums makes the app more responsive.

  const cachedAlbums = await albumCache.getItem(userId);
  if (cachedAlbums) {
    logger.verbose('Loaded albums from cache.');
    res.status(200).send(cachedAlbums);
  } else {
    logger.verbose('Loading albums from API.');
    // Albums not in cache, retrieve the albums from the Library API
    // and return them
    const data = await libraryApiGetAlbums(req.user.token);
    if (data.error) {
      // Error occured during the request. Albums could not be loaded.
      returnError(res, data);
      // Clear the cached albums.
      albumCache.removeItem(userId);
    } else {
      // Albums were successfully loaded from the API. Cache them
      // temporarily to speed up the next request and return them.
      // The cache implementation automatically clears the data when the TTL is
      // reached.
      res.status(200).send(data);
      albumCache.setItemSync(userId, data);
    }
  }
});


// Returns a list of the media items that the user has selected to
// be shown on the photo frame.
// If the media items are still in the temporary cache, they are directly
// returned, otherwise the search parameters that were used to load the photos
// are resubmitted to the API and the result returned.
app.get('/getQueue', async (req, res) => {
  const userId = req.user.profile.id;
  const authToken = req.user.token;

  logger.info('Loading queue.');

  // Attempt to load the queue from cache first. This contains full mediaItems
  // that include URLs. Note that these expire after 1 hour. The TTL on this
  // cache has been set to this limit and it is cleared automatically when this
  // time limit is reached. Caching this data makes the app more responsive,
  // as it can be returned directly from memory whenever the user navigates
  // back to the photo frame.
  const cachedPhotos = await mediaItemCache.getItem(userId);
  const stored = await storage.getItem(userId);

  if (cachedPhotos) {
    // Items are still cached. Return them.
    logger.verbose('Returning cached photos.');
    res.status(200).send({photos: cachedPhotos, parameters: stored.parameters});
  } else if (stored && stored.parameters) {
    // Items are no longer cached. Resubmit the stored search query and return
    // the result.
    logger.verbose(
        `Resubmitting filter search ${JSON.stringify(stored.parameters)}`);
    const data = await libraryApiSearch(authToken, stored.parameters);
    returnPhotos(res, userId, data, stored.parameters);
  } else {
    // No data is stored yet for the user. Return an empty response.
    // The user is likely new.
    logger.verbose('No cached data.')
    res.status(200).send({});
  }
});

// Makes a call to the Plant ID API
app.post('/identifyPlant', async (req, res) => {
  const paramJSON = req.body.paramJSON;
  identificationAPICall(res, paramJSON);
});

app.get('/getIdentified', async (req, res) => {
  getAllIdentified(res, req.user.token);
});

// delete a result for a group
app.post('/deleteResult', async (req, res) => {
  const authToken = req.user.token;
  const groupID = req.body.groupID;
  const resultID = req.body.resultID;
  deleteResult(authToken, groupID, resultID, res);
});

// saves a users entered result

app.post('/saveUserResult', async (req, res) => {
  const authToken = req.user.token;
  const groupID = req.body.groupID;
  const sciName = req.body.scientificName;
  const family = req.body.family;
  const commonNames = req.body.commonNames;
  const genus = req.body.genus;
  saveResult(authToken, groupID, sciName, commonNames, family, genus, res);
})

// Start the server
server.listen(config.port, () => {
  console.log(`App listening on port ${config.port}`);
  console.log('Press Ctrl+C to quit.');
});

// Renders the given page if the user is authenticated.
// Otherwise, redirects to "/".
function renderIfAuthenticated(req, res, page) {
  if (!req.user || !req.isAuthenticated()) {
    res.redirect('/');
  } else {
    res.render(page);
  }
}

// If the supplied result is succesful, the parameters and media items are
// cached.
// Helper method that returns and caches the result from a Library API search
// query returned by libraryApiSearch(...). If the data.error field is set,
// the data is handled as an error and not cached. See returnError instead.
// Otherwise, the media items are cached, the search parameters are stored
// and they are returned in the response.
function returnPhotos(res, userId, data, searchParameter) {
  if (data.error) {
    returnError(res, data)
  } else {
    // Remove the pageToken and pageSize from the search parameters.
    // They will be set again when the request is submitted but don't need to be
    // stored.
    delete searchParameter.pageToken;
    delete searchParameter.pageSize;

    // Cache the media items that were loaded temporarily.
    mediaItemCache.setItemSync(userId, data.photos);
    // Store the parameters that were used to load these images. They are used
    // to resubmit the query after the cache expires.
    storage.setItemSync(userId, {parameters: searchParameter});

    // Return the photos and parameters back int the response.
    res.status(200).send({photos: data.photos, parameters: searchParameter});
  }
}

// Responds with an error status code and the encapsulated data.error.
function returnError(res, data) {
  // Return the same status code that was returned in the error or use 500
  // otherwise.
  const statusCode = data.error.code || 500;
  // Return the error.
  res.status(statusCode).send(data.error);
}

// Constructs a date object required for the Library API.
// Undefined parameters are not set in the date object, which the API sees as a
// wildcard.
function constructDate(year, month, day) {
  const date = {};
  if (year) date.year = year;
  if (month) date.month = month;
  if (day) date.day = day;
  return date;
}

// Submits a search request to the Google Photos Library API for the given
// parameters. The authToken is used to authenticate requests for the API.
// The minimum number of expected results is configured in config.photosToLoad.
// This function makes multiple calls to the API to load at least as many photos
// as requested. This may result in more items being listed in the response than
// originally requested.
async function libraryApiSearch(authToken, parameters) {
  let photos = [];
  let nextPageToken = null;
  let error = null;

  parameters.pageSize = config.searchPageSize;

  try {
    // Loop while the number of photos threshold has not been met yet
    // and while there is a nextPageToken to load more items.
    do {
      logger.info(
          `Submitting search with parameters: ${JSON.stringify(parameters)}`);

      // Make a POST request to search the library or album
      const result =
          await request.post(config.apiEndpoint + '/v1/mediaItems:search', {
            headers: {'Content-Type': 'application/json'},
            json: parameters,
            auth: {'bearer': authToken},
          });

      logger.debug(`Response: ${result}`);

      // The list of media items returned may be sparse and contain missing
      // elements. Remove all invalid elements.
      // Also remove all elements that are not images by checking its mime type.
      // Media type filters can't be applied if an album is loaded, so an extra
      // filter step is required here to ensure that only images are returned.
      const items = result && result.mediaItems ?
          result.mediaItems
              .filter(x => x)  // Filter empty or invalid items.
              // Only keep media items with an image mime type.
              .filter(x => x.mimeType && x.mimeType.startsWith('image/')) :
          [];

      photos = photos.concat(items);

      // Set the pageToken for the next request.
      parameters.pageToken = result.nextPageToken;

      logger.verbose(
          `Found ${items.length} images in this request. Total images: ${
              photos.length}`);

      // Loop until the required number of photos has been loaded or until there
      // are no more photos, ie. there is no pageToken.
    } while (photos.length < config.photosToLoad &&
             parameters.pageToken != null);

  } catch (err) {
    // If the error is a StatusCodeError, it contains an error.error object that
    // should be returned. It has a name, statuscode and message in the correct
    // format. Otherwise extract the properties.
    error = err.error.error ||
        {name: err.name, code: err.statusCode, message: err.message};
    logger.error(error);
  }

  logger.info('Search complete.');
  return {photos, parameters, error};
}

// Returns a list of all albums owner by the logged in user from the Library
// API.
async function libraryApiGetAlbums(authToken) {
  let albums = [];
  let nextPageToken = null;
  let error = null;
  let parameters = {pageSize: config.albumPageSize};

  try {
    // Loop while there is a nextpageToken property in the response until all
    // albums have been listed.
    do {
      logger.verbose(`Loading albums. Received so far: ${albums.length}`);
      // Make a GET request to load the albums with optional parameters (the
      // pageToken if set).
      const result = await request.get(config.apiEndpoint + '/v1/albums', {
        headers: {'Content-Type': 'application/json'},
        qs: parameters,
        json: true,
        auth: {'bearer': authToken},
      });

      logger.debug(`Response: ${result}`);

      if (result && result.albums) {
        logger.verbose(`Number of albums received: ${result.albums.length}`);
        // Parse albums and add them to the list, skipping empty entries.
        const items = result.albums.filter(x => !!x);

        albums = albums.concat(items);
      }
      parameters.pageToken = result.nextPageToken;
      // Loop until all albums have been listed and no new nextPageToken is
      // returned.
    } while (parameters.pageToken != null);

  } catch (err) {
    // If the error is a StatusCodeError, it contains an error.error object that
    // should be returned. It has a name, statuscode and message in the correct
    // format. Otherwise extract the properties.
    error = err.error.error ||
        {name: err.name, code: err.statusCode, message: err.message};
    logger.error(error);
  }

  logger.info('Albums loaded.');
  return {albums, error};
}


// Will identify plants from selected photos
// @param paramJSON: list of map structs ex:
// [
//   {
//     url: image base url,
//     organ: plant organ in pic,   //e.g. "leaf" or "flower"
//     mediaID: media item ID
//   },
//   {
//     url: image base url,
//     organ: plant organ in pic,   //e.g. "leaf" or "flower"
//     mediaID: media item ID
//   }
// ]
// 
// 
async function identificationAPICall(res, paramJSON) {
  if (paramJSON.length > 5) {
    res.status(400).send("Too many pictures selected");
    logger.error("Too many images selected for ID");
  }

  let url = createPlantIdUrl(paramJSON)
  let result = []
  try {
    result = await request.get(url);
  } catch (error) {
    res.status(400).send('Failed to connect to Pl@ntNet API, identification failed');
    logger.error(`Pl@ntNet API Call error: ${error}`);
    return;
  }

  const resultJSON = JSON.parse(result);
    const resultsToSave = [];

    resultJSON.results.map(x => {
      const roundedScore = Math.round(((x.score * 100) + Number.EPSILON) * 100) / 100
      const indiv = {
        id: x.gbif.id,
        score: roundedScore,
        scientificName: x.species.scientificNameWithoutAuthor,
        commonNames: x.species.commonNames,
        family: x.species.family.scientificNameWithoutAuthor,
        genus: x.species.genus.scientificNameWithoutAuthor,
        manuallyIdentified: false
      }
      resultsToSave.push(indiv);
    });
    saveIdentifiedResult(res, resultsToSave, paramJSON, resultJSON.remainingIdentificationRequests);
}

async function saveIdentifiedResult(res, resultsToSave, paramJSON, requestsLeft){
  let groupID = '';
  try {
    groupID = await groupsIdentifiedStorage.getItem(groupIdCounter);
  } catch(error) {
    res.status(400).send('Failed to save Identification result');
    logger.error(`Failed to load group ID from storage: ${error}`)
    return;
  }
    //Set group id
    if (groupID == null) {
      try{
        //initializes group id to 1 if never set
        await groupsIdentifiedStorage.setItem(groupIdCounter, 1);
        groupID = 1;
      } catch(error) {
        res.status(400).send('Failed to save Identification result');
        logger.error(`Failed to initialize group ID counter in storage to 0: ${error}`);
        return;
      }
    }

    // Make an array of items that are part of the group
    let mediaIDs = [];
    paramJSON.map((x) => {
      mediaIDs.push(x.mediaID);
    });

    // Make an object with the above array and results to save and group id
    let date = new Date()
    let dateString = date.toLocaleDateString()
    let toSave = {
      date: dateString,
      mediaIDs: mediaIDs,
      groupID: groupID,
      results: resultsToSave,
      uniqueCounter: 0
    };
    // Save to the groups identified storage
    let key = groupPrefix + String(groupID)
    groupsIdentifiedStorage.setItem(key, toSave);

    // Add the group id to each of the media items
    for (let i = 0; i < mediaIDs.length; i++) {
      var arr = null;
      try {
        arr = await mediaItemsIdentifiedStorage.get(mediaIDs[i]);
      } catch(error) {
        res.status(400).send('Failed to save Identification result');
        logger.error(`Failed to save the current group ID to a media item: ${error}`);
        return;
      }
      if (arr == null) {
        arr = [];
      }
      arr.push(String(groupID));
      try{
      await mediaItemsIdentifiedStorage.setItem(mediaIDs[i], arr);
      } catch(error) {
        res.status(400).send('Failed to save Identification result');
        logger.error(`Failed to save the current group ID to a media item: ${error}`);
        return;
      }
    }

    //Incremenet the identifier
    try{
      await groupsIdentifiedStorage.setItem(groupIdCounter, groupID + 1);
    } catch(error) {
      res.status(400).send('Failed to save Identification result');
      logger.error(`Failed to update the groupID counter in storage: ${error}`);
      return;
    }
    let toReturn = {
      date: toSave.date,
      mediaIDs: toSave.mediaIDs,
      groupID: toSave.groupID,
      results: toSave.results,
      requestsLeft: requestsLeft
    }

    await storage.setItem(remainingIDsKey, requestsLeft);
    res.status(200).send(toReturn);
}

// creates the url used to hit the PlantNet ID API
function createPlantIdUrl(paramJSON) {
  var imageUrlList = "";
  let organList = "";

  paramJSON.map((x) => {
    let ogImage = x.url;
    let a = ogImage.replace(new RegExp(":", "g"), "%3A");
    let b = a.replace(new RegExp("/", "g"), "%2F");
    let c = "&images=" + b;
    imageUrlList += c;

    organList += "&organs=" + x.organ;
  });

  var finalURL =
    config.plantNetAPIendpoint + "api-key=" + config.plantNetAPIkey;

  finalURL += imageUrlList;
  finalURL += organList;

  return finalURL;
}

// takes in an array of media item ids, hits the Google Photos API
// and returns an array of results from that
async function getMediaItemsAPICall(authToken, mediaItemIDs) {
  let itemsReturned = [];
  let errorMessages = [];
  for(let i = 0; i < mediaItemIDs.length; i++){
    let mediaItemID = mediaItemIDs[i];

    let call = config.apiEndpoint + '/v1/mediaItems/' + mediaItemID;

    try {
      const result = await request.get(call, {
        headers: { 'Content-Type': 'application/json' },
        json: true,
        auth: { 'bearer': authToken },
      });

      itemsReturned.push(result);

    } catch (error) {
      errorMessages.push(error);
      logger.error(`Error getting a media item from google photos: ${error}`);
    }
  }
    let toSend = {
      mediaItems: itemsReturned,
      errors: errorMessages
    }
    return toSend;
}

async function getAllIdentified(res, authToken){
  try{
    let identified = await groupsIdentifiedStorage.valuesWithKeyMatch(groupPrefix);
    let result = {
      identifications: [],
      errors: []
    };
    
    for(let i = 0; i < identified.length; i++){
      let returned = await getMediaItemsAPICall(authToken, identified[i].mediaIDs);

      let errors = returned.errors;
      errors.map(x => {
        result.errors.push(x);
      })

      let save = {
        ...identified[i],
        mediaItems: returned.mediaItems,
      }
      result.identifications.push(save);
    }

    res.status(200).send(result);
  } catch(error){
    res.status(400).send(error);
    logger.error('Error getting identified info from the storage. Possiblt need to delete persist-groups-identified and persist-items-groups-identified. NOTE: deleting these will wipe identified result memory');
  }
}

async function getSingleIdentified(authToken, groupID){
  try{
    const key = groupPrefix + groupID;
    let identified = await groupsIdentifiedStorage.getItem(key);

    let returned = await getMediaItemsAPICall(authToken, identified.mediaIDs);

    let save = {
        ...identified,
        mediaItems: returned.mediaItems,
      }
    
    let result = {
      errors: returned.errors,
      identification: save
    }

    return result
  } catch(error){
    logger.error('Error getting single identified info from the storage: ', error);
  }
}


async function deleteResult(authToken, groupID, resultID, res){
  try {
    let key = groupPrefix + groupID;
    let resultGotten = await groupsIdentifiedStorage.getItem(key);
    let results = resultGotten.results;
    let newResults = []
    results.map(x => {
      // omitting the deleted result
      if(x.id != resultID){
        newResults.push(x);
      }
    })

    // saving updated results
    resultGotten.results = newResults;
    await groupsIdentifiedStorage.setItem(key, resultGotten);

    let finalResult = await getSingleIdentified(authToken, groupID);
    logger.info(finalResult);
    res.status(200).send(finalResult.identification);
  } catch(error){
    res.status(400).send(error);
    logger.error('Error deleting a result entry: ', error);
  }
}

async function saveResult(authToken, groupID, scientificName, commonNames, family, genus, res) {
  try {
    let key = groupPrefix + groupID;
    let resultGotten = await groupsIdentifiedStorage.getItem(key);
    let results = resultGotten.results;

    let userResult = {
      id: resultGotten.uniqueCounter,
      score: null,
      scientificName: scientificName,
      commonNames: commonNames,
      family: family,
      genus: genus,
      manuallyIdentified: true
    }

    results.unshift(userResult);    //append to head of results array
    resultGotten.uniqueCounter++;

    // saving updated results
    await groupsIdentifiedStorage.setItem(key, resultGotten);

    let finalResult = await getSingleIdentified(authToken, groupID);
    logger.info(finalResult);
    res.status(200).send(finalResult.identification);
  } catch(error){
    res.status(400).send(error);
    logger.error('Error saving a result entry: ', error);
  }
}


// [END app]
