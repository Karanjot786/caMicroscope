let uploadUrl = '../loader/upload/start/';
let checkUrl = '../loader/data/one/';
let thumbUrl = '../loader/data/thumbnail/';
let deleteSlideUrl = '../loader/slide/delete';
let downloadURL = '../loader/getSlide/';

let store = new Store('../data/');

function changeStatus(step, text, reset=true) {
  // Reset the status bar
  console.log('Previous: ', document.getElementById('load_status').innerHTML);
  document.getElementById('load_status').innerHTML='';
  // Display JSON as table:
  if (typeof text === 'object') { // If the text arg is a JSON
    let col = []; // List of column headers
    for (let key in text) {
      if (col.indexOf(key) === -1) {
        col.push(key);
      }
    }

    let table;
    let responsiveContainer;
    if (reset) {
      responsiveContainer = document.createElement('div');
      responsiveContainer.classList = 'table-responsive';
      table = document.createElement('table');
      table.id = 'statusTable';
      table.classList = 'table';

      // Add table headers:
      let tr = table.insertRow(-1);
      for (let i = 0; i < col.length; i++) {
        let th = document.createElement('th');
        th.innerHTML = col[i];
        tr.appendChild(th);
      }
    } else {
      table=document.getElementById('statusTable');
    }

    if (step == 'POST' && !reset) {
      tr = table.rows[table.rows.length-1];
      for (let j = 0; j < col.length; j++) {
        let tabCell = tr.cells[tr.cells.length-1];
        tabCell.innerHTML = Number(Number(tabCell.innerHTML) + 1);
      }
    } else {
      // Add JSON data to the table as rows:
      tr = table.insertRow(-1);
      for (let j = 0; j < col.length; j++) {
        let tabCell = tr.insertCell(-1);
        if (text[col[j]] && text[col[j]].length>65&&step == 'CHECK') {
          tabCell.innerHTML= `${text[col[j]].substr(0, 65)}<span class="collapse" id="more-${j}">
             ${text[col[j]].substr(65)}    </span>
    <span><a href="#more-${j}" data-toggle="collapse">... <i class="fa fa-caret-down"></i></span>`;
        } else {
          tabCell.innerHTML = text[col[j]];
        }
      }
      if (step == 'CHECK') {
        // During check, thumbnail needs to be fetched & added to the table
        // In this case, text[col[col.length - 1]] is the filename
        fetch(thumbUrl + text[col[col.length - 1]], {credentials: 'same-origin'}).then(
            (response) => response.json(), // if the response is a JSON object
        ).then((x)=>{
          let tabCell = tr.cells[tr.cells.length-1];
          tabCell.innerHTML = '';
          const img = new Image();
          img.src = x.slide;
          tabCell.appendChild(img);
          if (text['location']) {
            // indicating successful check
            checkSuccess = true;
            if (finishUploadSuccess === true) {
              $('#post_btn').show();
            } else {
              $('#post_btn').hide();
            }
          } else {
            checkSuccess = false;
            $('#post_btn').hide();
          }
        });
      }
    }

    let divContainer = document.getElementById('json_table');
    divContainer.innerHTML = '';
    responsiveContainer.appendChild(table);
    divContainer.appendChild(responsiveContainer);
    $('#statusTable').stacktable();
    // document.getElementById('load_status').innerHTML=step;
  } else {
    text = JSON.stringify(text);
    text = step + ' | ' + text;
    document.getElementById('load_status').innerHTML=text;
  }
}

function handleUpload(file, filename) {
  let data = new FormData();
  data.append('file', file);
  data.append('filename', filename);
  changeStatus('UPLOAD', 'Begun upload');
  fetch(uploadUrl, {
    credentials: 'same-origin',
    method: 'POST',
    body: data,
  }).then(
      (response) => response.json(), // if the response is a JSON object
  ).then(
      (success) => changeStatus('UPLOAD', success), // Handle the success response object
  ).catch(
      (error) => changeStatus('UPLOAD', error), // Handle the error response object
  );
}

function handleDownload(id) {
  let fileName='';
  store.getSlide(id)
      .then((response) => {
        if (response[0]) {
          return response[0]['location'];
        } else {
          throw new Error('Slide not found');
        }
      }).then((location) => {
        fileName = location.substring(location.lastIndexOf('/')+1, location.length);
        console.log(fileName);
        return fileName;
      }).then((fileName) =>{
        fetch(downloadURL + fileName, {
          credentials: 'same-origin',
          method: 'GET',
        }).then((response) => {
          if (response.status == 404) {
            throw response;
          } else {
            return response.blob();
          }
        })
            .then((blob) => {
              let url = window.URL.createObjectURL(blob);
              let a = document.createElement('a');
              a.href = url;
              a.download = fileName;
              document.body.appendChild(a);
              a.click();
              a.remove(); // afterwards we remove the element again
              window.URL.revokeObjectURL(blob);
            }).catch((error) =>{
              console.log(error);
              alert('Error! Can\'t download file.');
            },
            );
      }).catch((error) => {
        console.log(error);
      });
}

function convertSlide(filename, destFilename) {
  let convUrl = '../loader/slide/' + filename + '/pyramid/' + destFilename;
  return fetch(convUrl, {'method': 'POST'}).then((response) => response.json());
}

function handleCheck(filename, reset, id, noRetry) {
  fetch(checkUrl + filename, {credentials: 'same-origin'}).then(
      (response) => response.json(), // if the response is a JSON object
  ).then(
      (success) => {
        // errors aren't always non-success, so need to check here too
        if (success.error) {
          console.error(success.error);
          throw success;
        }
        success['ID'] = id;
        // Add the filename, to be able to fetch the thumbnail.
        success['preview'] = filename;
        changeStatus('CHECK', success, reset);
        $('#finish_btn').fadeOut(300);
        $('#filename0, #slidename0, #filter0').prop('disabled', true);
      }, // Handle the success response object
  ).catch((error)=>{
    if (!(noRetry)) {
      console.log('retrying with conversion');
      let destFilename = filename.replace('.', '_') + '_conv.tif';
      document.getElementById('filename'+0).value = destFilename;
      convertSlide(filename, destFilename).then((x)=>handleCheck(destFilename, reset, id, true))
          .catch((err)=>changeStatus('CHECK', error, reset));
    } else {
      console.info('not retrying');
      changeStatus('CHECK', error, reset); // Handle the error response object
    }
  });
}

function handlePost(filename, slidename, filter, reset) {
  fetch(checkUrl + filename, {credentials: 'same-origin'}).then(
      (response) => response.json(), // if the response is a JSON object
  ).then(
      (data) => {
        data['upload_date'] = new Date(Date.now()).toLocaleString();
        data.name = slidename;
        if (filter) {
          data.filter = filter;
        }
        data.location = '/images/' + filename;
        data.study = '';
        data.specimen = '';
        data.mpp = parseFloat(data['mpp-x']) || parseFloat(data['mpp-y']) || 0;
        data.mpp_x = parseFloat(data['mpp-x']);
        data.mpp_y = parseFloat(data['mpp-y']);
        store.post('Slide', data).then(
            (success) => {
              initialize();
              $('#upload-dialog').modal('hide');
              showSuccessPopup('Slide uploaded successfully');
              return changeStatus('POST', success.result, reset);
            }, // Handle the success response object
        ).catch(
            (error) => changeStatus('POST', error, reset), // Handle the error response object
        );
      },
  ).catch(
      (error) => changeStatus('POST', error, reset), // Handle the error response object
  );
}

// register events for file upload
function UploadBtn() {
  const fileInput = document.getElementById('fileinput');
  let filename = document.getElementById('filename').value;
  handleUpload(fileInput.files[0], filename);
}

function CheckBtn() {
  let filename = document.getElementById('filename'+0).value;
  handleCheck(filename, true, 1);
}

function PostBtn() {
  document.getElementById('load_status').innerHTML='';
  let filename = document.getElementById('filename'+0).value;
  let slidename = document.getElementById('slidename'+0).value;
  let filter = document.getElementById('filter'+0).value;
  handlePost(filename, slidename, filter, true);
}

function deleteSlideFromSystem(id, filename, reqId=null) {
  // let data = new FormData();
  // data.append('filename', filename);
  data = {
    'filename': filename,
  };
  data = JSON.stringify(data);
  fetch(deleteSlideUrl, {
    credentials: 'include',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: data,
  }).then(
      (response) => response.json())
      .then((data) => {
        if (data.success) {
        // return true;
          store.deleteSlide(id)
              .then(function() {
                if (reqId) {
                  store.cancelRequestToDeleteSlide(requestId=reqId, onlyRequestCancel=false);
                }
              })
              .then(showSuccessPopup('Slide deleted successfully'));
        } else {
          alert('There was an error in deleting the file. Please try again or refresh the page.');
        }
        return true;
      },
      ).catch(
          (error) => {
            console.log('ERROR: ' + error);
          }, // Handle the error response object
      );
}
