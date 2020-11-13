function loadIdentified() {
    showLoadingDialog();
    $.ajax({
      type: 'GET',
      url: '/getIdentified',
      dataType: 'json',
      success: (data) => {
        // Queue has been loaded. Display the media items as a grid on screen.
        hideLoadingDialog();

        if(data.errors.length > 0){
            handleError('Could not load some of the identification results', data.errors);
        }
        showCards(data.identifications);
      },
      error: (data) => {
        hideLoadingDialog();
        handleError('Could not load Identified Results', data)
      }
    });
  }

  function deleteResult(groupID, resultID){
    $.ajax({
    type: 'POST',
    url: '/deleteResult',
    dataType: 'json',
    data: {
      groupID: groupID,
      resultID: resultID
    },
    success: (data) => {
      refreshCardAndModal(groupID, data);
    },
    error: (data) => {
      handleError('Error trying to delete a result: ', data.message);
    }
  });
  }

  function showCards(identifiedResults){
    $('#results-container').empty();

    let reverse = identifiedResults.reverse()

    $.each(reverse, (i, currentID) => {
        const card = $('<div />').addClass('demo-card-square mdl-card mdl-shadow--2dp card')
          .attr('id', `card-group-id-${currentID.groupID}`);
        const content = makeCardContent(currentID);
        card.append(content);
        $('#results-container').append(card);
    });
  }

  // returns a div of card content
function makeCardContent(identificationInfo) {
  const cardContent = $('<div />');
  const topHalf = makeTopHalfOfCard(identificationInfo);

  const results = identificationInfo.results;
  const list = $('<div />').addClass('card-ids-container');

  const listTitle = $('<div />').addClass('card-id-row');
  const name = $('<p />').addClass('card-id-common-name bold-text').text(`Possible Common Name`);
  const score = $('<p />').addClass('card-id-score bold-text').text(`Score`);
  listTitle.append(name);
  listTitle.append(score);

  $.each(results, (j, currentResult) => {
    const span = $('<div />').addClass('card-id-row');
    const name = $('<p />').addClass('card-id-common-name').text(`${j + 1}. ${currentResult.commonNames[0]}`);
    const score = $('<p />').addClass('card-id-score').text(`${currentResult.score}%`);
    span.append(name);
    span.append(score);
    list.append(span);
  });

  const border = $('<div />').addClass('mdl-card__actions mdl-card--border');
  const button = $('<a />').addClass('mdl-button mdl-button--colored mdl-js-button mdl-js-ripple-effect').text("View More");
  button.on('click', (e) => {
      displayResultModal(identificationInfo);
  })
  border.append(button);

  cardContent.append(topHalf);
  cardContent.append(listTitle);
  cardContent.append(list);
  cardContent.append(border);

  return cardContent;
}

//returns an element that contains the group id, date added, and slideshow
function makeTopHalfOfCard(currentID){
  let result = $('<div />');
  const titleDiv = $('<div />').addClass('mdl-card__title mdl-card--expand');
  const group = $('<p />').addClass('card-title mdl-card--expand bold-text').text(`Group ${currentID.groupID}`);
  const date = $('<p />').addClass('card-title mdl-card--expand').text(`Added on ${currentID.date}`);
  titleDiv.append(group);
  titleDiv.append(date);

  let baseURLs = [];
  currentID.mediaItems.map(x => {
    baseURLs.push(x.baseUrl)
  });
  const slideShow = makeSlideShowComponent(baseURLs);

  result.append(titleDiv)
  result.append(slideShow)
  return result
}

function makeSlideShowComponent(baseURLs) {
  //let thumbnails = [];
  let images = [];
  let selected = 0;

  const slideShowDiv = $('<div />').addClass('card-slideshow-container ');


  baseURLs.map(x => {
    let thumbnail = `${x}=w256-h256`;
    const image = $('<img />').attr('src', thumbnail)
      .addClass('img-fluid rounded card-slideshow-thumbnail')
      .attr('style', 'display:none');
    
      images.push(image);
      slideShowDiv.append(image);
  });
 
  images[selected].attr('style', 'display:block');

  const buttonsDiv = $('<div />').addClass("card-slideshow-buttons-container");
  const text = $('<p />').addClass('card-slideshow-text').text(`Image ${selected+1} of ${images.length}`);

  const prevButton = $('<img />')
      .attr('src', '../imgs/prev-button-img.png')
      .addClass('card-slideshow-button')
      .on('click', (e) => {
        images[selected].attr('style', 'display:none');
        selected--;
        if(selected < 0){
          selected = images.length-1;
        }
        images[selected].attr('style', 'display:block');
        text.text(`Image ${selected+1} of ${images.length}`);
      });



  const nextButton = $('<img />')
      .attr('src', '../imgs/next-button-img.png')
      .addClass('card-slideshow-button')
      .on('click', (e) => {
        images[selected].attr('style', 'display:none');
        selected++;
        if(selected == images.length){
          selected = 0;
        }
        images[selected].attr('style', 'display:block');
        text.text(`Image ${selected+1} of ${images.length}`);
      });

  buttonsDiv.append(prevButton);
  buttonsDiv.append(text);
  buttonsDiv.append(nextButton);
    

    //slideShowDiv.append(image);
    slideShowDiv.append(buttonsDiv);

    return slideShowDiv;


}

// updates the card and modal
function refreshCardAndModal(groupID, idInfo){
  $(`#card-group-id-${groupID}`).empty();
  const content = makeCardContent(idInfo);
  $(`#card-group-id-${groupID}`).append(content);

  displayResultModal(idInfo);
}


  function displayResultModal(currentID) {
    $('#results-modal-content').empty();
    var modalContainer = $(document.getElementById('results-modal'));
    modalContainer.attr('style', 'display:block');

    var modalContent = $(document.getElementById('results-modal-content'));

    // Create header with group id, date, and slideshow
    let header = makeTopHalfOfCard(currentID);
    modalContent.append(header);

    //  Create add User ID button
    let addIDbutton = $('<button />')
        .text('Enter Identification Info')
        .addClass('manual-id-button mdl-button mdl-js-button mdl-button--raised')
        .on('click', (e) => {

        });
      modalContent.append(addIDbutton);

    // Create section with All ids
    const border = $('<hr />');
    modalContent.append(border);

    const resultsContainer = $('<div />').addClass('modal-results-container');
    currentID.results.map((currentResult, index) => {
      let resultRow =$('<div />').addClass('modal-result-row');

      // column with the ranking (1, 2, ...)
      let resultRankColumn = $('<div />').addClass('modal-result-rank-column');
      let rank = $('<p />').text(index+1);
      resultRankColumn.append(rank);

      // column with identification results (name, species, family, etc)
      let resultInfoColumn = $('<div />').addClass('modal-result-info-column');
      let commonNameDiv = makeCommonNameRow(currentResult);
      let scientificNameRow = makeRow('Scientific Name', currentResult.scientificName);
      let genusRow = makeRow('Genus', currentResult.genus);
      let familyRow = makeRow('Family', currentResult.family);
      resultInfoColumn.append(commonNameDiv);
      resultInfoColumn.append(scientificNameRow);
      resultInfoColumn.append(genusRow);
      resultInfoColumn.append(familyRow);

      //column with the PlantNet score
      let scoreColumn = $('<div />').addClass('modal-result-score-column');
      let score = $('<p />').text(`${currentResult.score}%`);
      scoreColumn.append(score);

      // column with the delete result button
      let buttonColumn = $('<div />').addClass('modal-result-button-column');
      let button = $('<button />')
        .text('Delete')
        .addClass('delete-button mdl-button mdl-button--raised')
        .on('click', (e) => {
          
          deleteResult(currentID.groupID, currentResult.id);
        });
      buttonColumn.append(button);

      resultRow.append(resultRankColumn);
      resultRow.append(resultInfoColumn);
      resultRow.append(scoreColumn);
      resultRow.append(buttonColumn);

      resultsContainer.append(resultRow);

      const tempBorder = $('<hr />');
      resultsContainer.append(tempBorder);
    });

    modalContent.append(resultsContainer);
  }

function makeRow(titleText, valueText){
  const div = $('<div />').addClass('item-row');
  const title = $('<p />').addClass('item-label').text(`${titleText}:`);
  const value = $('<p />').addClass('item-value').text(valueText);
  div.append(title);
  div.append(value);
  return div;
}

function makeCommonNameRow(currentResult) {
  const commonNameDiv = $('<div />').addClass('item-row');
  const commonNameTitle = $('<p />').addClass('item-label').text('Common Names:');
  let names = [];
  currentResult.commonNames.map((name, i) => {
    let newName = name.toProperCase()
    if(i == 0){
      names.push(newName);
    } else {
      names.push(` ${newName}`);
    }
  });

  const commonNames = $('<p />').addClass('item-value').text(names);

  commonNameDiv.append(commonNameTitle);
  commonNameDiv.append(commonNames);

  return commonNameDiv;
}

  // can be called on a String object, converts to proper case ie 'john smith' becomes 'John Smith'
String.prototype.toProperCase = function () {
  return this.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
};

$(document).ready(() => {
    loadIdentified();

    $('#results-modal-close').on('click', (e) => {
      $('#results-modal').attr('style', 'display: hidden');
    });
});