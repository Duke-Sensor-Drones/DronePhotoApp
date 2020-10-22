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
  
    // Show an error message and disable the slideshow button if no items are
    // loaded.
    if (!mediaItems || !mediaItems.length) {
      $('#images_empty').show();
      $('#startSlideshow').prop('disabled', true);
    } else {
      $('#images_empty').hide();
      $('startSlideshow').removeClass('disabled');
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
  
      // Each image is wrapped by a link for the fancybox gallery.
      // The data-width and data-height attributes are set to the
      // height and width of the original image. This allows the
      // fancybox library to display a scaled up thumbnail while the
      // full sized image is being loaded.
      // The original width and height are part of the mediaMetadata of
      // an image media item from the API.
      const linkToFullImage = $('<a />')
                                  .attr('href', fullUrl)
                                  .attr('data-fancybox', 'gallery')
                                  .attr('data-width', item.mediaMetadata.width)
                                  .attr('data-height', item.mediaMetadata.height);
      // Add the thumbnail image to the link to the full image for fancybox.
      const thumbnailImage = $('<img />')
                                 .attr('src', thumbnailUrl)
                                 .attr('alt', captionText)
                                 .addClass('img-fluid rounded thumbnail');
      linkToFullImage.append(thumbnailImage);
  
      // The caption consists of the caption text and a link to open the image
      // in Google Photos.
      const imageCaption =
          $('<figcaption />').addClass('hidden').text(captionText);
      const linkToGooglePhotos = $('<a />')
                                     .attr('href', item.productUrl)
                                     .text('[Click to open in Google Photos]');
      imageCaption.append($('<br />'));
      imageCaption.append(linkToGooglePhotos);
      linkToFullImage.append(imageCaption);
  
      // Add the link (consisting of the thumbnail image and caption) to
      // container.
      $('#images-container').append(linkToFullImage);
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
        handleError('Couldn\'t import album', data);
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

$(document).ready(() => {
    // Load the list of albums from the backend when the page is ready.
    displayAlbumList();
    
    // Clicking the 'add to frame' button starts an import request.
    $('#identification-albums').on('click', '.id-album-item', (event) => {
        const target = $(event.currentTarget);
        const albumId = target.attr('data-id');
        const albumTitle = target.attr('data-title');

        console.log('Importing album: ' + albumTitle);

        loadFromAlbum(albumTitle, albumId);
    });

  });
  