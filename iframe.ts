import * as hlib from '../../hlib/hlib' // this will be commented out in the shipping bundle

var params:any = decodeURIComponent(hlib.gup('params'))
params = JSON.parse(params)

var widget = hlib.getById('widget') as HTMLElement
var controlsContainer = hlib.getById('controlsContainer') as HTMLElement

var format = params['format']
delete params['format']

if (format === 'html') {
  controlsContainer.innerHTML = `<button onclick="hlib.expandAll()">expand all</button>
     <button onclick="hlib.collapseAll()">collapse all</button>
     <button onclick="downloadHTML()">download HTML</button>`
} else if (format === 'csv') {
  controlsContainer.innerHTML = '<button onclick="downloadCSV()">download CSV</button>'
} else {
  controlsContainer.innerHTML = '<button onclick="downloadJSON()">download JSON</button>'
}

Object.keys(params).forEach(function (key) {
  if (params[key] === '') {
    delete params[key]
  }
  if (params['group'] && params['group'] === '__world__') {
    delete params['group']
  }
})

hlib.getById('title').innerHTML = `Hypothesis query: ${JSON.stringify(params)} &nbsp; <span id="progress"></span>`

var nonEmptyParams = Object.values(params).filter(x => x != '')
if (nonEmptyParams.length == 0) {
  params.max = 100
}

hlib.search(params, 'progress')
  .then( data => {
    processSearchResults(data[0], data[1])
  })

function exactTagSearch(annos:any[])  {
  if (params.exactTagSearch==='false') {
    return annos
  } else {
    return annos
  }
}

function processSearchResults (annos:any[], replies:any[]) {
  annos = exactTagSearch(annos)
  let csv = ''
  let json:any[] = []
  let gathered = hlib.gatherAnnotationsByUrl(annos)
  let reversedUrls = reverseChronUrls(gathered.urlUpdates)
  let counter = 0
  reversedUrls.forEach(function (url) {
    counter++
    let perUrlCount = gathered.urls[url]
    let idsForUrl:string[] = gathered.ids[url]
    if (format === 'html') {
      showUrlResults(counter, 'widget', url, perUrlCount, gathered.titles[url])
    }    
    idsForUrl.forEach( idForUrl => {
      let _replies = handleSeparateReplies(idForUrl);
      let all = [gathered.annos[idForUrl]].concat(_replies.reverse())
      all.forEach( anno => { 
        let level = params._separate_replies==='false' ? 0 : anno.refs.length
        if (format === 'html') {
          hlib.getById(`cards_counter_${counter}`).innerHTML += hlib.showAnnotation(anno, level)
        } else if (format === 'csv') {
          let _row = document.createElement('div')
          _row.innerHTML = hlib.csvRow(level, anno)
          csv += _row.innerText + '\n'
        } else if (format === 'json') {
          anno.text = anno.text.replace(/</g, '&lt;')
          json.push(anno)
        }
      })
    })
  })

  if (format === 'csv') {
    widget.style.whiteSpace = 'pre'
    widget.style.overflowX = 'scroll'
    widget.innerText = csv
  } else if (format === 'json') {
    widget.style.whiteSpace = 'pre'
    widget.innerText = JSON.stringify(json, null, 2)
  }

  hlib.getById('progress').innerHTML = ''

  setTimeout(function () {
    hlib.collapseAll()
    widget.style.display = 'block'
  }, 500)

  function handleSeparateReplies(idForUrl: string) {
    let _replies = replies;
    if (params._separate_replies === 'true') {
      _replies = hlib.findRepliesForId(idForUrl, replies);
      _replies = _replies.map(r => {
        return hlib.parseAnnotation(r);
      });
    }
    return _replies;
  }
}

function showUrlResults (counter:number, eltId:string, url:string, count:number, doctitle:string):string {
  var headingCounter = `counter_${counter}`
  var output = `<h1 id="heading_${headingCounter}" class="urlHeading">
    <a title="collapse" href="javascript:hlib.toggle('${headingCounter}')"> <span class="toggle">-</span></a>
    <span class="counter">&nbsp;${count}&nbsp;</span>
    <a title="visit annotated page" target="annotatedPage" href="https://hyp.is/go?url=${url}">${doctitle}</a> 
    </h1>
    <div id="cards_${headingCounter}"></div>`
  hlib.getById(eltId).innerHTML += output
}

function reverseChronUrls (urlUpdates:any) {
  var reverseChronUrls = []
  for (var urlUpdate in urlUpdates) { // sort urls in reverse chron of recent update
    reverseChronUrls.push([urlUpdate, urlUpdates[urlUpdate]])
  }
  reverseChronUrls.sort(function (a:string[], b:string[]) {
    return new Date(b[1]).getTime() - new Date(a[1]).getTime()
  })
  return reverseChronUrls.map(item => item[0])
}

function downloadHTML () {
  var html = `
<html>
${document.head.outerHTML}
${document.body.outerHTML}
</html>`
  hlib.download(html, 'html')
}

function downloadCSV () {
  var csvOutput = '"level","updated","url","user","id","group","tags","quote","text","direct link"\n'
  csvOutput += widget.innerText
  hlib.download(csvOutput, 'csv')
}

function downloadJSON () {
  var jsonOutput = '[' + widget.innerText + ']'
  hlib.download(jsonOutput, 'json')
}
