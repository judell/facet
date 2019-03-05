import * as hlib from '../../hlib/hlib' // this will be commented out in the shipping bundle

let params:any = decodeURIComponent(hlib.gup('params'))
params = JSON.parse(params)

const widget = hlib.getById('widget') as HTMLElement
const controlsContainer = hlib.getById('controlsContainer') as HTMLElement

const format = params['format']
delete params['format']

let htmlBuffer = ''

const subjectUserTokens = hlib.getSubjectUserTokensFromLocalStorage()

Object.keys(params).forEach(function (key) {
  if (params[key] === '') {
    delete params[key]
  }
  if (params['group'] && params['group'] === 'all') {
    delete params['group']
  }
})

showParams()

hlib.getById('progress').innerText = 'fetching annotations '
hlib.search(params, 'progress')
  .then( data => {
    processSearchResults(data[0], data[1])
  })

function showParams() {
  const excluded = ['service', 'subjectUserTokens', '_separate_replies']
  if (params.max == hlib.defaultMax) {
    excluded.push('max')
  }
  ['searchReplies', 'exactTagSearch', 'expanded'].forEach(key => {
    if (params[key] === 'false') {
      excluded.push(key)
    }
  })
  let title = hlib.syntaxColorParams(params, excluded)
  title = title.slice(0, -1)
  if (title) {
    hlib.getById('title').innerHTML += title
  } else {
    hlib.getById('title').style.dispay = 'none'
  }
}

function exactTagSearch(annos:any[])  {
  if (params.exactTagSearch==='false') {
    return annos
  }
  if (!params.tag) {
    return annos
  }
  const checkedAnnos:any[] = []
  const queryTag = params.tag
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
  const json:any[] = []
  const gathered = hlib.gatherAnnotationsByUrl(annos)
  const reversedUrls = reverseChronUrls(gathered.urlUpdates)
  let counter = 0
  
  reversedUrls.forEach(url => {
    renderCardsForUrl(url)
  })

  styleWidget(csv, json)

  showButtons()

  if (format === 'html') {
    const expanded = isExpanded()
    if (expanded) {
      setExpanderCollapse()
      hlib.getById('expander').click()
    } else {
      hlib.collapseAll()
    }
  }

  
  widget.style.display = 'block'
  hlib.getById('progress').innerHTML = ''

  function renderCardsForUrl(url: any) {
    counter++
    const perUrlCount = gathered.urls[url]
    const idsForUrl: string[] = gathered.ids[url]
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

  function styleWidget(csv: string, json: any[]) {
    if (format === 'html') {
      hlib.getById('widget').innerHTML = htmlBuffer
    }
    else if (format === 'csv') {
      widget.style.whiteSpace = 'pre'
      widget.style.overflowX = 'scroll'
      widget.innerText = csv
    }
    else if (format === 'json') {
      widget.style.whiteSpace = 'pre'
      widget.innerText = JSON.stringify(json, null, 2)
    }
  }
  
  function showUrlResults (counter:number, eltId:string, url:string, count:number, doctitle:string):string {
    const headingCounter = `counter_${counter}`
    const togglerTitle = isExpanded() ? 'collapse' : 'expand'
    const togglerChar = isExpanded() ?  '\u{25bc}' : '\u{25b6}'
    const output = `<h1 id="heading_${headingCounter}" class="urlHeading">
      <a title="${togglerTitle}" href="javascript:hlib.toggle('${headingCounter}')"> <span class="toggle">${togglerChar}</span></a>
      <span class="counter">&nbsp;${count}&nbsp;</span>
      <a title="visit annotated page" target="annotatedPage" href="https://hyp.is/go?url=${url}">${doctitle}</a> 
      </h1>
      <div id="cards_${headingCounter}">
        CARDS_${counter}
      </div>`
    return output
  }
  
  function reverseChronUrls (urlUpdates:any) {
    const reverseChronUrls = []
    for (const urlUpdate in urlUpdates) { // sort urls in reverse chron of recent update
      reverseChronUrls.push([urlUpdate, urlUpdates[urlUpdate]])
    }
    reverseChronUrls.sort(function (a:string[], b:string[]) {
      return new Date(b[1]).getTime() - new Date(a[1]).getTime()
    })
    return reverseChronUrls.map(item => item[0])
  }
}

function isExpanded() {
  return hlib.getSettings().expanded === 'true'
}

function setExpanderExpand() {
  const expander = hlib.getById('expander')
  expander.onclick = setExpanderCollapse
  expander.innerText = 'collapse'
  hlib.expandAll()
}

function setExpanderCollapse() {
  const expander = hlib.getById('expander')
  expander.onclick = setExpanderExpand
  expander.innerText = 'expand'
  hlib.collapseAll()
}

function showButtons() {
  if (format === 'html') {
    controlsContainer.innerHTML = `
      <button class="expander" id="expander"></button>
      <button id="downloadHTML">downloadHTML</button>`
    const expander = hlib.getById('expander') as HTMLButtonElement
    const expanded = hlib.getSettings().expanded === 'true'
    expander.onclick = expanded
      ? setExpanderCollapse
      : setExpanderExpand
    if (expanded) {
      expander.innerText = 'collapse'
    } else {
      expander.innerText = 'expand'
    }
    hlib.getById('downloadHTML').onclick = downloadHTML
  }
  else if (format === 'csv') {
    controlsContainer.innerHTML = '<button id="downloadCSV">download CSV</button>'
    hlib.getById('downloadCSV').onclick = downloadCSV
  }
  else {
    controlsContainer.innerHTML = '<button id="downloadJSON">download JSON</button>'
    hlib.getById('downloadJSON').onclick = downloadJSON
    hlib.getById
  }
}

function downloadHTML () {
  function rebaseLinks(links: NodeListOf<HTMLAnchorElement>) {
    links.forEach(link => {
      link.href = link.href
    })
  }
  const head = document.head
  const body = document.body
  const controlsContainer = body.querySelector('#controlsContainer') as HTMLElement
  controlsContainer.remove()
  const pencils = body.querySelectorAll('.icon-pencil')
  pencils.forEach(pencil => { pencil.remove() })
  rebaseLinks(body.querySelectorAll('.user a'))
  rebaseLinks(body.querySelectorAll('.annotationTags a'))
  const html = `<html>${head.outerHTML}${body.outerHTML}</html>`
  hlib.download(html, 'html')
  body.innerHTML = 'done'
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
  const cardElements = cardsElement.querySelectorAll('.annotationCard')
  for (let i = 0; i < cardElements.length; i++ ) {
    const cardElement = cardElements[i]
    let userElement = cardElement.querySelector('.user') as HTMLElement
    const username = userElement.innerText.trim()
    let textElement = cardElement.querySelector('.annotationText') as HTMLElement
    // create wrapper container
    const wrapper = document.createElement('div')
    wrapper.setAttribute('class', 'textEditor')
    let display
    if (subjectUserTokens.hasOwnProperty(username)) {
      display = 'block'
    } 
    wrapper.innerHTML = `
      <div onclick="makeHtmlContentEditable('${cardElement.id}')" class="editOrSaveIcon">
          <svg style="display:${display}" class="icon-pencil"><use xlink:href="#icon-pencil"></use></svg>
      </div>`
    textElement.parentNode!.insertBefore(wrapper, textElement)
    // move elmement into wrapper
    wrapper.appendChild(textElement)
  }
  return cardsElement.outerHTML
}

async function makeHtmlContentEditable(annoId:string) {
  const editor = document.querySelector(`#${annoId} .textEditor`) as HTMLElement
  editor.setAttribute('contentEditable','true')
  const textElement = editor.querySelector('.annotationText') as HTMLElement
  const r = await hlib.getAnnotation(annoId.replace(/^_/,''), hlib.getToken())
  const text = JSON.parse(r.response).text
  textElement.innerText = text
  const iconContainer = editor.querySelector('.icon-pencil') as HTMLElement
  iconContainer.innerHTML = renderIcon('icon-floppy')
  iconContainer.onclick = saveHtmlFromContentEditable
  editor.style.setProperty('margin-top', '16px')
  editor.style.setProperty('margin-bottom', '16px')
  editor.style.setProperty('background-color', '#f1eeea')
}

async function saveHtmlFromContentEditable(e:Event) {
  const annoId = this.closest('.annotationCard').getAttribute('id').replace(/^_/,'')
  const userElement = this.closest('.annotationCard').querySelector('.user')
  const username = userElement.innerText.trim() 
  const body = this.closest('.annotationBody')
  const annotationText = body.querySelector('.annotationText')
  let text = annotationText.innerText
  this.closest('.textEditor').removeAttribute('contentEditable') // using `noImplicitThis` setting to silence ts complaint
  this.parentElement.innerHTML = renderIcon('icon-pencil')
  this.onclick = makeHtmlContentEditable
  e.stopPropagation()
  const payload = JSON.stringify( { text: text } )
  const token = subjectUserTokens[username]
  const r = await hlib.updateAnnotation(annoId, token, payload)
  let updatedText = JSON.parse(r.response).text
  if ( updatedText !== text) {
    alert (`unable to update, ${r.response}`)
  }
  const converter = new showdown.Converter()
  const html = converter.makeHtml(text)
  annotationText.innerHTML = html
  body.querySelector('.icon-pencil').style.display = 'block'
  body.querySelector('.textEditor').style.setProperty('margin-top', '0')
  const editor = body.querySelector('.textEditor')
  editor.style.setProperty('margin-top', '0')
  editor.style.setProperty('margin-bottom', '0')
  editor.style.removeProperty('background-color')
}

function renderIcon(iconClass:string) {
return `<svg class="${iconClass}"><use xlink:href="#${iconClass}"></use></svg>`
}

