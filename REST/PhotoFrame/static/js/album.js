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

// Loads a list of all albums owned by the logged in user from the backend.
// The backend returns a list of albums from the Library API that is rendered
// here in a list with a cover image, title and a link to open it in Google
// Photos.
function listAlbums() {
  hideError();
  showLoadingDialog();
  $('#albums').empty();

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
        // Load the cover photo as a 100x100px thumbnail.
        // It is a base url, so the height and width parameter must be appened.
        const thumbnailUrl = `${item.coverPhotoBaseUrl}=w100-h100`;

        // Set up a Material Design Lite list.
        const materialDesignLiteList =
            $('<li />').addClass('mdl-list__item mdl-list__item--two-line');

        // Create the primary content for this list item.
        const primaryContentRoot =
            $('<div />').addClass('mdl-list__item-primary-content');
        materialDesignLiteList.append(primaryContentRoot);

        // The image showing the album thumbnail.
        const primaryContentImage = $('<img />')
                                        .attr('src', thumbnailUrl)
                                        .attr('alt', item.title)
                                        .addClass('mdl-list__item-avatar');
        primaryContentRoot.append(primaryContentImage);

        // The title of the album as the primary title of this item.
        const primaryContentTitle = $('<div />').text(item.title).addClass('album-title');
        primaryContentRoot.append(primaryContentTitle);

        // The number of items in this album as the sub title.
        const primaryContentSubTitle =
            $('<div />')
                .text(`(${item.mediaItemsCount} items)`)
                .addClass('mdl-list__item-sub-title');
        primaryContentRoot.append(primaryContentSubTitle);

        // Secondary content consists of two links with buttons.
        const secondaryContentRoot =
            $('<div />').addClass('mdl-list__item-secondary-action');
        materialDesignLiteList.append(secondaryContentRoot);

        // The 'open in Google Photos' link.
        const linkToGooglePhotos =
            $('<a />').attr('target', '_blank').attr('href', item.productUrl);
        secondaryContentRoot.append(linkToGooglePhotos);

        // The button for the 'open in Google Photos' link.
        const googlePhotosButton = $('<button />')
                                       .addClass('gp-button raised')
                                       .text('Open in Google Photos');
        linkToGooglePhotos.append(googlePhotosButton);

        // Add the list item to the list of albums.
        $('#albums').append(materialDesignLiteList);
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

$(document).ready(() => {
  displayRemainingAPICalls();
  // Load the list of albums from the backend when the page is ready.
  listAlbums();
});
