class AllDocumentationsMenuMobile extends AllDocumentationsMenuBase {

  constructor() {
    super();
    this.initializeDocumentationsData()
      .then(() => {
        if (this.data.length) {
          this.setupComponent()
          const event = new CustomEvent("all-documentation-menu-loaded");
          window.dispatchEvent(event);
        }
      });
  }

  setupComponent() {
    this.classList.add('main_menu', 'd-lg-none', 'd-block');
    const hr = document.createElement('hr');
    this.appendChild(hr)
    this.appendChild(this.createCaption())
    this.menu = this.createMenu();
    this.appendChild(this.menu);
  }

  createMenu() {
    const menu = document.createElement('ul');
    menu.classList.add('menu-level-1');

    for (const category of this.data) {
      menu.appendChild(this.createDocumentationCategory(category));
    }

    return menu;

  }

  createCaption() {
    const caption = document.createElement('p');
    caption.classList.add('caption');
    caption.textContent = 'All documentation';
    return caption;
  }

  /** Documentations popup */

  createDocumentationCategoryHeader(text, href) {
    let headerElement;
    if (href) {
      headerElement = document.createElement('a');
      headerElement.setAttribute('href', href)
    } else {
      headerElement = document.createElement('div')
    }
    headerElement.innerHTML = text;

    return headerElement;
  }


  createDocumentationCategory(category, level = 1) {
    const section = document.createElement('li');
    section.setAttribute('role', 'menuitem');
    const header = this.createDocumentationCategoryHeader(category.name, category.href);
    section.appendChild(header);

    if (!category.children || !category.children.length) {
      return section;
    }

    const docsListElement = document.createElement('ul');
    docsListElement.classList.add('menu-level-' + level)
    level += 1;

    for (const child of category.children) {
      docsListElement.appendChild(this.createDocumentationCategory(child, level));
    }

    section.appendChild(docsListElement);

    return section;
  }
}

customElements.define('all-documentations-menu-mobile', AllDocumentationsMenuMobile)
