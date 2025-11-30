import { Page } from 'playwright';

export class HomePage {
  constructor(private page: Page) {}

  async verifyHomePageTitle() {
    return await this.page.title();
  }

  async verifyCorrectUserName() {
    // TODO: Add implementation
  }

  async clickOnContactsLink() {
    await this.page.click(`xpath=//a[contains(text(),\'Contacts\')]`);
    // Page transition to ContactsPage
  }

  async clickOnDealsLink() {
    await this.page.click(`xpath=//a[contains(text(),\'Deals\')]`);
    // Page transition to DealsPage
  }

  async clickOnTasksLink() {
    await this.page.click(`xpath=//a[contains(text(),\'Tasks\')]`);
    // Page transition to TasksPage
  }

  async clickOnNewContactLink() {
    await this.page.click(`xpath=//a[contains(text(),\'New Contact\')]`);
  }

}
