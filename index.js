createUserInputForm(getById('userContainer'));

createGroupInputForm(getById('groupContainer'));

createFacetInputForm(getById('urlContainer'), 'url', 'URL of annotated document');

createFacetInputForm(getById('tagContainer'), 'tag', '');

createFacetInputForm(getById('anyContainer'), 'any', 'freetext search');

createFacetInputForm(getById('maxContainer'), 'max', 'max annotations to fetch');

createApiTokenInputForm(getById('tokenContainer'));

["user", "group", "url", "tag", "any"].forEach(function(facet) {
  if (gup(facet) !== "") {
    document.querySelector(`#${facet}Container input`).value = gup(facet);
  }
});

function getCSV() {
  search('csv');
}

function getHTML() {
  search('html');
}

function getJSON() {
  search('json');
}

function search(format) {
  var params = {
    user: document.querySelector("#userContainer input").value,
    group: getSelectedGroup(),
    url: document.querySelector("#urlContainer input").value,
    tag: document.querySelector("#tagContainer input").value,
    any: document.querySelector("#anyContainer input").value,
    max: document.querySelector('#maxContainer input').value,
    format: format,
  };
  document.title =
    "Hypothesis activity for the query " + JSON.stringify(params);
  params = encodeURIComponent(JSON.stringify(params));
  var iframeUrl = `iframe.html?params=${params}`;
  document.getElementById("iframe").setAttribute("src", iframeUrl);
}

function createFacetInputForm(e, facet, msg) {
  var form = `
<div class="formLabel">${facet}</div>
<div class="${facet}Form"><input id="${facet}Form"></input></div>
<div class="formMessage">${msg}</div>`;
  e.innerHTML += form;
}
