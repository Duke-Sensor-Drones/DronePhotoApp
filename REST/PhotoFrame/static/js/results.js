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

  function saveUserResult(groupID, scientificName, family, genus, commonNames){
    $.ajax({
    type: 'POST',
    url: '/saveUserResult',
    dataType: 'json',
    data: {
      groupID: groupID,
      scientificName: scientificName,
      family: family,
      genus: genus,
      commonNames: commonNames
    },
    success: (data) => {
      console.log(data);
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
      console.log(currentID);
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
    var displayedScore = currentResult.manuallyIdentified ? 'U.E.' : `${currentResult.score}%`;
    const score = $('<p />').addClass('card-id-score').text(displayedScore);
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
        .addClass('blue-button mdl-button mdl-js-button mdl-button--raised')
        .on('click', (e) => {
          $('#manualEntryContainer').attr('style', 'display:block');
        });
      modalContent.append(addIDbutton);

    // Create manual entry div, initially hidden
    let manualEntry = makeManualEntryDiv(currentID.groupID);
    modalContent.append(manualEntry);

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

      // Make a single formatted string of all the common names
      let names = [];
      currentResult.commonNames.map((name, i) => {
        let newName = name.toProperCase()
        if(i == 0){
          names.push(newName);
        } else {
          names.push(` ${newName}`);
        }
      });
      if(names.length == 0){
        names.push('None Found');
      }
      
      // column with identification results (name, species, family, etc)
      let resultInfoColumn = $('<div />').addClass('modal-result-info-column');


      let commonNameDiv = makeRow('Common Names', names);
      let scientificNameRow = makeRow('Scientific Name', currentResult.scientificName);
      let genusRow = makeRow('Genus', currentResult.genus);
      let familyRow = makeRow('Family', currentResult.family);
      resultInfoColumn.append(commonNameDiv);
      resultInfoColumn.append(scientificNameRow);
      resultInfoColumn.append(genusRow);
      resultInfoColumn.append(familyRow);

      //column with the PlantNet score
      let scoreColumn = $('<div />').addClass('modal-result-score-column');
      const displayedScore = currentResult.manuallyIdentified ? 'U.E.' : `${currentResult.score}%`;
      let score = $('<p />').text(displayedScore);
      scoreColumn.append(score);

      // column with the delete result button
      let buttonColumn = $('<div />').addClass('modal-result-button-column');
      let button = $('<button />')
        .text('Delete')
        .addClass('red-button mdl-button mdl-button--raised')
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

  // makes a row with a bolded title (titleText) and a value (valueText)
function makeRow(titleText, valueText){
  const div = $('<div />').addClass('item-row');
  const title = $('<p />').addClass('item-label').text(`${titleText}:`);
  const value = $('<p />').addClass('item-value').text(valueText);
  div.append(title);
  div.append(value);
  return div;
}

function makeManualEntryDiv(groupID){
  const entriesRow = $('<div />').addClass('modal-manual-entry-col-container');

  // make column 1 which has a bunch of short text inputs
  const col1 = $('<form />').addClass('modal-manual-entry-col1');
  const sciNameLabel = $('<p />').text('Scientific Name:').addClass('modal-manual-entry-label');
  const sciNameInput = $('<input />').attr('type', 'text').addClass('text-input').attr('id', 'sciNameUserInput');
  const genusLabel = $('<p />').text('Genus:').addClass('modal-manual-entry-label');
  const genusInput = $('<input />').attr('type', 'text').addClass('text-input').attr('id', 'genusUserInput');
  const familyLabel = $('<p />').text('Family:').addClass('modal-manual-entry-label');
  const familyInput = $('<input />').attr('type', 'text').addClass('text-input').attr('id', 'familyUserInput');


  col1.append(sciNameLabel, sciNameInput, genusLabel, genusInput, familyLabel, familyInput);

  // make column 2 which has a text area input
  const col2 = $('<form />').addClass('modal-manual-entry-col2');
  let titleRow = $('</p />').text("Common Names:").addClass('modal-manual-entry-label');
  let instructionsRow = $('<p />').text('(Split names by a new line)').addClass('modal-manual-entry-instruction');
  let commonNamesInput = $('<textarea />').attr('id', 'commonNamesUserInput');
  col2.append(titleRow, instructionsRow, commonNamesInput);

  entriesRow.append(col1, col2);

  //make button row
  const buttonRowDiv = $('<div />').addClass('modal-manual-entry-button-row');
  const saveButton = $('<button />')
                        .addClass('green-button mdl-button mdl-js-button mdl-button--raised')
                        .text('Save')
                        .attr('id', 'saveManualEntryButton')
                        .on('click', (e) => {
                            console.log("Save Clicked");
                            const sciName = document.getElementById('sciNameUserInput').value;
                            const genus = document.getElementById('genusUserInput').value;
                            const family = document.getElementById('familyUserInput').value;
                            const namesString = document.getElementById('commonNamesUserInput').value;
                            const commonNamesArr = namesString.split("\n");
                            saveUserResult(groupID, sciName, family, genus, commonNamesArr);
                            $('#manualEntryContainer').attr('style', 'display: none');
                        });
  const cancelButton = $('<button />')
                        .addClass('red-button mdl-button mdl-js-button mdl-button--raised')
                        .text('Cancel')
                        .attr('id', 'cancelManualEntryButton')
                        .on('click', (e) => {
                          $('#manualEntryContainer').attr('style', 'display: none');
                        });
  buttonRowDiv.append(saveButton, cancelButton);

  const rowContainer = $('<div />')
                          .addClass('modal-manual-entry-row-container')
                          .attr('id', 'manualEntryContainer')
                          .attr('style', 'display: none');
  rowContainer.append(entriesRow, buttonRowDiv);

  return rowContainer;
}

// makes a row with labelText bolded and a text input element with the ID specified
function makeTextInputRow(labelText, inputElementID){
  const label = $('<p />').text(labelText).addClass('item-label');
  const input = $('<input />').attr('type', 'text').attr('id', inputElementID);

  div.append(label);
  div.append(input);
  return div;
}

  // can be called on a String object, converts to proper case ie 'john smith' becomes 'John Smith'
String.prototype.toProperCase = function () {
  return this.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
};

$(document).ready(() => {
    loadIdentified();

    $('#results-modal-close').on('click', (e) => {
      $('#results-modal').attr('style', 'display: none');
    });
});