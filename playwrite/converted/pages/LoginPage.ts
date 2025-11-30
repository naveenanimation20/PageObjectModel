import { Page } from 'playwright';

export class LoginPage {
  constructor(private page: Page) {}

  async validateLoginPageTitle() {
    return await this.page.title();
  }

  async validateCRMImage() {
    return await this.page.isVisible(`xpath=//img[contains(@class,\'img-responsive\')]`);
  }

  async login(un, pwd) {
    await this.page.fill('[name="username"]', un);
    await this.page.fill('[name="password"]', pwd);
    await this.page.click(`xpath=//input[@type=\'submit\']`);
    // JavaScript executor call (review manually)
    // Page transition to HomePage
  }

}
