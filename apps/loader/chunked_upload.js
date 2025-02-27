// expects changeStatus to be defined from loader.js

let startUrl = '../loader/upload/start';
let continueUrl = '../loader/upload/continue/';
let finishUrl = '../loader/upload/finish/';
let startGoogleDriveUrl = '../loader/googleDriveUpload/getFile';
let continueGoogleDriveUrl = '../loader/googleDriveUpload/checkStatus';
let finishUploadSuccess = false;
let checkSuccess = false;
let chunkSize = 5*1024*1024;
let tokenChange = true;
let filenameChange = true;
let oldToken = '';
let oldFilename='';

// read a chunk of the file
function promiseChunkFileReader(file, part) {
  return new Promise((resolve, reject)=>{
    let fr = new FileReader();
    fr.onload = (evt)=>{
      if (evt.target.error == null) {
        const d = evt.target.result.split(',')[1];
        if (d) {
          resolve(d);
        } else {
          reject(new Error('Done Reading') );
        }
      } else {
        reject(evt.target.error);
      }
    };
    let blob = file.slice(part*chunkSize, (part+1)*chunkSize);
    fr.readAsDataURL(blob);
  });
}

async function readFileChunks(file, token) {
  let part = 0;
  $('#upload-progress-div').css('display', 'flex');
  let complete = false;
  while (!complete) {
    try {
      const data = await promiseChunkFileReader(file, part);
      const body = {chunkSize: chunkSize, offset: part*chunkSize, data: data};
      const res = await continueUpload(token)(body, file);
      part++;
      console.log(part);
    } catch (e) {
      console.log(e);
      changeStatus('UPLOAD', e);
      $('#filenameRow, #slidenameRow, #filterRow, #finish_btn').show(400);
      $('#upload-progress-div').fadeOut();
      complete = true;
    }
  }
}


async function handleUpload(selectedFiles) {
  selectedFile = selectedFiles[0];
  const filename = selectedFiles[0]['name'];
  const token = await startUpload(filename);
  $('#tokenRow').show(300);
  const callback = continueUpload(token);
  readFileChunks(selectedFile, token);
  // parseFile(selectedFile, callback, 0, x=>(changeStatus("UPLOAD", "Finished Reading File")))
  updateFormOnUpload(selectedFiles[0]['name'], token);

  document.getElementById('fileUploadInput').colSpan = selectedFiles.length;
  document.getElementById('controlButtons').colSpan = selectedFiles.length+1;
}

async function startUpload(filename) {
  const body = {filename: filename};
  const token = fetch(startUrl, {method: 'POST', body: JSON.stringify(body), headers: {
    'Content-Type': 'application/json; charset=utf-8',
  }}).then((x)=>x.json());
  try {
    const a = await token;
    changeStatus('UPLOAD', 'Begun upload - Token:' + a['upload_token']);
    return a['upload_token'];
  } catch (e) {
    changeStatus('UPLOAD | ERROR;', e);
  }
}

function continueUpload(token) {
  return async function(body, file) {
    let progressValue = Math.floor((body.offset/file.size)*100);
    $('#upload-progress').css('width', progressValue+'%').attr('aria-valuenow', progressValue).text(progressValue + '%');
    changeStatus('UPLOAD', 'Uploading chunk at: '+ body.offset/(1024*1024) +'MB of total '+
                  Math.round(file.size/(1024*1024)) + 'MB');
    return await fetch(continueUrl + token, {method: 'POST', body: JSON.stringify(body), headers: {
      'Content-Type': 'application/json; charset=utf-8',
    }});
  };
}

function finishUpload() {
  let reset = true;
  const token = document.getElementById('token'+0).value;
  const filename = document.getElementById('filename'+0).value;
  if (token === oldToken) {
    tokenChange=false;
  } else {
    tokenChange=true;
    oldToken=token;
  }
  if (filename === oldFilename) {
    filenameChange = false;
  } else {
    filenameChange=true;
    oldFilename=filename;
  }
  if (!filenameChange && !tokenChange) {
    if (finishUploadSuccess) {
      changeStatus('UPLOAD', 'You have already uploaded this file just now.');
      if (checkSuccess) {
        $('#check_btn').show();
        $('#post_btn').show();
      }
    }
    return;
  }
  const body = {filename: filename};
  changeStatus('UPLOAD', 'Finished Reading File, Posting');
  const regReq = fetch(finishUrl + token, {method: 'POST', body: JSON.stringify(body), headers: {
    'Content-Type': 'application/json; charset=utf-8',
  }});
  regReq.then((x)=>x.json()).then((a)=>{
    changeStatus('UPLOAD | Finished', a, reset); reset = false;
    console.log(a);
    if (typeof a === 'object' && a.error) {
      finishUploadSuccess = false;
      $('#check_btn').hide();
      $('#post_btn').hide();
    } else {
      finishUploadSuccess=true;
      if (checkSuccess===true) {
        $('#check_btn').show();
        $('#post_btn').show();
      } else {
        $('#check_btn').show();
        $('#post_btn').hide();
      }
    }
  });
  regReq.then((e)=> {
    if (e['ok']===false) {
      finishUploadSuccess = false;
      $('#check_btn').hide();
      $('#post_btn').hide();
      changeStatus('UPLOAD | ERROR;', e);
      reset = true;
      console.log(e);
    } else {
      validateForm(CheckBtn);
    }
  },
  );
}


async function handleUrlUpload(url) {
  $('#uploadLoading').css('display', 'block');
  const token = await startUpload(url);
  await continueUrlUpload(token, url);
}

function updateFormOnUpload(fileName, token) {
  let fnametr = document.getElementById('filenameRow');
  let tokentr = document.getElementById('tokenRow');
  let slidetr = document.getElementById('slidenameRow');
  let filtertr = document.getElementById('filterRow');

  // Clear existing
  document.getElementById('json_table').innerHTML = '';
  let n = tokentr.cells.length;
  for (let i=0; i<n-1; i++) {
    fnametr.deleteCell(1);
    tokentr.deleteCell(1);
    slidetr.deleteCell(1);
    filtertr.deleteCell(1);
  }
  // Add columns
  fnametr.insertCell(-1).innerHTML = `<input type=text class="form-control" name=filename id='filename0'
    onchange=fileNameChange(); value='${fileName}'>`;
  fileNameChange();
  tokentr.insertCell(-1).innerHTML = `<input type=text class="form-control" onchange=hideCheckButton();hidePostButton();
    disabled name=token id='token0'>`;
  slidetr.insertCell(-1).innerHTML = `<input type=text class="form-control" name=slidename id='slidename0'>`;
  filtertr.insertCell(-1).innerHTML = `<input type=text class="form-control" name=filter id='filter0'
    placeholder="['list','of','filters']">`;
  document.getElementById('token'+0).value = token;
}

function afterUrlUpload(token, url) {
  $('#uploadLoading').css('display', 'none');
  let fileName= url.substring(url.lastIndexOf('/')+1, url.length);
  updateFormOnUpload(fileName, token);
}

async function continueUrlUpload(token, url) {
  let enurl = encodeURIComponent(url);
  const body = {'url': enurl};
  changeStatus('UPLOAD', 'Uploading URL content ');
  await $.ajax({
    url: '../loader/urlupload/continue/'+token,
    type: 'POST',
    data: JSON.stringify(body),
    contentType: 'application/json; charset=utf-8',
    dataType: 'json',
  }).then((response)=> {
    if (response['status']=='OK Uploaded') {
      console.log(response);
      console.log('Uploaded');
      afterUrlUpload(token, url);
    }
  }).catch((error) => {
    if (error.status == 0) {
      let i=0;
      let inter=setInterval(function() {
        i++;
        if (i>=180) { // 180*5000 = 900000 = 15min max time for running this
          clearInterval(inter);
        }
        fetch('../loader/urlupload/check?url='+enurl+'&token='+token, {
          credentials: 'same-origin',
          method: 'GET',
        }).then((response)=>{
          // console.log(response);
          if (response.status==200) {
            return response.json();
          } else {
            throw new Error('Error in check');
          }
        }).then((response)=>{
          console.log('uploading please wait..');
          if (response['uploaded']== 'True') { // check if upload completed or not
            console.log('upload complete');
            clearInterval(inter);
            afterUrlUpload(token, url);
          }
        }).catch((error) => {
          console.log(error);
          clearInterval(inter);
        });
      }, 5000); // check for url upload status from server in every 5 sec. (for big files or slow connection)
    } else {
      console.log(error);
      $('#uploadLoading').css('display', 'none');
      alert(error['responseJSON']['error']);
    }
  });
}

// Start the Google Picker for Google Drive Upload
function googlePickerStart() {
  // The Browser API key obtained from the Google API Console.
  // Replace with your own Browser API key, or your own key.
  let developerKey = 'xxxxxx';

  // The Client ID obtained from the Google API Console. Replace with your own Client ID.
  let clientId = 'xxxxxx';

  // Replace with your own project number from console.developers.google.com.
  // See "Project number" under "IAM & Admin" > "Settings"
  let appId = 'xxxxxx';

  // Scope to use to access user's Drive items.
  let scope = ['https://www.googleapis.com/auth/drive.file'];

  let pickerApiLoaded = false;
  let oauthToken;

  // Use the Google API Loader script to load the google.picker script.
  function loadPicker() {
    gapi.load('auth', {'callback': onAuthApiLoad});
    gapi.load('picker', {'callback': onPickerApiLoad});
  }

  function onAuthApiLoad() {
    window.gapi.auth.authorize(
        {
          'client_id': clientId,
          'scope': scope,
          'immediate': false,
        },
        handleAuthResult);
  }

  function onPickerApiLoad() {
    pickerApiLoaded = true;
    createPicker();
  }

  function handleAuthResult(authResult) {
    if (authResult && !authResult.error) {
      oauthToken = authResult.access_token;
      createPicker();
    }
  }

  // Create and render a Picker object
  function createPicker() {
    if (pickerApiLoaded && oauthToken) {
      let view = new google.picker.DocsView(google.picker.ViewId.DOCS).setParent('root').setIncludeFolders(true);
      let picker = new google.picker.PickerBuilder()
          .enableFeature(google.picker.Feature.NAV_HIDDEN)
          .setAppId(appId)
          .setOAuthToken(oauthToken)
          .addView(view)
          .addView(new google.picker.DocsUploadView())
          .setDeveloperKey(developerKey)
          .setCallback(pickerCallback)
          .build();
      picker.setVisible(true);
    }
  }

  // A simple callback implementation.
  function pickerCallback(data) {
    if (data.action == google.picker.Action.PICKED) {
      let fileId = data.docs[0].id;
      let fileName = data.docs[0].name;
      // alert('The user selected: ' + fileId);
      startGoogleDriveUpload(getUserId(), fileId, fileName);
    }
  }
  loadPicker();
  $('#upload-dialog').modal('hide');
}


function startGoogleDriveUpload(userId, fileId, fileName) {
  $('#upload-dialog').modal('show');
  $('.fileInputClass label').text(fileName);
  $('#uploadLoading').show();
  $('#gdriveUpload, #urlswitch').hide();
  let data = JSON.stringify({'userId': userId, 'fileId': fileId});
  // console.log(data);
  let requestOptions = {
    method: 'POST',
    body: data,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  };

  fetch(startGoogleDriveUrl, requestOptions)
      .then((response) => response.text())
      .then((result) => {
        result = JSON.parse(result);
        console.log(result);
        token = result['token'];
        updateFormOnUpload(fileName, token);
        $('#tokenRow').show(300);
        if (result['authURL'] != null) {
          window.open(result['authURL'], '_blank');
        }
        continueGoogleDriveUpload(token);
      })
      .catch((error) => console.log('error', error));
}

function continueGoogleDriveUpload(token) {
  let data = JSON.stringify({'token': token});
  let requestOptions = {
    method: 'POST',
    body: data,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  };

  let i = 0;
  let inter=setInterval(function() { // Calling this route every 3 sec. till the download is complete
    i++;
    if (i>=180) { // 180*3000 ms = 9 minutes (max time for running this)
      clearInterval(inter);
    }
    fetch(continueGoogleDriveUrl, requestOptions)
        .then((response) => response.text())
        .then((result) => {
          result = JSON.parse(result);
          console.log(result);
          if (result['downloadDone']) {
            changeStatus('UPLOAD', 'Done uploading file from google drive');
            $('#filenameRow, #slidenameRow, #filterRow, #finish_btn').show(400);
            $('#upload-progress-div, #uploadLoading').fadeOut();
            $('#gdriveUpload, #urlswitch').show();
            complete = true;
            clearInterval(inter);
          }
        })
        .catch((error) => {
          console.log('error', error);
          alert('ERROR: '+error);
          clearInterval(inter);
        });
  }, 3000);
}
