# Duke XPRIZE Drone Photo App

## App Overview
This is an app constructed using [Express.js](https://expressjs.com/) and [Material Design Lite](https://getmdl.io/) for the Duke Rainforest XPRIZE team. It connects to the [Google Photos Library API](https://developers.google.com/photos) as well as the [Pl@ntNet Identification API](https://my.plantnet.org/usage). Through these connections, a user can login to their Google Photos account and send images of plants (taken with a drone) to be identified. The results are then displayed on a separate page within the app.

## Screenshots
![Login Screen](https://i.imgur.com/uLRZseU.jpg)

![Albums Page](https://i.imgur.com/Sk22APg.jpg)

![Identification Page](https://i.imgur.com/fZJu71l.jpg)

![Selecting Plant Organs](https://i.imgur.com/OalZOjH.jpg)

![Results Page](https://i.imgur.com/VEOHryO.jpg)


## Setup
To set up this project, you will need to obtain Google Developer authentification. If you are continuing this project at Duke University, Dr. Martin Brooke has the account information for this project. You will need a Google account and a Pl@ntNet account.

(https://developers.google.com/photos/library/guides/get-started) to complete these steps:
1. Once logged into the Google account, go to the [Google Developers Dashboard](https://console.cloud.google.com/apis/)
2. Open the Credentials tab and select the OAuth Client info. You will use the Client ID and the Clien Secret in the next step.

3. In the git repo in the `config.js` file, add the `Client ID` and `Client secret`, replacing the placeholder values:
```
// The OAuth client ID from the Google Developers console.
config.oAuthClientID = 'ADD YOUR CLIENT ID';

// The OAuth client secret from the Google Developers console.
config.oAuthclientSecret = 'ADD YOUR CLIENT SECRET';
```
4. Next login to your [Pl@ntNet Account](https://my.plantnet.org/account) and navigate to the Settings page. Copy the api-key.
5. In the git repo in the `config.js` file, add the `Plant Net API Key` , replacing the placeholder values:
```
// Pl@ntNet API Key
config.plantNetAPIkey = 'ADD PLANT NET API KEY';
```

You are now ready to run the sample:
1. Ensure [Node.JS](https://nodejs.org/) and [npm](https://www.npmjs.com/) are installed and available on your system. You need Node.js v7.8.0 or later to run this sample.
1. Navigate to the directory of this sample: `REST/PhotoFrame`.
1. Install dependencies: Run `npm install`,
1. Start the app: Run `node app.js`.

By default, the app will listen on port `8080` for testing. Open a web browser and navigate to [http://127.0.0.1:8080](http://127.0.0.1:8080) or [http://localhost:8080](http://localhost:8080) to access the app.

# Troubleshooting
Make sure that you have configured the `Client ID`, the `Client secret`, and the `Pl@ntNet API Key` in the configuration file `config.js`.

You can also start the app with additional debug logging by setting the `DEBUG` environment variable to `true`. For example:
```
DEBUG=TRUE node app.js
```

# API Use and Code Overview
The app is built using the [Express.js](https://expressjs.com/) framework and the [ejs](http://ejs.co/) templating system.

First, the user has to log in via OAuth 2.0 and authorize the `https://www.googleapis.com/auth/photoslibrary.readonly` scope. (See the file `config.js`.)
Once authenticated, photos are loaded into the app on the Albums, Identification, and Results pages.

The app is split into the backend (`app.js`) and the front end (`static/...`). The photo frame preview screen make AJAX requests to the backend to load a list of selected photos. Likewise, the album screen makes an AJAX request to the backend to load the list of albums that are owned by the user. The backend returns media items or albums directly from the Library API that are parsed and rendered in the browser.

## Albums
The album screen (`/album`)  is loaded from a template file located at `views/pages/album.ejs`. When this screen is loaded, the browser makes a request to `/getAlbums` that is received by the server `app.js` in the handler `app.get('/getAlbums', ...)`.
The method `libraryApiGetAlbums(authToken)` is called to load the albums from the API. This method shows to handle the `nextPageToken` to retrieve a complete list of all albums owned by the user.

The retrieved [`albums`] are returned and displayed through the file `static/js/album.js`. Here the `album` objects are parsed and the title, cover photo and number of items are rendered on screen.

When an album is selected, the handler `app.post('/loadFromAlbum', ...)` receives the id of the album that was picked. Here, a search parameter is constructed and passed to `libraryApiSearch(authToken, parameters)` to load the images.

From the `Albums` page, a user can choose to view/manage a specific album in the standard Google Photos interface by clicking a button next to it.

## Uploading Photos from Drone
To upload photos to be accessed and identified through this web app, insert the microSD card from the drone into a compatibly computer and sign in to the `Drone PhotoApp` Google Photos account through in another window/tab and use Google's web interface to upload images. This is also how users can manage albums. (For Duke students who want the credentials to use this account, ask Dr. Martin Brooke)

## Creating an ID Request
Individual photos are displayed on the `Identification` page of this app. The template file is located at `views/pages/identification.ejs`. When this page is loaded, a request is made to `app.get('/getQueue', ...)` to the server `app.js`.

This handler returns a list of the `mediaItems` the user has loaded into the frame through search or from an album. They are rendered for display by the browser through the file `static/js/identification.js`. A thumbnail, scaled based on the original height and width, is used to render a preview initially while the image at full resolution is being loaded.

On this page, users can select one or multiple uploaded photos to send for identification using the Pl@ntNet API. All selected photos must be from the same Google Photos album. After photos are selected and the `Identify` button is clicked, an additional modal dialog appears to prompt the user for a plant organ that best fits the contents of each selected photo. This is a requirement of the API, and every photo needs to have an option selected (with at least one photo not chosen to be "Other"). When all organs are selected, send the ID request with the `Send` button, after which a toast will appear at the botton edge of the screen to inform the user about the progress of the request. It usually takes 1-2 seconds for the identification API to return a result.

After an identification is made and the results are received, the information is both displayed to the user in the FrontEnd on the Results page and saved to a persisting storage. This saving enables the identifications and user info to persist from session to session. Currently, this info is being saved server-side using [Node Persist](https://www.npmjs.com/package/node-persist). All of the results information is stored in the folders `persist-groups-identified` and `persist-items-groups-identified`. The former saves a unique group number for this round of identifications as the key and then a JSON object of the results received from the Pl@ntNet call, the media IDs for the photos (this enables the images to be loaded from Google Photos in the future), and the date of the identification. The latter saves the media ID as the key and an array of all groups that the image has been a part of for identification. This information is not currently being used, but was intended to be implemented as a form of popover when a user hovers over an image on the Identification Page.

To wipe the results memory, these folders can be deleted and the application should be restarted. More details can be found regarding this method of saving in a later section.

## Viewing Results
The results of a user's indentifications are displayed on the `Results` page of the app. The template of this page is located at `views/pages/results.ejs`

When this page is loaded, a request is made to to `app.get('/getIdentified', ...)` to the server `app.js`. From here, the backend loads all the results stored in the `persist-items-groups-identified`. For each group, the backend then makes an API call to the Google Photos API using the media IDs saved to the results to get full Media Items. The backend creates a JSON object of the results and Media Items and returns these to the frontend.

In the frontend, a card is created for each identified group. The top results are displayed to the user and more can be seen when clicking "View More". This opens a popover with more information. From here, a user can delete results that they have ruled out. This makes a call to the backend `app.post('/deleteResult'...)`) which updates the saved identifications for that group. In addition to deleting results, a user can enter their own by hitting `Enter Identification Info`. Once they save, this again gets sent to the backend `app.post('/saveUserResult', ...)`. After a delete or save result, the popover and card results are reloaded and thus the frontend is updated. 

## Deploying to a Server
To deploy this web app to a server, we suggest using a Duke VCM machine running Ubuntu 20.04. You will need to clone the repository to this machine and disable automatic power downs in the VCM management console. Once the machine is reserved and the repository is cloned, install NodeJS and any other prerequisite packages (including npm dependencies) before attempting to build and run the app. Build the app using `npm run build` in the `REST/PhotoFrame` directory. Then, to start the web server, run `sudo serve -s build -l 80` while in the `REST/PhotoFrame` directory to deploy the built app on the server, listening on port 80 (HTTP). After this command is run, you should be able to access the running app from another device by visiting the VM hostname in a web browser.

## Saving Information (Node Persist)
Node persist is an npm package that allows for saving information locally (server-side). When running the application for the first time, there are several new directories that are created, all starting with `persist-` These files in these folders contain all the information stored between sessions. In viewing them, they are stored in a structure similar to a JSON object with key/value pairs.

### Deleting Information Saved
A developer can delete any/all of the `persist-` directories to 'wipe the memory' and the directories will be recreated the next time the app is run. 

## Adding Additional Interfaces
If you decide to add additional pages or interfaces to the web app, we suggest using one of the existing pages as a template and adding/removing page elements and Javascript functions as necessary. Material Design Lite (MDL) is your friend and has a lot of clean, easy-to-use components built into it, so see if the thing you want to implement is accounted for in MDL before trying to make it from scratch.

All added pages should (unless you decide otherwise) have the `head.ejs` and `footer.ejs` partials at the top and bottom of the page-specific `.ejs` file. If your page needs to load dynamic content, consider using jQuery (as we do in many of our pre-existing pages).

## Next Steps
- Add compatibility for [iNaturalist](https://www.inaturalist.org/pages/api+reference) for human-based identification
- Switching over from saving information in Node Persist to a database
