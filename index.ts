import * as hlib from '../../hlib/hlib' // this will be commented out in the shipping bundle

const facets = ['user', 'group', 'url', 'wildcard_uri', 'tag', 'any'] as string[]
const settings = ['max', 'subjectUserTokens', 'expanded', 'searchReplies', 'exactTagSearch'] as string[]

if ( ! localStorage.getItem('h_settings') ) {
  hlib.settingsToLocalStorage(hlib.getSettings()) // initialize settings
}

updateSettingsFromUrl() // incoming url params override remembered params

hlib.settingsToUrl(hlib.getSettings()) // add non-overridden remembered params to url

hlib.createUserInputForm(hlib.getById('userContainer'))

hlib.createGroupInputForm(hlib.getById('groupContainer'))
  .then( _ => {
    const groupsList = hlib.getById('groupsList') as HTMLSelectElement
    const option = new Option('All','all')
    groupsList.insertBefore(option, groupsList.firstChild)
    groupsList.onchange = groupChangeHandler
    if (hlib.getSettings().group === 'all') {
      groupsList.selectedIndex = 0
    }
    function groupChangeHandler() {
      hlib.setSelectedGroup()
      hlib.getById('buttonHTML').click()
    }
  })

hlib.createUrlInputForm(hlib.getById('urlContainer'))

hlib.createWildcardUriInputForm(hlib.getById('wildcard_uriContainer'))

hlib.createTagInputForm(hlib.getById('tagContainer'))

hlib.createAnyInputForm(hlib.getById('anyContainer'))

hlib.createMaxInputForm(hlib.getById('maxContainer'))

hlib.createApiTokenInputForm(hlib.getById('tokenContainer'))

createSubjectUserTokensForm()

createControlledTagsForm()

hlib.createSearchRepliesCheckbox(hlib.getById('searchRepliesContainer'))

hlib.createExactTagSearchCheckbox(hlib.getById('exactTagSearchContainer'))

hlib.createExpandedCheckbox(hlib.getById('expandedContainer'))

function updateSettingsFromUrl() {
  const params = facets.concat(settings)
  params.forEach(param => {
    if (hlib.gup(param) !== '') {
      const value = decodeURIComponent(hlib.gup(param))
      hlib.updateSetting(param, value)
      hlib.settingsToLocalStorage(hlib.getSettings())
    }
  })
}

function getCSV () {
  search('csv')
}

function getHTML () {
  search('html')
}

function getJSON () {
  search('json')
}

function search (format:string) {
  const settings = hlib.getSettings()
  let params:any = {}
  params = Object.assign(params, hlib.getSettings())
  params['format'] = format
  params['_separate_replies'] = settings.searchReplies
  params['group'] = hlib.getSelectedGroup('groupsList')
  document.title = 'Hypothesis activity for the query ' + JSON.stringify(params)
  params = encodeURIComponent(JSON.stringify(params))
  const iframeUrl = `iframe.html?params=${params}`
  hlib.getById('iframe').setAttribute('src', iframeUrl)
}

function createSubjectUserTokensForm() {
  const subjectUserTokens = hlib.getSubjectUserTokensFromLocalStorage()
  const hiddenUserTokens = getSubjectUserHiddenTokens(subjectUserTokens)
  hlib.getById('subjectsContainer').innerHTML = `
    <div class="formLabel">subject user tokens</div>
    <span style="word-break: break-all" class="subjectUserTokensForm">${hiddenUserTokens}</span>
    <a title="edit" style="cursor:pointer" class="iconEditOrSaveSubjectUserTokens">
          <span>&nbsp;</span><svg class="icon-pencil"><use xlink:href="#icon-pencil"></use></svg>
    </a>`
  const anchor = document.querySelector('.iconEditOrSaveSubjectUserTokens') as HTMLAnchorElement
  anchor.onclick = makeSubjectUsersEditable
}

function getSubjectUserHiddenTokens(subjectUserTokens: Map<string,string>) {
  let subjectUserHiddenTokens = Object.assign( {}, subjectUserTokens)
  if (Object.keys(subjectUserHiddenTokens).length) {
    Object.keys(subjectUserHiddenTokens).forEach( function(key) {
      subjectUserHiddenTokens[key] = '***'
    })
  } else {
    subjectUserHiddenTokens = {}
  }
  return JSON.stringify(subjectUserHiddenTokens).slice(0,30) + ' ...'
}

function makeSubjectUsersEditable() {
  const data = hlib.getSubjectUserTokensFromLocalStorage()
  const text = JSON.stringify(data, null, 2).trim()
  hlib.getById('subjectsContainer').innerHTML = `
  <div class="formLabel">subject user tokens</div>
  <textarea>${text}</textarea>
  <a title="save" style="cursor:pointer" class="iconEditOrSaveSubjectUserTokens">
    <span>&nbsp;</span><svg class="icon-floppy"><use xlink:href="#icon-floppy"></use></svg>
  </a>`
  const textarea = document.querySelector('#subjectsContainer textarea') as HTMLTextAreaElement
  textarea.style.width = '42em' 
  textarea.style.height = '6em'
  textarea.style.position = 'relative'
  const anchor = document.querySelector('.iconEditOrSaveSubjectUserTokens') as HTMLAnchorElement
  anchor.setAttribute('title', 'save')
  anchor.onclick = saveSubjectUserTokens
  anchor.innerHTML = `<span>&nbsp;</span><svg class="icon-floppy"><use xlink:href="#icon-floppy"></use></svg>`
}

function saveSubjectUserTokens() {
  const textarea = document.querySelector('#subjectsContainer textarea') as HTMLTextAreaElement
  try {
    const value = textarea.value.replace(/[,\n}]+$/, '\n}') // silently fix most likely error
    JSON.parse(value)
    localStorage.setItem('h_subjectUserTokens', value)
    createSubjectUserTokensForm()
  } catch (e) {
    alert(`That is not valid JSON. Format is "name" : "token" pairs, comma-separated. Please check your input at https://jsoneditoronline.org/`)
  }
}

function createControlledTagsForm() {
  const controlledTags = JSON.stringify(hlib.getControlledTagsFromLocalStorage()).slice(0,30) + ' ...'
  hlib.getById('controlledTagsContainer').innerHTML = `
    <div class="formLabel">controlled tags</div>
    <span style="word-break: break-all" class="controlledTagsForm">${controlledTags}</span>
    <a title="edit" style="cursor:pointer" class="iconEditOrSaveControlledTags">
          <span>&nbsp;</span><svg class="icon-pencil"><use xlink:href="#icon-pencil"></use></svg>
    </a>`
  const anchor = document.querySelector('.iconEditOrSaveControlledTags') as HTMLAnchorElement
  anchor.onclick = makeControlledTagsEditable
}

function makeControlledTagsEditable() {
  const editableTags = hlib.getControlledTagsFromLocalStorage()
  hlib.getById('controlledTagsContainer').innerHTML = `
    <div class="formLabel">controlled tags</div>
    <textarea>${editableTags}</textarea>
    <a title="save" style="cursor:pointer" class="iconEditOrSaveControlledTags">
      <span>&nbsp;</span><svg class="icon-floppy"><use xlink:href="#icon-floppy"></use></svg>
    </a>`
  const textarea = document.querySelector('#controlledTagsContainer textarea') as HTMLTextAreaElement
  textarea.style.width = '42em' 
  textarea.style.height = '2em'
  textarea.style.position = 'relative'
  const anchor = document.querySelector('.iconEditOrSaveControlledTags') as HTMLAnchorElement
  anchor.setAttribute('title', 'save')
  anchor.onclick = saveControlledTags
  anchor.innerHTML = `<span>&nbsp;</span><svg class="icon-floppy"><use xlink:href="#icon-floppy"></use></svg>`
}

function saveControlledTags() {
  const textarea = document.querySelector('#controlledTagsContainer textarea') as HTMLTextAreaElement
  localStorage.setItem('h_controlledTags', textarea.value)
  createControlledTagsForm()
}

function dropHandler(e:DragEvent) {
  const target = e.target as HTMLInputElement
  target.focus()
  target.click()
}
  
const activeFields = facets.concat('max').filter(x => {return x !== 'group'})
activeFields.forEach(field => {
  const fieldElement = hlib.getById(`${field}Container`) as HTMLInputElement
  fieldElement.addEventListener('formUrlStorageSync', function (e) {
    getHTML()
  })
  fieldElement.addEventListener('clearInput', function (e) {
    getHTML()
  })
})