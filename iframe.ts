import * as hlib from '../../hlib/hlib' // this will be commented out in the shipping bundle

let params:any = decodeURIComponent(hlib.gup('params'))
params = JSON.parse(params)

const widget = hlib.getById('widget') as HTMLElement
const controlsContainer = hlib.getById('controlsContainer') as HTMLElement

const format = params.format
delete params.format

const iconColor = '#2c1409b5'
const baseIconStyle = `style="fill:${iconColor}"`
const externalLinkStyle = `style="display:inline;width:.8em;height:.8em;margin-left:2px;margin-top:3px;fill:${iconColor}"`
const deleteButtonStyle = `style="display:inline;width:10px;height:10px;fill:${iconColor};margin-left:2px"`

let htmlBuffer = ''

const subjectUserTokens = hlib.getSubjectUserTokensFromLocalStorage()

enum annoOrReplyCounterId {
  annoCount = 'annoCount',
  replyCount = 'replyCount'
}

enum counterDirection {
  up,
  down
}

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
  .catch( reason => {
    alert('Cannot search for those parameters')
  })

function showParams() {
  let _params = Object.assign({}, params)
  const excluded = [
    '_separate_replies', 
    'controlledTags', 
    'exactTagSearch',
    'expanded', 
    'group', 
    'searchReplies', 
    'service', 
    'subjectUserTokens', 
  ]
  excluded.forEach(param => {
    delete _params[param]
  })
  let title = hlib.syntaxColorParams(_params, excluded)
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
    const _tags = anno.tags.map(t => { return t.toLowerCase() })
    if (_tags.indexOf(queryTag.toLowerCase()) > -1) {
      checkedAnnos.push(anno)
    } else {
      const counterId = anno.isReply ? annoOrReplyCounterId.replyCount : annoOrReplyCounterId.annoCount
      decrementAnnoOrReplyCount(counterId)
    }
  })
  return checkedAnnos
}

async function processSearchResults (annoRows:any[], replyRows:any[]) {

  hlib.getById('title').innerHTML += ` 
    annotations <span id="${annoOrReplyCounterId.annoCount}">${annoRows.length}</span>, 
    replies <span id="${annoOrReplyCounterId.replyCount}">${replyRows.length}</span>`

  if ( annoRows.length == 0 && replyRows.length == 0 ) {
    hlib.getById('progress').innerText = ''
    hlib.getById('widget').innerHTML = `
      <p>Nothing found for this query. 
      <p>Please try removing or altering one or more filters. 
      <p>If you still find nothing, try ticking <i>search replies</i>.
      `
    hlib.getById('widget').style.display= 'block'
    return
  }
  
  annoRows = exactTagSearch(annoRows)
  replyRows = exactTagSearch(replyRows)
  
  let csv = ''
  const json:any[] = []
  const combined = annoRows.concat(replyRows)

  const gatheredResults = hlib.gatherAnnotationsByUrl(combined)
  const reversedUrls = reverseChronUrls(gatheredResults)
  
  let cardCounter = 0

  for (let i = 0; i < reversedUrls.length; i++ ) {
    const url = reversedUrls[i]
    await renderCardsForUrl(url)
  }

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

  async function renderCardsForUrl(url: string) {
    cardCounter++
    const annosForUrl: hlib.annotation[] = gatheredResults[url].annos
    const repliesForUrl: hlib.annotation[] = gatheredResults[url].replies
    const perUrlCount = annosForUrl.length + repliesForUrl.length
    if (format === 'html') {
      htmlBuffer += showUrlResults(cardCounter, 'widget', url, perUrlCount, gatheredResults[url].title)
    }
    let cardsHTMLBuffer = ''
    let promises = missingReplyPromises(annosForUrl.concat(repliesForUrl))
    promises = promises.map(p => p.catch(() => undefined))
    let missingAnnoOrReplyResults:hlib.httpResponse[] = await Promise.all(promises)
    missingAnnoOrReplyResults.forEach(result => {
      if (result && result.status == 200 ) { 
        const annoOrReply = hlib.parseAnnotation(JSON.parse(result.response))
        if ( annoOrReply.isReply) {
          repliesForUrl.push(annoOrReply)
          adjustAnnoOrReplyCount(annoOrReplyCounterId.replyCount, counterDirection.up)
        } else {
          annosForUrl.push(annoOrReply)
          adjustAnnoOrReplyCount(annoOrReplyCounterId.annoCount, counterDirection.up)
        }

      }
    })
    let all = organizeReplies(annosForUrl, repliesForUrl)
    all.forEach(anno => {
      let level = anno.isReply ? anno.refs.length : 0
      if (format === 'html') {
        const externalLinkIcon = renderIcon('icon-external-link', externalLinkStyle)
        const externalLink = `<a target="_standalone" href="https://hypothes.is/a/${anno.id}" title="view/edit/reply">${externalLinkIcon}</a>`
        let cardsHTML = hlib.showAnnotation(anno, level, '', externalLink)
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
    htmlBuffer = htmlBuffer.replace(`CARDS_${cardCounter}`, cardsHTMLBuffer)
  }

  function missingReplyPromises(all: hlib.annotation[]) : Promise<hlib.httpResponse>[] {
    const allIds:string[] = all.map(function (anno: hlib.annotation) {
      return anno.id
    }) 
    let refIds = [] as string[]
    all.forEach(function (anno: hlib.annotation) {
      anno.refs.forEach(refId =>{
        if (refIds.indexOf(refId) < 0) {
          refIds.push(refId)
        }
      })
    })
    
    const promises = [] as Promise<hlib.httpResponse>[]
    for (let i = 0; i < refIds.length; i++) {
      const refId = refIds[i]
      if (allIds.indexOf(refId) < 0) {
        promises.push(hlib.getAnnotation(refId, hlib.getToken()))
      }
    }
    return promises
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
  
  function reverseChronUrls (results: hlib.gatheredResults) {
    function reverseByUpdate(a:string, b:string) {
      return new Date(results[b].updated).getTime() - new Date(results[a].updated).getTime()
    }
    const urls = Object.keys(results)
    urls.sort(reverseByUpdate)
    return urls
  }

  function findRepliesForId(id: string, replies: any[]) {
    const _replies = replies.filter( _reply => {
      return _reply.refs.indexOf(id) != -1 
    })
    return _replies
  }    
  
  function organizeReplies(annosForUrl:hlib.annotation[], repliesForUrl:hlib.annotation[]) : hlib.annotation[] {
    function ascendingByUpdate(a:hlib.annotation, b:hlib.annotation) {
      return new Date(a.updated).getTime() - new Date(b.updated).getTime()
    }
    function reverseByUpdate(a:hlib.annotation, b:hlib.annotation) {
      return new Date(b.updated).getTime() - new Date(a.updated).getTime()
    }
    annosForUrl.sort(reverseByUpdate)
    const _annos = [] as hlib.annotation[]
    annosForUrl.forEach(function (annoForUrl) {
      _annos.push(annoForUrl)
      const repliesForAnno = findRepliesForId(annoForUrl.id, repliesForUrl)
      repliesForAnno.sort(ascendingByUpdate)
      repliesForAnno.forEach(function (reply:hlib.annotation) {
        _annos.push(reply)
      })
    })
    repliesForUrl.forEach(function (reply:hlib.annotation) {
      const ids = _annos.map(_anno => { return _anno.id } )
      const index = ids.indexOf(reply.id)
      if ( index < 0 ) {
        _annos.splice(index, 0, reply)
      }
    })
    return _annos
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
      const icon = renderIcon('icon-delete', deleteButtonStyle)
      deleteButton.innerHTML = `<a title="delete annotation" onclick="deleteAnnotation('${cardElement.id}')">${icon}</a>`
    } else {
      deleteButton.innerHTML = ``
    }
    const externalLink = cardElement.querySelector('.externalLink') as HTMLAnchorElement
    hlib.insertNodeAfter(deleteButton, externalLink)
  }

  function maybeCreateEditor(username: string, cardId: string, targetElement:HTMLElement, editFunctionName: string) {
    const editorContainer = document.createElement('div')
    editorContainer.setAttribute('class', 'textEditor')
    if (subjectUserTokens.hasOwnProperty(username)) {
      editorContainer.innerHTML = `
        <div onclick="${editFunctionName}('${cardId}')" class="editOrSaveIcon">
          ${renderIcon('icon-pencil', baseIconStyle)}
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
          ${renderIcon('icon-pencil', baseIconStyle)}
        </div>`;
      tagsElement.parentNode!.insertBefore(editorContainer, tagsElement);
      editorContainer.appendChild(tagsElement)
    }
  }  
}

async function makeHtmlContentEditable(domAnnoId:string) {
  const annoId = annoIdFromDomAnnoId(domAnnoId)
  const editor = document.querySelector(`#${domAnnoId} .textEditor`) as HTMLElement
  editor.style.setProperty('margin-top', '16px')
  editor.style.setProperty('margin-bottom', '16px')
  editor.style.setProperty('background-color', '#f1eeea')
  editor.setAttribute('contentEditable','true')
  const textElement = editor.querySelector('.annotationText') as HTMLElement
  const r = await hlib.getAnnotation(annoId, hlib.getToken())
  const text = JSON.parse(r.response).text
  textElement.innerText = text
  const iconContainer = editor.querySelector('.editOrSaveIcon') as HTMLElement
  iconContainer.innerHTML = renderIcon('icon-floppy', baseIconStyle)
  iconContainer.onclick = saveHtmlFromContentEditable
  const card = hlib.getById(domAnnoId) as HTMLElement
  const icon = card.querySelector('.tagEditor .editOrSaveIcon') as HTMLElement
  icon.style.display = 'block'
}

async function saveHtmlFromContentEditable(e:Event) {
  const domAnnoId = this.closest('.annotationCard').getAttribute('id')
  const annoId = annoIdFromDomAnnoId(domAnnoId)
  const userElement = this.closest('.annotationCard').querySelector('.user')
  const username = userElement.innerText.trim() 
  const body = this.closest('.annotationBody')
  const annotationText = body.querySelector('.annotationText')
  let text = annotationText.innerText
  const editor = this.closest('.textEditor') as HTMLElement
  editor.removeAttribute('contentEditable') // using `noImplicitThis` setting to silence ts complaint
  editor.style.removeProperty('background-color')
  this.innerHTML = renderIcon('icon-pencil', baseIconStyle)
  const icon = editor.querySelector('.icon-pencil') as HTMLElement
  icon.style.setProperty('margin-top', '0')
  this.onclick = wrappedMakeHtmlContentEditable
  const payload = JSON.stringify( { text: text } )
  const token = subjectUserTokens[username]
  const r = await hlib.updateAnnotation(annoId, token, payload)
  let updatedText = JSON.parse(r.response).text
  if ( updatedText !== text) {
    alert (`unable to update, ${r.response}`)
  }
  
  convertToHtml()
  
  function wrappedMakeHtmlContentEditable() {
    return makeHtmlContentEditable(domAnnoId)
  }

  function convertToHtml() {
    const converter = new showdown.Converter();
    converter.setFlavor('gitHub')
    const html = converter.makeHtml(text);
    annotationText.innerHTML = html;
  }
}

async function makeTagsEditable(domAnnoId: string) {
  const annoId = annoIdFromDomAnnoId(domAnnoId)
  const editor = document.querySelector(`#${domAnnoId} .tagEditor`) as HTMLElement
  const _controlledTags = hlib.getControlledTagsFromLocalStorage()
  const useControlledTags = _controlledTags !== hlib.defaultControlledTags
  const tagsElement = editor.querySelector('.annotationTags') as HTMLElement
  const r = await hlib.getAnnotation(annoId, hlib.getToken())
  const existingTags = JSON.parse(r.response).tags
  const firstTag:string = existingTags.length ? existingTags[0] : ''
  const anchors = tagsElement.querySelectorAll('a') as NodeListOf<HTMLAnchorElement>
  if (useControlledTags) {
    const select = createPicklist(firstTag, _controlledTags)
    insertPicklist(select)
  } 
  const start = useControlledTags ? 1 : 0  // if controlled, skip first
  for (let i = start; i < anchors.length; i++) {
    let input = document.createElement('input') as HTMLInputElement
    input.value = anchors[i].innerText
    anchors[i].parentNode.replaceChild(input, anchors[i])
  }
  
  const iconContainer = editor.querySelector('.editOrSaveIcon') as HTMLElement
  iconContainer.innerHTML = renderIcon('icon-floppy', baseIconStyle)
  iconContainer.onclick = saveControlledTag

  function insertPicklist(select: HTMLSelectElement) {
    if (anchors.length) {
      const firstAnchor = anchors[0] as HTMLAnchorElement;
      firstAnchor.parentNode.replaceChild(select, firstAnchor)
    }
    else {
      tagsElement.appendChild(select)
    }
  }

  function createPicklist(firstTag:string, _controlledTags:string) {
    const controlledTags:string[] = _controlledTags.split(',')
    const select = document.createElement('select') as HTMLSelectElement
    for (let i = 0; i < controlledTags.length; i++) {
      let controlledTag = controlledTags[i]
      let option = document.createElement('option') as HTMLOptionElement
      controlledTag = controlledTag.trim()
      option.value = controlledTag
      option.innerText = controlledTag;
      if (firstTag === controlledTag) {
        option.setAttribute('selected', 'true')
      }
      select.options.add(option)
    }
    return select
  }
}

async function saveControlledTag(e:Event) {
  const domAnnoId = this.closest('.annotationCard').getAttribute('id')
  const annoId = annoIdFromDomAnnoId(domAnnoId)
  const userElement = this.closest('.annotationCard').querySelector('.user')
  const username = userElement.innerText.trim() 
  const body = this.closest('.annotationBody')
  const select = body.querySelector('.annotationTags select') as HTMLSelectElement
  const newTags = [] as string[]
  if (select) {
    const selected = select[select.selectedIndex] as HTMLOptionElement
    newTags.push(selected.value)
  }
  const inputs = body.querySelectorAll('input') as NodeListOf<HTMLInputElement>
  inputs.forEach(input => {
    newTags.push(input.value)
  })
  this.innerHTML = renderIcon('icon-pencil', 'style="display:inline;width:12px;height:12px;fill:#2c1409b5"')
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


function renderIcon(iconClass:string, style?: string) {
  const _style = style ? style : `style="display:block"`
  return `<svg ${style} class="${iconClass}"><use xlink:href="#${iconClass}"></use></svg>`
}

function deleteAnnotation(domAnnoId: string) {
  if (! window.confirm("Really delete this annotation?")) {
    return
  }
  const card = hlib.getById(domAnnoId) as HTMLElement
  const userElement = card.querySelector('.user') as HTMLElement
  const username = getUserName(userElement)
  const token = subjectUserTokens[username]
  async function _delete() {
    const annoId = annoIdFromDomAnnoId(domAnnoId)
    const r = await hlib.deleteAnnotation(annoId, token)
    const response = JSON.parse(r.response)
    if (response.deleted) {
      const cardCounter = card.closest('div[id*="cards_counter"') as HTMLElement    
      const urlCounter = cardCounter.previousElementSibling as HTMLHeadingElement
      hlib.getById(domAnnoId).remove()
      decrementPerUrlCount(urlCounter.id)
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

function adjustAnnoOrReplyCount(id:annoOrReplyCounterId, direction:counterDirection) {
  const counterElement = hlib.getById(id) as HTMLSpanElement
  let count:number = parseInt(counterElement.innerText)
  if (direction === counterDirection.up) {
    count++
  } else {
    count--
  }
  counterElement.innerText = count.toString()
}

function incrementAnnoOrReplyCount(id:annoOrReplyCounterId) {
  adjustAnnoOrReplyCount(id, counterDirection.up)
}

function decrementAnnoOrReplyCount(id:annoOrReplyCounterId) {
  adjustAnnoOrReplyCount(id, counterDirection.down)
}

function adjustPerUrlCount(urlCounterId:string, direction:counterDirection) {
  const urlHeading = hlib.getById(urlCounterId)
  const counterElement = urlHeading.querySelector('.counter') as HTMLElement
  let counter = parseInt(counterElement.innerText)
  if (direction === counterDirection.up) {
    counter++
  } else {
    counter--
  }
  if (counter == 0) {
    urlHeading.remove()
  } else {
    counterElement.innerText = ` ${counter}`
  }
}

function incrementPerUrlCount(urlCounterId:string) {
  adjustPerUrlCount(urlCounterId, counterDirection.up)
}

function decrementPerUrlCount(urlCounterId:string) {
  adjustPerUrlCount(urlCounterId, counterDirection.down)
}