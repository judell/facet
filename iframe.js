var worker = new Worker('showAnnotation.js');
worker.addEventListener('message', function (e) {
  try {
    var elt = getById(`cards${e.data.id}`);
    elt.innerHTML += e.data.output;
  }
  catch (e) {
    console.log(e);
  }
});

var params = decodeURIComponent(gup('params'));
params = JSON.parse(params);

Object.keys(params).forEach(function(key) {
  if (params[key] === '' ) {
    delete params[key];
  }
})

document.getElementById('title').innerHTML =
      `Hypothesis query: ${JSON.stringify(params)} &nbsp; <span id="progress"></span>`;

var nonEmptyParams = Object.values(params).filter(x => x != '');
if (nonEmptyParams.length == 0) {
  params.max = 400;
}

hApiSearch(params, processSearchResults, 'progress');

function processSearchResults(annos, replies) {
  var gathered = gatherAnnotationsByUrl(annos);
  var reversedUrls = reverseChronUrls(gathered.urlUpdates);
  var counter = 0;
  reversedUrls.forEach(function (url) {
    counter++;
    var perUrlCards = document.createElement('div');
    perUrlCards.id = `_counter_${counter}`;
    document.body.appendChild(perUrlCards);
    var perUrlCount = 0;
    var idsForUrl = gathered.ids[url];
    idsForUrl.forEach(function (id) {
      perUrlCount++;
      var _replies = findRepliesForId(id, replies);
      var all = [gathered.annos[id]].concat(_replies);
      all.forEach(function (anno) {
        var level = 0;
        if (anno.refs) {
          level = anno.refs.length;
        }
        worker.postMessage({
          cardId: perUrlCards.id,
          anno: anno,
          annoId: anno.id,
          level: level,
        })
      });
    });
    showUrlResults(counter, 'widget', url, perUrlCount, gathered.titles[url]);
    perUrlCards.remove();
  });

  getById('progress').innerHTML = '';

  setTimeout(function () {
    collapseAll();
    getById('widget').style.display = 'block';
  }, 500)
}

function showUrlResults(counter, eltId, url, count, doctitle) {
  var urlResultsId = `counter_${counter}`;

  var output =
        `
<h1 id="heading_${urlResultsId}" class="urlHeading">

<a title="collapse" href="javascript:toggle('${urlResultsId}')"> <span class="toggle">-</span></a>

<span class="counter">&nbsp;${count}&nbsp;</span>

<a title="visit annotated page" target="annotatedPage" href="https://hyp.is/go?url=${url}">${doctitle}</a> 
</h1>
<div id="cards_${urlResultsId}">
</div>
`;
  getById(eltId).innerHTML += output;
}

function reverseChronUrls(urlUpdates) {
  var reverseChronUrls = [];
  for (var urlUpdate in urlUpdates) // sort urls in reverse chron of recent update
    reverseChronUrls.push([urlUpdate, urlUpdates[urlUpdate]]);
  reverseChronUrls.sort(function (a, b) {
    return new Date(b[1]) - new Date(a[1])
  });
  return reverseChronUrls.map(item => item[0]);
}

function downloadHTML() {
  var html = `
<html>
${document.head.outerHTML}
${document.body.outerHTML}
</html>`;
  download(html, 'html');
}

function downloadCSV() {
  var csvOutput = '"level","updated","url","user","id","group","tags","quote","text"\n';
  var rows = document.querySelectorAll('.csvRow');
  rows.forEach(function (row) {
    csvOutput += `${row.innerText}\n`;
  });
  download(csvOutput, 'csv');
}

function downloadText() {
  var text = document.body.innerText;
  download(text, 'txt');
}

function download(text, type) {
  var a = document.createElement('a');
  a.href = 'data:attachment/' + type + ',' + encodeURIComponent(text);
  a.target = '_blank';
  a.download = 'hypothesis.' + type;
  document.body.appendChild(a);
  a.click();
}

function collapseAll() {
  var togglers = document.querySelectorAll('.urlHeading .toggle');
  togglers.forEach(function (toggler) {
    setToggleControlCollapse(toggler);
  });
  var cards = document.querySelectorAll('.annotationCard');
  hideCards(cards);
}

function expandAll() {
  var togglers = document.querySelectorAll('.urlHeading .toggle');
  togglers.forEach(function (toggler) {
    setToggleControlExpand(toggler);
  });
  var cards = document.querySelectorAll('.annotationCard');
  showCards(cards);
}

function setToggleControlCollapse(toggler) {
  toggler.innerText = '\u25b6';
  toggler.title = 'expand';
}

function setToggleControlExpand(toggler) {
  toggler.innerText = '\u25bc';
  toggler.title = 'collapse';
}

function showCards(cards) {
  for (var i = 0; i < cards.length; i++) {
    cards[i].style.display = 'block';
  }
}

function hideCards(cards) {
  for (var i = 0; i < cards.length; i++) {
    cards[i].style.display = 'none';
  }
}

function toggle(id) {
  var heading = getById('heading_' + id);
  var toggler = heading.querySelector('.toggle');

  var cardsId = `cards_${id}`;
  var selector = `#${cardsId} .annotationCard`;
  var perUrlCards = document.querySelectorAll(selector);
  var cardsDisplay = perUrlCards[0].style.display;

  if (cardsDisplay === 'block') {
    setToggleControlCollapse(toggler);
    hideCards(perUrlCards);
  } else {
    setToggleControlExpand(toggler);
    showCards(perUrlCards);
  }
}