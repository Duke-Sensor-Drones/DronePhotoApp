function loadIdentified() {
    showLoadingDialog();
    $.ajax({
      type: 'GET',
      url: '/getIdentified',
      dataType: 'json',
      success: (data) => {
        // Queue has been loaded. Display the media items as a grid on screen.
        hideLoadingDialog();
        
        console.log(data);
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

  function showCards(identifiedResults){
    $('#results-container').empty();

    $.each(identifiedResults, (i, result) => {
        const card = $('<div />').addClass('demo-card-square mdl-card mdl-shadow--2dp');
        const titleDiv = $('<div />').addClass('mdl-card__title mdl-card--expand');
        const title = $('<h2 />').addClass('mdl-card__title mdl-card--expand').text(result.results[0].scientificName);
        titleDiv.append(title);
        

        const thumbnailUrl = `${result.mediaItems[0].baseUrl}=w256-h256`;         

        const image = $('<img />').attr('src', thumbnailUrl)
            .addClass('img-fluid rounded thumbnail');

        
        const supportingText = $('<div />').addClass('mdl-card__supporting-text').text('Lorem ipsum dolor sit amet, consectetur adipiscing elit Aenan convallis.');
        const border = $('<div />').addClass('mdl-card__actions mdl-card--border');
        const button = $('<a />').addClass('mdl-button mdl-button--colored mdl-js-button mdl-js-ripple-effect').text("Update");
        border.append(button);

        card.append(titleDiv);
        card.append(image);
        card.append(supportingText);
        card.append(border);

        $('#results-container').append(card);
    });
  }


$(document).ready(() => {
    loadIdentified();
    
    });