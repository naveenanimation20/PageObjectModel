import { Page } from 'playwright';

export class ContactsPage {
  constructor(private page: Page) {}

  async verifyContactsLabel() {
    return await this.page.isVisible(`xpath=//td[contains(text(),\'Contacts\')]`);
  }

  async selectContactsByName(name) {
    // TODO: Add implementation
  }

  async createNewContact(title, ftName, ltName, comp) {
    await this.page.fill('#first_name', ftName);
    await this.page.fill('#surname', ltName);
    await this.page.fill('[name="client_lookup"]', comp);
    await this.page.click(`xpath=//input[@type=\'submit\' and @value=\'Save\']`);
  }

}
