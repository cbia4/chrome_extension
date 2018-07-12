function getJIRAFeed(callback, errorCallback){
  var user = document.getElementById("user").value;
  if(user == undefined || user.length < 1) {
    setStatus('ERROR. Please Enter a User');
    return;
  }

  var url = "https://jira.secondlife.com/activity?maxResults=50&streams=user+IS+" + user + "&providers=issues";
  makeRequest(url, "").then(function(response) {
    callback(url, response);
  }).catch(function(errorMessage) {
    errorCallback(errorMessage);
  });
}

/**
 * @param {string} searchTerm - Search term for JIRA Query.
 * @param {function(string)} callback - Called when the query results have been  
 *   formatted for rendering.
 * @param {function(string)} errorCallback - Called when the query or call fails.
 */
function getQueryResults(searchTerm, callback, errorCallback) {    
    makeRequest(searchTerm, "json").then(function(response) {
        callback(response);
    }).catch(function(errorMessage) {
        errorCallback(errorMessage);
    });                                             
}

async function checkProjectExists() {
  try {
    return await makeRequest("https://jira.secondlife.com/rest/api/2/project/SUN", "json");
  } catch(errorMessage) {
    setStatus('ERROR. ' + errorMessage);
  }
}

function makeRequest(url, responseType) {
  return new Promise(function(resolve, reject) {
    var req = new XMLHttpRequest();
    req.open('GET', url);
    req.responseType = responseType;

    req.onload = function() {
      var response = responseType ? req.response : req.responseXML; 
      if(response && response.errorMessages && response.errorMessages.length > 0) {
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

/**
 * @param {string} results - A list of results from a query.
 * @param {function(result)} formatResult - called when a result needs formatting
 */
function renderResults(results, formatResult) {
  var list = document.createElement('ul');
  
  if (results) {
    for (var i = 0; i < results.length; i++) {
      var result = formatResult(results[i]);
      var item = document.createElement('li');
      item.innerHTML = result;
      list.appendChild(item);
    }
  }

  var resultDiv = document.getElementById('query-result');
  if(list.childNodes.length > 0){
    resultDiv.innerHTML = list.outerHTML;
  } else {
    setStatus('There are no activity results.');
  }

  resultDiv.hidden = false;
  document.getElementById('results-header').hidden = false;
}

// utility
function buildJQL(project, status, inStatusFor) {
  var url = "https://jira.secondlife.com/rest/api/2/search?jql=";
  return url += `project=${project}+and+status=${status}+and+status+changed+to+${status}+before+-${inStatusFor}d&fields=id,status,key,assignee,summary&maxresults=100`;;
}

// utility
function domify(str) {
  var dom = (new DOMParser()).parseFromString('<!doctype html><body>' + str,'text/html');
  return dom.body.textContent;
}

// utility
function setStatus(message) {
  document.getElementById('status').innerHTML = message;
  document.getElementById('status').hidden = false
}

// Setup for the Ticket Status Query
function createQueryClickHandler() {
    document.getElementById("query").onclick = function() {
      var project = document.getElementById("project").value;
      var status = document.getElementById("statusSelect").value;
      var inStatusFor = document.getElementById("daysPast").value;
      if (!project || !inStatusFor) {
        if (!project) setStatus('ERROR. Please enter a project name.');
        else if (!inStatusFor) setStatus('ERROR. Please set number of days.');
        return;
      } 

      var query = buildJQL(project, status, inStatusFor);
      setStatus('Performing JIRA search for ' + query);
      getQueryResults(query, function(response) {
          setStatus('Query term: ' + query + '\n');

          renderResults(response.issues, function(issue) {
            return issue.key + ": " + issue.fields.summary 
          });

        }, function(errorMessage) {
            setStatus('ERROR. ' + errorMessage);
      });
    }
}

// Setup for the JIRA Activity Query
function createActivityFeedClickHandler() {
    document.getElementById("feed").onclick = function() {   
      // get the xml feed
      getJIRAFeed(function(url, xmlDoc) {
        setStatus('Activity query: ' + url + '\n');

        // render results
        var feed = xmlDoc.getElementsByTagName('feed');
        renderResults(feed[0].getElementsByTagName("entry"), function(entry) {
            var html = entry.getElementsByTagName('title')[0].innerHTML;
            var updated = entry.getElementsByTagName('updated')[0].innerHTML;
            return new Date(updated).toLocaleString() + " - " + domify(html); 
        });
      }, function(errorMessage) {
          setStatus('ERROR. ' + errorMessage);
      });    
    }; 
}

// Setup
document.addEventListener('DOMContentLoaded', function() {
    // if logged in, setup listeners
    checkProjectExists().then(function() {
      
      //load saved options
      loadOptions();

      createQueryClickHandler();
      createActivityFeedClickHandler();

    }).catch(function(errorMessage) {
        setStatus('ERROR. ' + errorMessage);
    });   
});
