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
    hlib.getById('title').style.display = 'none'
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
    const cardElement = cardElements[i] as HTMLElement
    let userElement = cardElement.querySelector('.user') as HTMLElement
    maybeCreateDeleteButton(userElement, cardElement)
    maybeCreateTextEditor(userElement, cardElement)
    maybeCreateTagEditor(userElement, cardElement)
  }
  return cardsElement.innerHTML

  function maybeCreateDeleteButton(userElement: HTMLElement, cardElement: HTMLElement) {
    const username = getUserName(userElement)
    const deleteButton = document.createElement('span')
    deleteButton.setAttribute('class', 'deleteButton')
    if (subjectUserTokens.hasOwnProperty(username)) {
      deleteButton.innerHTML = `<a title="delete annotation" onclick="deleteAnnotation('${cardElement.id}')">&nbsp;X</a>`
    } else {
      deleteButton.innerHTML = ``
    }
    const externalLink = cardElement.querySelector('.externalLink') as HTMLAnchorElement
    userElement.parentNode!.insertBefore(deleteButton, externalLink.nextSibling)
  }

  function maybeCreateEditor(username: string, cardId: string, targetElement:HTMLElement, editFunctionName: string) {
    const editorContainer = document.createElement('div')
    editorContainer.setAttribute('class', 'textEditor')
    if (subjectUserTokens.hasOwnProperty(username)) {
      editorContainer.innerHTML = `
        <div onclick="${editFunctionName}('${cardId}')" class="editOrSaveIcon">
          ${renderIcon('icon-pencil')}
        </div>`;
      targetElement.parentNode!.insertBefore(editorContainer, targetElement);
      editorContainer.appendChild(targetElement)
    }
  }
  
  function maybeCreateTextEditor(userElement: HTMLElement, cardElement: HTMLElement) {
    const username = getUserName(userElement)
    let targetElement = cardElement.querySelector('.annotationText') as HTMLElement;
    const editFunctionName = 'makeHtmlContentEditable'
    maybeCreateEditor(username, cardElement.id, targetElement, editFunctionName)
  }

  function maybeCreateTagEditor(userElement: HTMLElement, cardElement: HTMLElement) {
    const username = getUserName(userElement)
    let tagsElement = cardElement.querySelector('.annotationTags') as HTMLElement;
    const editorContainer = document.createElement('div')
    editorContainer.setAttribute('class', 'tagEditor')
    if (subjectUserTokens.hasOwnProperty(username)) {
      editorContainer.innerHTML = `
        <div onclick="makeTagsEditable('${cardElement.id}')" class="editOrSaveIcon">
          ${renderIcon('icon-pencil')}
        </div>`;
      tagsElement.parentNode!.insertBefore(editorContainer, tagsElement);
      editorContainer.appendChild(tagsElement)
    }
  }  
}

async function makeHtmlContentEditable(domAnnoId:string) {
  const annoId = annoIdFromDomAnnoId(domAnnoId)
  const editor = document.querySelector(`#${domAnnoId} .textEditor`) as HTMLElement
  const header = document.querySelector(`#${domAnnoId} .annotationHeader`) as HTMLElement
  header.style.setProperty('margin-bottom','16px')
  const textElement = editor.querySelector('.annotationText') as HTMLElement
  const r = await hlib.getAnnotation(annoId, hlib.getToken())
  const text = JSON.parse(r.response).text
  textElement.innerText = text
  const iconContainer = editor.querySelector('.editOrSaveIcon') as HTMLElement
  iconContainer.innerHTML = renderIcon('icon-floppy')
  iconContainer.onclick = saveHtmlFromContentEditable
  editor.style.setProperty('background-color', '#f1eeea')
  editor.setAttribute('contentEditable','true')
}

async function saveHtmlFromContentEditable(e:Event) {
  const domAnnoId = this.closest('.annotationCard').getAttribute('id')
  const annoId = annoIdFromDomAnnoId(domAnnoId)
  const userElement = this.closest('.annotationCard').querySelector('.user')
  const username = userElement.innerText.trim() 
  const body = this.closest('.annotationBody')
  const annotationText = body.querySelector('.annotationText')
  let text = annotationText.innerText
  this.closest('.textEditor').removeAttribute('contentEditable') // using `noImplicitThis` setting to silence ts complaint
  this.innerHTML = renderIcon('icon-pencil')
  this.onclick = wrappedMakeHtmlContentEditable
  const payload = JSON.stringify( { text: text } )
  const token = subjectUserTokens[username]
  const r = await hlib.updateAnnotation(annoId, token, payload)
  let updatedText = JSON.parse(r.response).text
  if ( updatedText !== text) {
    alert (`unable to update, ${r.response}`)
  }
  
  convertToHtml()

  const cardElement = hlib.getById(domAnnoId) as HTMLElement
  const header = cardElement.querySelector('.annotationHeader') as HTMLElement
  header.style.setProperty('margin-bottom', '0')
  const editor = body.querySelector('.textEditor')
  editor.style.removeProperty('background-color'); 

  function wrappedMakeHtmlContentEditable() {
    return makeHtmlContentEditable(domAnnoId)
  }

  function convertToHtml() {
    const converter = new showdown.Converter();
    const html = converter.makeHtml(text);
    annotationText.innerHTML = html;
  }
}

async function makeTagsEditable(domAnnoId: string) {
  const annoId = annoIdFromDomAnnoId(domAnnoId)
  const editor = document.querySelector(`#${domAnnoId} .tagEditor`) as HTMLElement
  const controlledTags:string[] = hlib.getControlledTagsFromLocalStorage().split(',')
  const tagsElement = editor.querySelector('.annotationTags') as HTMLElement
  const select = document.createElement('select') as HTMLSelectElement
  const r = await hlib.getAnnotation(annoId, hlib.getToken())  
  const existingTags = JSON.parse(r.response).tags
  let existingTag:string = ''
  if (existingTags.length) {
    existingTag = existingTags[0]
  }
  for (let i = 0; i < controlledTags.length; i++ {
    let controlledTag = controlledTags[i]
    let option = document.createElement('option') as HTMLOptionElement
    controlledTag = controlledTag.trim()
    option.value = controlledTag
    option.innerText = controlledTag
    if (existingTag === controlledTag) {
      option.setAttribute('selected', 'true')
    }
    select.options.add(option)
  }
  const anchors = tagsElement.querySelectorAll('a') as NodeListOf<HTMLAnchorElement>
  if (anchors.length) {
    const firstAnchor = anchors[0] as HTMLAnchorElement
    firstAnchor.parentNode.replaceChild(select, firstAnchor)
  } else {
    tagsElement.appendChild(select)
  }

  for (let i = 1; i < anchors.length; i++) {
    let input = document.createElement('input') as HTMLInputElement
    input.value = anchors[i].innerText
    input.style.width = '6em'
    anchors[i].parentNode.replaceChild(input, anchors[i])
  }

  const iconContainer = editor.querySelector('.editOrSaveIcon') as HTMLElement
  iconContainer.innerHTML = renderIcon('icon-floppy')
  iconContainer.onclick = saveControlledTag
}

async function saveControlledTag(e:Event) {
  const domAnnoId = this.closest('.annotationCard').getAttribute('id')
  const annoId = annoIdFromDomAnnoId(domAnnoId)
  const userElement = this.closest('.annotationCard').querySelector('.user')
  const username = userElement.innerText.trim() 
  const body = this.closest('.annotationBody')
  const select = body.querySelector('.annotationTags select') as HTMLSelectElement
  const selected = select[select.selectedIndex] as HTMLOptionElement
  const tags = [ selected.value ]
  let newTags = [ selected.value ]
  const inputs = body.querySelectorAll('input') as NodeListOf<HTMLInputElement>
  inputs.forEach(input => {
    newTags.push(input.value)
  })
  this.innerHTML = renderIcon('icon-pencil')
  this.onclick = wrappedMakeTagsEditable
  const payload = JSON.stringify( { tags: newTags } )
  const token = subjectUserTokens[username]
  const r2 = await hlib.updateAnnotation(annoId, token, payload)
  let updatedTags = JSON.parse(r2.response).tags
  if ( JSON.stringify(updatedTags) !== JSON.stringify(newTags) ) {
    alert (`unable to update, ${r2.response}`)
  }
  body.querySelector('.annotationTags').innerHTML = hlib.formatTags(newTags)

  function wrappedMakeTagsEditable() {
    return makeTagsEditable(domAnnoId)
  }
}


function renderIcon(iconClass:string) {
  return `<svg style="display:block" class="${iconClass}"><use xlink:href="#${iconClass}"></use></svg>`
}

function deleteAnnotation(domAnnoId: string) {
  if (! window.confirm("Really delete this annotation?")) {
    return
  }
  const userElement = hlib.getById(domAnnoId).querySelector('.user') as HTMLElement
  const username = getUserName(userElement)
  const token = subjectUserTokens[username]
  async function _delete() {
    const annoId = annoIdFromDomAnnoId(domAnnoId)
    const r = await hlib.deleteAnnotation(annoId, token)
    const response = JSON.parse(r.response)
    if (response.deleted) {
      hlib.getById(domAnnoId).remove()
    } else {
      alert (`unable to delete, ${r.response}`)
    }
  }
  _delete()
}

function annoIdFromDomAnnoId(domAnnoId:string) {
  return domAnnoId.replace(/^_/,'')  
}

function getUserName(userElement: HTMLElement) {
  return userElement.innerText.trim()
}
