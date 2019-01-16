// import * as hlib from '../../hlib/hlib'; // this will be commented out in the shipping bundle
var worker = new Worker('showAnnotation.js');
worker.addEventListener('message', function (e) {
    try {
        var elt = hlib.getById(`cards_counter_${e.data.id}`);
        elt.innerHTML += e.data.output;
    }
    catch (e) {
        console.log(e);
    }
});
var params = decodeURIComponent(hlib.gup('params'));
params = JSON.parse(params);
var widget = hlib.getById('widget');
var controlsContainer = hlib.getById('controlsContainer');
var format = params['format'];
delete params['format'];
if (format === 'html') {
    controlsContainer.innerHTML = `<button onclick="hlib.expandAll()">expand all</button>
     <button onclick="hlib.collapseAll()">collapse all</button>
     <button onclick="downloadHTML()">download HTML</button>`;
}
else if (format === 'csv') {
    controlsContainer.innerHTML = '<button onclick="downloadCSV()">download CSV</button>';
}
else {
    controlsContainer.innerHTML = '<button onclick="downloadJSON()">download JSON</button>';
}
Object.keys(params).forEach(function (key) {
    if (params[key] === '') {
        delete params[key];
    }
    if (params['group'] && params['group'] === '__world__') {
        delete params['group'];
    }
});
hlib.getById('title').innerHTML = `Hypothesis query: ${JSON.stringify(params)} &nbsp; <span id="progress"></span>`;
var nonEmptyParams = Object.values(params).filter(x => x != '');
if (nonEmptyParams.length == 0) {
    params.max = 100;
}
hlib.search(params, 'progress')
    .then(data => {
    processSearchResults(data[0], data[1]);
});
function processSearchResults(annos, replies) {
    let csv = '';
    let json = [];
    let gathered = hlib.gatherAnnotationsByUrl(annos);
    let reversedUrls = reverseChronUrls(gathered.urlUpdates);
    let counter = 0;
    reversedUrls.forEach(function (url) {
        counter++;
        let perUrlId = counter;
        let perUrlCount = 0;
        let idsForUrl = gathered.ids[url];
        idsForUrl.forEach(function (id) {
            perUrlCount++;
            let _replies = replies;
            if (params._separate_replies === 'true') {
                _replies = hlib.findRepliesForId(id, replies);
                _replies = _replies.map(r => {
                    return hlib.parseAnnotation(r);
                });
            }
            let all = [gathered.annos[id]].concat(_replies.reverse());
            all.forEach(function (anno) {
                let level = 0;
                if (anno.refs) {
                    level = anno.refs.length;
                }
                if (format === 'html') {
                    worker.postMessage({
                        perUrlId: perUrlId,
                        anno: anno,
                        annoId: anno.id,
                        level: level
                    });
                }
                else if (format === 'csv') {
                    let _row = document.createElement('div');
                    _row.innerHTML = hlib.csvRow(level, anno);
                    csv += _row.innerText + '\n';
                }
                else if (format === 'json') {
                    anno.text = anno.text.replace(/</g, '&lt;');
                    json.push(anno);
                }
            });
        });
        if (format === 'html') {
            showUrlResults(counter, 'widget', url, perUrlCount, gathered.titles[url]);
        }
    });
    if (format === 'csv') {
        widget.style.whiteSpace = 'pre';
        widget.style.overflowX = 'scroll';
        widget.innerText = csv;
    }
    else if (format === 'json') {
        widget.style.whiteSpace = 'pre';
        widget.innerText = JSON.stringify(json, null, 2);
    }
    hlib.getById('progress').innerHTML = '';
    setTimeout(function () {
        hlib.collapseAll();
        widget.style.display = 'block';
    }, 500);
}
function showUrlResults(counter, eltId, url, count, doctitle) {
    var urlResultsId = `counter_${counter}`;
    var output = `<h1 id="heading_${urlResultsId}" class="urlHeading">
    <a title="collapse" href="javascript:hlib.toggle('${urlResultsId}')"> <span class="toggle">-</span></a>
    <span class="counter">&nbsp;${count}&nbsp;</span>
   <a title="visit annotated page" target="annotatedPage" href="https://hyp.is/go?url=${url}">${doctitle}</a> 
   </h1>
   <div id="cards_${urlResultsId}">
   </div>`;
    hlib.getById(eltId).innerHTML += output;
}
function reverseChronUrls(urlUpdates) {
    var reverseChronUrls = [];
    for (var urlUpdate in urlUpdates) {
        reverseChronUrls.push([urlUpdate, urlUpdates[urlUpdate]]);
    }
    reverseChronUrls.sort(function (a, b) {
        return new Date(b[1]).getTime() - new Date(a[1]).getTime();
    });
    return reverseChronUrls.map(item => item[0]);
}
function downloadHTML() {
    var html = `
<html>
${document.head.outerHTML}
${document.body.outerHTML}
</html>`;
    hlib.download(html, 'html');
}
function downloadCSV() {
    var csvOutput = '"level","updated","url","user","id","group","tags","quote","text","direct link"\n';
    csvOutput += widget.innerText;
    hlib.download(csvOutput, 'csv');
}
function downloadJSON() {
    var jsonOutput = '[' + widget.innerText + ']';
    hlib.download(jsonOutput, 'json');
}
