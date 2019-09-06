import * as hlib from '../../hlib/hlib' // this will be commented out in the shipping bundle

let params:any = decodeURIComponent(hlib.gup('params'))
params = JSON.parse(params)

const widget = hlib.getById('widget') as HTMLElement
const controlsContainer = hlib.getById('controlsContainer') as HTMLElement

const format = params.format
delete params.format

const iconColor = '#2c1409b5'
const exportControlStyle = `style="display:inline; width:1.8em; height:1.8em; margin-left:1em; fill:${iconColor}"`
const externalLinkStyle = `style="display:inline; width:.6em; height:.6em; margin-left:2px;margin-top:3px; fill:${iconColor}"`

let htmlBuffer = ''

const subjectUserTokens = hlib.getSubjectUserTokensFromLocalStorage()

hlib.getById('svgDefs').outerHTML = hlib.svgIcons

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
  if (params.group && params.group === 'all') {
    delete params.group
  }
})

showParams()

hlib.getById('progress').innerText = 'fetching annotations '
hlib.search(params, 'progress')
  .then( data => {
    processSearchResults(data[0], data[1])
  })
  .catch( _ => {
    alert(`Cannot search for those parameters: ${JSON.stringify(params)}`)
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
    const _tags = anno.tags.map(function(t:string) { return t.toLowerCase() })
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

  showToggleAndDownloadControls()

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
    for (let refId of refIds) {
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
    const host = new URL(url).host
    const headingCounter = `counter_${counter}`
    const { togglerTitle, togglerUnicodeChar } = getToggler()
    const output = `<h1 id="heading_${headingCounter}" class="urlHeading">
      <a title="${togglerTitle}" href="javascript:hlib.toggle('${headingCounter}')"> <span class="toggle">${togglerUnicodeChar}</span></a>
      <span class="counter">&nbsp;${count}&nbsp;</span>
      <a class="urlTitle" title="visit annotated page" target="annotatedPage" href="${url}">${doctitle}</a> 
      <span class="host">${host}</span>
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
  expander.innerText = hlib.expandToggler.togglerUnicodeChar
  expander.title = hlib.expandToggler.togglerTitle
  hlib.expandAll()
}

function setExpanderCollapse() {
  const expander = hlib.getById('expander')
  expander.onclick = setExpanderExpand
  expander.innerText = hlib.collapseToggler.togglerUnicodeChar
  expander.title = hlib.collapseToggler.togglerTitle
  hlib.collapseAll()
}

function getToggler() : hlib.toggler {
  const togglerTitle = isExpanded() ? hlib.expandToggler.togglerTitle : hlib.collapseToggler.togglerTitle
  const togglerUnicodeChar = isExpanded() ? hlib.expandToggler.togglerUnicodeChar : hlib.collapseToggler.togglerUnicodeChar
  return {
    togglerTitle: togglerTitle,
    togglerUnicodeChar: togglerUnicodeChar
  }
}

function showToggleAndDownloadControls() {
  const downloaderIcon = renderIcon('icon-floppy', exportControlStyle)
  if (format === 'html') {
    const { togglerTitle, togglerUnicodeChar } = getToggler()
    controlsContainer.innerHTML = `
      <span title="${togglerTitle}" class="toggleMajor" id="expander">${togglerUnicodeChar}</span>
      <span class="downloader">${downloaderIcon}</span>`
    const expander = hlib.getById('expander') as HTMLSpanElement
    expander.onclick = isExpanded() ? setExpanderCollapse : setExpanderExpand
    const downloader = document.querySelector('.downloader') as HTMLSpanElement
    downloader.onclick = downloadHTML
  } else {
    controlsContainer.innerHTML = `<span class="downloader">${downloaderIcon}</span>`
    const downloader = document.querySelector('.downloader') as HTMLSpanElement
    downloader.onclick = format === 'csv' ? downloadCSV : downloadJSON
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
  location.href = location.href
}

function downloadCSV () {
  let csvOutput = '"level","updated","url","user","id","group","tags","quote","text","relay link","direct link"\n'
  csvOutput += widget.innerText
  hlib.download(csvOutput, 'csv')
}

function downloadJSON () {
  const jsonOutput = '[' + widget.innerText + ']'
  hlib.download(jsonOutput, 'json')
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