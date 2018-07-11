function getJIRAFeed(callback, errorCallback){
    var user = document.getElementById("user").value;
    if(user == undefined) return;
    
    var url = "https://jira.secondlife.com/activity?maxResults=50&streams=user+IS+" + user + "&providers=issues";
    makeRequest(url, "").then(function(response) {
      // empty response type allows the request.responseXML property to be returned in the makeRequest call
      callback(url, response);
    }, errorCallback);
}

/**
 * @param {string} searchTerm - Search term for JIRA Query.
 * @param {function(string)} callback - Called when the query results have been  
 *   formatted for rendering.
 * @param {function(string)} errorCallback - Called when the query or call fails.
 */
async function getQueryResults(searchTerm, callback, errorCallback) {                                                 
    try {
      var response = await makeRequest(searchTerm, "json");
      callback(createHTMLElementResult(response));
    } catch (error) {
      errorCallback(error);
    }
}

function makeRequest(url, responseType) {
  return new Promise(function(resolve, reject) {
    var req = new XMLHttpRequest();
    req.open('GET', url);
    req.responseType = responseType;

    req.onload = function() {
      var response = responseType ? req.response : req.responseXML; 
      if(response && response.errorMessages && response.errorMessages.length > 0){
        reject(response.errorMessages[0]);
        return;
      }

      resolve(response);
    };

    // Handle network errors
    req.onerror = function() {
      reject(Error("Network Error"));
    }
    req.onreadystatechange = function() { 
      if(req.readyState == 4 && req.status == 401) { 
          reject("You must be logged in to JIRA to see this project.");
      }
    }

    // Make the request
    req.send();
  });
}

function loadOptions() {
  chrome.storage.sync.get({
    project: 'Sunshine',
    user: 'nyx.linden'
  }, function(items) {
    document.getElementById('project').value = items.project;
    document.getElementById('user').value = items.user;
  });
}

function buildJQL(callback) {
  var callbackBase = "https://jira.secondlife.com/rest/api/2/search?jql=";
  var project = document.getElementById("project").value;
  var status = document.getElementById("statusSelect").value;
  var inStatusFor = document.getElementById("daysPast").value
  var fullCallbackUrl = callbackBase;
  fullCallbackUrl += `project=${project}+and+status=${status}+and+status+changed+to+${status}+before+-${inStatusFor}d&fields=id,status,key,assignee,summary&maxresults=100`;
  callback(fullCallbackUrl); 
}

// Create HTML output to display the search results.
// results.json in the "json_results" folder contains a sample of the API response
// hint: you may run the application as well if you fix the bug. 
function createHTMLElementResult(response) {

  var issues = response.issues;
  var list = document.createElement('ul');

  for (var i = 0; i < issues.length; i++) {
    var issue = issues[i];
    var result = issue.key + ": " + issue.fields.summary + " - Status: " + issue.fields.status.name;
    var item = document.createElement('li');
    item.innerHTML = result;
    list.appendChild(item);
  }

  return list.outerHTML;
}

async function checkProjectExists(){
    try {
      return await makeRequest("https://jira.secondlife.com/rest/api/2/project/SUN", "json");
    } catch (errorMessage) {
      setStatus('ERROR. ' + errorMessage);
    }
}

// utility
function domify(str){
  var dom = (new DOMParser()).parseFromString('<!doctype html><body>' + str,'text/html');
  return dom.body.textContent;
}

// utility
function setStatus(message) {
  document.getElementById('status').innerHTML = message;
  document.getElementById('status').hidden = false
}

// Setup
document.addEventListener('DOMContentLoaded', function() {
  // if logged in, setup listeners
    checkProjectExists().then(function() {
      //load saved options
      loadOptions();

      // query click handler
      document.getElementById("query").onclick = function() {
        // build query
        buildJQL(function(url) {
          setStatus('Performing JIRA search for ' + url);

          // perform the search
          getQueryResults(url, function(return_val) {
            // render the results
            setStatus('Query term: ' + url + '\n');
            
            var jsonResultDiv = document.getElementById('query-result');
            jsonResultDiv.innerHTML = return_val;
            jsonResultDiv.hidden = false;

          }, function(errorMessage) {
              setStatus('ERROR. ' + errorMessage);
          });
        });
      }

      // activity feed click handler
      document.getElementById("feed").onclick = function() {   
        // get the xml feed
        getJIRAFeed(function(url, xmlDoc) {
          setStatus('Activity query: ' + url + '\n');

          // render result
          var feed = xmlDoc.getElementsByTagName('feed');
          var entries = feed[0].getElementsByTagName("entry");
          var list = document.createElement('ul');

          for (var index = 0; index < entries.length; index++) {
            var html = entries[index].getElementsByTagName("title")[0].innerHTML;
            var updated = entries[index].getElementsByTagName("updated")[0].innerHTML;
            var item = document.createElement('li');
            item.innerHTML = new Date(updated).toLocaleString() + " - " + domify(html);
            list.appendChild(item);
          }

          var feedResultDiv = document.getElementById('query-result');
          if(list.childNodes.length > 0){
            feedResultDiv.innerHTML = list.outerHTML;
          } else {
            setStatus('There are no activity results.');
          }
          
          feedResultDiv.hidden = false;

        }, function(errorMessage) {
            setStatus('ERROR. ' + errorMessage);
        });    
      };        

    }).catch(function(errorMessage) {
        setStatus('ERROR. ' + errorMessage);
    });   
});
