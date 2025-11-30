import { chromium } from 'playwright';
import { ContactsPage } from '../pages/ContactsPage';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  const BASE_URL = process.env.BASE_URL || 'https://www.freecrm.com';
  await page.goto(BASE_URL);
  const contactsPage = new ContactsPage(page);
  const homePage = new HomePage(page);
  const loginPage = new LoginPage(page);

  try {
    // @Test: verifyContactsPageLabel

    // @Test: selectSingleContactsTest
    await contactsPage.selectContactsByName("test2 test2");

    // @Test: selectMultipleContactsTest
    await contactsPage.selectContactsByName("test2 test2");
    await contactsPage.selectContactsByName("ui uiii");

    // @Test: validateCreateNewContact
    await homePage.clickOnNewContactLink();
    await contactsPage.createNewContact(title, firstName, lastName, company);

    console.log('All tests passed!');
  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    await browser.close();
  }
})();
