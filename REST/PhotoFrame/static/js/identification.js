var selectedItems = [];

function displayAlbumList() {
  // Define view that has list of albums on left, then a pane of images on right that can be selected
  hideError();
  showLoadingDialog();
  $('#identification-albums').empty();

  $.ajax({
    type: 'GET',
    url: '/getAlbums',
    dataType: 'json',
    success: (data) => {
      console.log('Loaded albums: ' + data.albums);
      // Render each album from the backend in its own row, consisting of
      // title, cover image, number of items, link to Google Photos and a
      // button to add it to the photo frame.
      // The items rendered here are albums that are returned from the
      // Library API.
      $.each(data.albums, (i, item) => {
      // Set up a Material Design Lite list.
      const materialDesignLiteList =
          $('<li />').addClass('mdl-list__item mdl-list__item--two-line')
              .addClass('id-album-item')
              .attr('data-id', item.id)
              .attr('data-title', item.title);

      // Create the primary content for this list item.
      const primaryContentRoot =
          $('<div />').addClass('mdl-list__item-primary-content');
      materialDesignLiteList.append(primaryContentRoot);

      // The title of the album as the primary title of this item.
      const primaryContentTitle = $('<div />').text(item.title);
      primaryContentRoot.append(primaryContentTitle);

      // The number of items in this album as the sub title.
      const primaryContentSubTitle =
          $('<div />')
              .text(`(${item.mediaItemsCount} items)`)
              .addClass('mdl-list__item-sub-title');
      primaryContentRoot.append(primaryContentSubTitle);

      // Add the list item to the list of albums.
      $('#identification-albums').append(materialDesignLiteList);
      });

      hideLoadingDialog();
      console.log('Albums loaded.');
    },
      error: (data) => {
          hideLoadingDialog();
          handleError('Couldn\'t load albums', data);
      }
  });
}

function showPreview(source, mediaItems) {
  $('#images-container').empty();

  // Display the length and the source of the items if set.
  if (source && mediaItems) {
    $('#images-count').text(mediaItems.length);
    $('#images-source').text(JSON.stringify(source));
    $('#preview-description').show();
  } else {
    $('#images-count').text(0);
    $('#images-source').text('No photo search selected');
    $('#preview-description').hide();
  }

  // Loop over each media item and render it.
  $.each(mediaItems, (i, item) => {
    // Construct a thumbnail URL from the item's base URL at a small pixel size.
    const thumbnailUrl = `${item.baseUrl}=w256-h256`;
    // Constuct the URL to the image in its original size based on its width and
    // height.
    const fullUrl = `${item.baseUrl}=w${item.mediaMetadata.width}-h${
        item.mediaMetadata.height}`;

    // Compile the caption, conisting of the description, model and time.
    const description = item.description ? item.description : '';
    const model = item.mediaMetadata.photo.cameraModel ?
        `#Shot on ${item.mediaMetadata.photo.cameraModel}` :
        '';
    const time = item.mediaMetadata.creationTime;
    const captionText = `${description} ${model} (${time})`

    const thumbnailDiv = $('<a />')
        .addClass('id-media-item')
        .attr('data-base-url', item.baseUrl)
        .attr('data-media-id', item.id)
        .attr('style', "position: relative; width: max-content;");

    const thumbnailImage = $('<img />')
                               .attr('src', thumbnailUrl)
                               .attr('alt', captionText)
                               .addClass('img-fluid rounded thumbnail');
    thumbnailDiv.append(thumbnailImage);

    const checkmark = $('<i />')
                                .addClass('material-icons')
                                .addClass('image-check-unchecked')
                                .attr('id', "check_" + item.id)
                                .text("check_circle");
    thumbnailDiv.append(checkmark);

    thumbnailDiv.append();

    $('#images-container').append(thumbnailDiv);
  });
};

function loadFromAlbum(name, id) {
  console.log("ALBUM:"+id);
  showLoadingDialog();
  // Make an ajax request to the backend to load from an album.
  $.ajax({
    type: 'POST',
    url: '/loadFromAlbum',
    dataType: 'json',
    data: {albumId: id},
    success: (data) => {
      console.log('Albums imported:' + JSON.stringify(data.parameters));
      if (data.photos && data.photos.length) {
        // Photos were loaded from the album, open the photo frame preview
        // queue.
        loadQueue();
      } else {
        // No photos were loaded. Display an error.
        handleError('Couldn\'t import album', 'Album is empty.');
      }
      hideLoadingDialog();
    },
    error: (data) => {
      handleError('Error trying to identify', data.message);
    }
  });
}

// Makes a backend request to display the queue of photos currently loaded into
// the photo frame. The backend returns a list of media items that the user has
// selected. They are rendered in showPreview(..).
function loadQueue() {
  showLoadingDialog();
  $.ajax({
    type: 'GET',
    url: '/getQueue',
    dataType: 'json',
    success: (data) => {
      // Queue has been loaded. Display the media items as a grid on screen.
      hideLoadingDialog();
      showPreview(data.parameters, data.photos);
      hideLoadingDialog();
      console.log('Loaded queue.');
    },
    error: (data) => {
      hideLoadingDialog();
      handleError('Could not load queue', data)
    }
  });
}

function identify(paramJSON) {
$.ajax({
  type: 'POST',
  url: '/identifyPlant',
  dataType: 'json',
  data: { paramJSON: paramJSON },
  success: (data) => {
    console.log('API hit');
    console.log(data);
  },
  error: (data) => {
    handleError('Couldn\'t import album', data);
  }
});
}

// takes in a media item ID and hits the google photos API
// to get the rest of the info for the image
// TODO: this will probs be moved to another page
function getMediaItem(mediaItemID) {
$.ajax({
  type: 'POST',
  url: '/getMediaItem',
  dataType: 'json',
  data: { mediaItemID: mediaItemID },
  success: (data) => {
    console.log('Media Item Gotten, ', data);
  },
  error: (data) => {
    handleError('Couldn\'t import media item', data);
  }
});
}

function getIdentifiedForAlbum(albumId) {
$.ajax({
  type: 'POST',
  url: '/getAlbumIdentified',
  dataType: 'json',
  data: { albumId: albumId },
  success: (data) => {
    console.log('Album media Items Gotten, ', data[0]);
  },
  error: (data) => {
    handleError('Couldn\'t get identified info for this album', data);
  }
});
}

$(document).ready(() => {
  // Load the list of albums from the backend when the page is ready.
  displayAlbumList();
  
  $('#identification-albums').on('click', '.id-album-item', (event) => {
    console.log("Album target");
    console.log(event);
      const target = $(event.currentTarget);
      const albumId = target.attr('data-id');
      const albumTitle = target.attr('data-title');

      console.log('Importing album: ' + albumTitle);

      loadFromAlbum(albumTitle, albumId);
      selectedItems = [];
  });

  // Clicking on an image will add it to an array of selected items and display a checkmark over it.
  $('#images-container').on('click', '.id-media-item', (event) => {
    const target = $(event.currentTarget);
    //const itemUrl = target.attr('data-base-url');
    const itemId = target.attr('data-media-id');

    console.log('ID of clicked: ', itemId);;
    var currCheck = document.getElementById('check_' + itemId);
    
    if (currCheck.classList.contains("image-check-unchecked")) {
      currCheck.classList.replace("image-check-unchecked", "image-check-checked");
      target.addClass("image-selected");
      selectedItems.push(itemId);
    } else if (currCheck.classList.contains("image-check-checked")) {
      currCheck.classList.replace("image-check-checked", "image-check-unchecked");
      target.removeClass("image-selected");
      selectedItems.splice(selectedItems.indexOf(itemId), 1);
    }
  })

  $('#id_button').on('click', (event) => {
    console.log("Clicked ID button.");
    console.log("Selected item IDs: " + selectedItems);
    if (selectedItems.length > 0) {

    // TODO: display per-photo organ specifiers

    /*const param = [
      {
        url: target.attr('data-base-url'),
        organ: "flower",
        mediaID: target.attr('data-media-id')
      }
    ]*/

    //identify(target, param);

    } else {
      alert("Select at least one photo to identify.");
    }
  });
});
