import * as hlib from '../../hlib/hlib' // this will be commented out in the shipping bundle

let params:any = decodeURIComponent(hlib.gup('params'))
params = JSON.parse(params)

let widget = hlib.getById('widget') as HTMLElement
let controlsContainer = hlib.getById('controlsContainer') as HTMLElement

const format = params['format']
delete params['format']

let htmlBuffer = ''

const _subjectUserTokens = localStorage.getItem('h_subjectUsers')
let subjectUserTokens = {} as string[]
if (_subjectUserTokens) {
  subjectUserTokens = JSON.parse(_subjectUserTokens) 
}

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
  if (params['group'] && params['group'] === 'all') {
    delete params['group']
  }
})

hlib.getById('title').innerHTML += `${JSON.stringify(params)}`

const nonEmptyParams = Object.values(params).filter(x => x != '')
if (nonEmptyParams.length == 0) {
  params.max = 100
}

hlib.getById('progress').innerText = 'fetching annotations '
hlib.search(params, 'progress')
  .then( data => {
    processSearchResults(data[0], data[1])
  })

function exactTagSearch(annos:any[])  {
  if (params.exactTagSearch==='false') {
    return annos
  }
  if (!params.tag) {
    return annos
  }
  let checkedAnnos:any[] = []
  let queryTag = params.tag
  annos.forEach(anno => {
    if (anno.tags.indexOf(queryTag) != -1) {
      checkedAnnos.push(anno)
    }
  })
  return checkedAnnos
}

function processSearchResults (annos:any[], replies:any[]) {
  if ( annos.length == 0 && replies.length == 0 ) {
    hlib.getById('progress').innerText = ''
    hlib.getById('widget').innerHTML = `
      <p>Nothing found for this query. 
      <p>Please try removing or altering one or more filters. 
      <p>If you still find nothing, try ticking <i>search replies</i>.
      `
    hlib.getById('widget').style.display= 'block'
    return 
  }
  annos = exactTagSearch(annos)
  let csv = ''
  let json:any[] = []
  let gathered = hlib.gatherAnnotationsByUrl(annos)
  let reversedUrls = reverseChronUrls(gathered.urlUpdates)
  let counter = 0
  
  reversedUrls.forEach(url => {
    renderCardsForUrl(url)
  })

  if (format === 'html') {
    hlib.getById('widget').innerHTML = htmlBuffer
  } else if (format === 'csv') {
    widget.style.whiteSpace = 'pre'
    widget.style.overflowX = 'scroll'
    widget.innerText = csv
  } else if (format === 'json') {
    widget.style.whiteSpace = 'pre'
    widget.innerText = JSON.stringify(json, null, 2)
  } 

  if (! params.expand) {
    hlib.collapseAll()
  }
  widget.style.display = 'block'
  hlib.getById('progress').innerHTML = ''

  function renderCardsForUrl(url: any) {
    counter++
    let perUrlCount = gathered.urls[url]
    let idsForUrl: string[] = gathered.ids[url]
    if (format === 'html') {
      htmlBuffer += showUrlResults(counter, 'widget', url, perUrlCount, gathered.titles[url])
    }
    let cardsHTMLBuffer = ''
    idsForUrl.forEach(idForUrl => {
      let _replies = handleSeparateReplies(idForUrl)
      let all = [gathered.annos[idForUrl]].concat(_replies.reverse())
      all.forEach(anno => {
        let level = params._separate_replies === 'false' ? 0 : anno.refs.length
        if (format === 'html') {
          let cardsHTML = hlib.showAnnotation(anno, level)
          cardsHTML = enableEditing(cardsHTML)
          cardsHTMLBuffer += cardsHTML
        }
        else if (format === 'csv') {
          let _row = document.createElement('div')
          _row.innerHTML = hlib.csvRow(level, anno)
          csv += _row.innerText + '\n'
        }
        else if (format === 'json') {
          anno.text = anno.text.replace(/</g, '&lt')
          json.push(anno)
        }
      })
    })
    htmlBuffer = htmlBuffer.replace(`CARDS_${counter}`, cardsHTMLBuffer)
  }

  function handleSeparateReplies(idForUrl: string) {
    let _replies = replies
    if (params._separate_replies === 'true') {
      _replies = hlib.findRepliesForId(idForUrl, replies)
      _replies = _replies.map(r => {
        return hlib.parseAnnotation(r)
      })
    }
    return _replies
  }
}

function showUrlResults (counter:number, eltId:string, url:string, count:number, doctitle:string):string {
  const headingCounter = `counter_${counter}`
  let output = `<h1 id="heading_${headingCounter}" class="urlHeading">
    <a title="collapse" href="javascript:hlib.toggle('${headingCounter}')"> <span class="toggle">\u{25bc}</span></a>
    <span class="counter">&nbsp;${count}&nbsp;</span>
    <a title="visit annotated page" target="annotatedPage" href="https://hyp.is/go?url=${url}">${doctitle}</a> 
    </h1>
    <div id="cards_${headingCounter}">
      CARDS_${counter}
    </div>`
  return output
}

function reverseChronUrls (urlUpdates:any) {
  let reverseChronUrls = []
  for (let urlUpdate in urlUpdates) { // sort urls in reverse chron of recent update
    reverseChronUrls.push([urlUpdate, urlUpdates[urlUpdate]])
  }
  reverseChronUrls.sort(function (a:string[], b:string[]) {
    return new Date(b[1]).getTime() - new Date(a[1]).getTime()
  })
  return reverseChronUrls.map(item => item[0])
}

function downloadHTML () {
  const html = `
<html>
${document.head.outerHTML}
${document.body.outerHTML}
</html>`
  hlib.download(html, 'html')
}

function downloadCSV () {
  let csvOutput = '"level","updated","url","user","id","group","tags","quote","text","direct link"\n'
  csvOutput += widget.innerText
  hlib.download(csvOutput, 'csv')
}

function downloadJSON () {
  const jsonOutput = '[' + widget.innerText + ']'
  hlib.download(jsonOutput, 'json')
}

function enableEditing(cardsHTML:string) {
  const cardsElement = document.createElement('div')
  cardsElement.innerHTML = cardsHTML
  let cardElements = cardsElement.querySelectorAll('.annotationCard')
  for (let i = 0; i < cardElements.length; i++ ) {
    let cardElement = cardElements[i]
    let userElement
    userElement! = cardElement.querySelector('.user')
    let username = userElement.innerText.trim()
    let textElement
    textElement! = cardElement.querySelector('.annotationText') 
    // create wrapper container
    let wrapper = document.createElement('div')
    wrapper.setAttribute('class', 'textEditor')
    let display
    if (subjectUserTokens.hasOwnProperty(username)) {
      display = 'block'
    } 
    wrapper.innerHTML = `
      <div onclick="makeHtmlContentEditable('${cardElement.id}')" class="editOrSaveIcon">
          <svg style="display:${display}" class="icon-pencil"><use xlink:href="#icon-pencil"></use></svg>
      </div>`
    textElement.parentNode.insertBefore(wrapper, textElement)
    // move elmement into wrapper
    wrapper.appendChild(textElement)
  }
  return cardsElement.outerHTML
}

function makeHtmlContentEditable(annoId:string) {
  let editor = document.querySelector(`#${annoId} .textEditor`) as HTMLElement
  editor.setAttribute('contentEditable','true')
  let text = editor.querySelector('.annotationText') as HTMLElement
  text.setAttribute('class', text.getAttribute('class') + ' preformatted')
  text.innerHTML = text.innerHTML.replace(/</g, '&lt;') 
  let iconContainer = editor.querySelector('.icon-pencil') as HTMLElement
  iconContainer.innerHTML = renderIcon('icon-floppy')
  iconContainer.onclick = saveHtmlFromContentEditable
}

async function saveHtmlFromContentEditable(e:Event) {
  let annoId = this.closest('.annotationCard').getAttribute('id').replace(/^_/,'')
  let userElement = this.closest('.annotationCard').querySelector('.user')
  let username = userElement.innerText.trim() 
  let body = this.closest('.annotationBody')
  let editor = body.querySelector('.annotationText')
  editor.setAttribute('class', 'annotationText')
  let text = editor.innerHTML
  text = text.replace(/&lt;/g, '<')
  text = text.replace(/&gt;/g, '>')
  this.closest('.textEditor').removeAttribute('contentEditable') // using `noImplicitThis` setting to silence ts complaint
  this.parentElement.innerHTML = renderIcon('icon-pencil')
  this.onclick = makeHtmlContentEditable
  e.stopPropagation()
  let payload = JSON.stringify( { text: text } )
  let token = subjectUserTokens[username]
  const r = await hlib.updateAnnotation(annoId, token, payload)
  let updatedText = JSON.parse(r.response).text
  if ( updatedText !== text) {
    alert (`unable to update, ${r.response}`)
  }
  let converter = new showdown.Converter()
  let html = converter.makeHtml(text)
  body.querySelector('.annotationText').innerHTML = html
  body.querySelector('.icon-pencil').style.display = 'block'
}

function renderIcon(iconClass:string) {
return `<svg class="${iconClass}"><use xlink:href="#${iconClass}"></use></svg>`
}

