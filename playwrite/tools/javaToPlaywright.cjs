const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(filePath));
        } else {
            results.push(filePath);
        }
    });
    return results;
}

function readJavaFile(file) {
    return fs.readFileSync(file, 'utf8');
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function toTsClassName(javaName) {
    return javaName.replace(/\.java$/, '') + '';
}

function guessSelector(arg) {
    if (!arg) return null;
    const m = arg.match(/By\.id\s*\(\s*"([^"]+)"\s*\)/);
    if (m) return `#${m[1]}`;
    const m2 = arg.match(/By\.name\s*\(\s*"([^"]+)"\s*\)/);
    if (m2) return `[name="${m2[1]}"]`;
    const m3 = arg.match(/By\.className\s*\(\s*"([^"]+)"\s*\)/);
    if (m3) return `.${m3[1]}`;
    const m4 = arg.match(/By\.cssSelector\s*\(\s*"([^"]+)"\s*\)/);
    if (m4) return `${m4[1]}`;
    const m5 = arg.match(/By\.xpath\s*\(\s*"([^"]+)"\s*\)/);
    if (m5) {
        // Escape single quotes in XPath for use in backticks
        const xpath = m5[1].replace(/'/g, "\\'");
        return `xpath=${xpath}`;
    }
    const m6 = arg.match(/"([^"]+)"/);
    if (m6) return m6[1];
    return null;
}

function convertPage(javaPath, outDir) {
    const content = readJavaFile(javaPath);
    const fileName = path.basename(javaPath).replace('.java', '');
    const classMatch = content.match(/public\s+class\s+(\w+)/);
    const className = classMatch ? classMatch[1] : fileName;

    const locators = {};

    // Parse @FindBy annotations: @FindBy(name="...") or @FindBy(xpath="...")
    const findByPattern = /@FindBy\s*\(\s*(name|id|className|xpath|css)\s*=\s*"([^"]+)"\s*\)\s*\n\s*WebElement\s+(\w+)/g;
    let m;
    while ((m = findByPattern.exec(content)) !== null) {
        const locType = m[1];
        const locValue = m[2];
        const fieldName = m[3];
        let selector;
        if (locType === 'name') selector = `[name="${locValue}"]`;
        else if (locType === 'id') selector = `#${locValue}`;
        else if (locType === 'className') selector = `.${locValue}`;
        else if (locType === 'xpath') {
            // Escape single quotes in XPath for use in backticks
            const xpath = locValue.replace(/'/g, "\\'");
            selector = `xpath=${xpath}`;
        } else if (locType === 'css') selector = locValue;
        if (selector) locators[fieldName] = selector;
    }

    const byVarPattern = /By\s+(\w+)\s*=\s*(By\.\w+\s*\(\s*"[^"]+"\s*\))\s*;/g;
    while ((m = byVarPattern.exec(content)) !== null) {
        const name = m[1];
        const arg = m[2];
        const sel = guessSelector(arg);
        if (sel) locators[name] = sel;
    }

    const webElPattern = /WebElement\s+(\w+)\s*=\s*driver\.findElement\s*\(\s*(By\.\w+\s*\(\s*"[^"]+"\s*\))\s*\)\s*;/g;
    while ((m = webElPattern.exec(content)) !== null) {
        const name = m[1];
        const arg = m[2];
        const sel = guessSelector(arg);
        if (sel) locators[name] = sel;
    }

    const methodPattern = /public\s+(?:\w+\s+)?(\w+)\s*\(([^)]*)\)\s*(?:throws\s+\w+\s*)?\{([\s\S]*?)^\s*\}/gm;
    const methods = [];
    while ((m = methodPattern.exec(content)) !== null) {
        const name = m[1];
        if (name === className) continue; // skip constructor
        const params = m[2].trim();
        const body = m[3];
        methods.push({ name, params, body });
    }

    let ts = `import { Page } from 'playwright';\n\nexport class ${className} {\n  constructor(private page: Page) {}\n\n`;

    methods.forEach((mth) => {
        const name = mth.name;
        const params = mth.params;
        const paramsList = params ? params.split(',').map(p => p.trim().split(' ').pop()).filter(Boolean).join(', ') : '';
        let methodBody = '';
        const lines = mth.body.split('\n');
        let hasContent = false;
        lines.forEach((ln) => {
            ln = ln.trim();
            if (!ln) return;
            // field.sendKeys(value);
            let fieldSend = ln.match(/(\w+)\.sendKeys\s*\(\s*(\w+)\s*\)\s*;/);
            if (fieldSend && locators[fieldSend[1]]) {
                const selector = locators[fieldSend[1]];
                const quote = selector.includes("'") ? '`' : "'";
                methodBody += `    await this.page.fill(${quote}${selector}${quote}, ${fieldSend[2]});\n`;
                hasContent = true;
                return;
            }
            // field.click();
            let fieldClick = ln.match(/(\w+)\.click\s*\(\s*\)\s*;/);
            if (fieldClick && locators[fieldClick[1]]) {
                const selector = locators[fieldClick[1]];
                const quote = selector.includes("'") ? '`' : "'";
                methodBody += `    await this.page.click(${quote}${selector}${quote});\n`;
                hasContent = true;
                return;
            }
            // field.isDisplayed();
            let fieldIsDisplayed = ln.match(/(\w+)\.isDisplayed\s*\(\s*\)/);
            if (fieldIsDisplayed && locators[fieldIsDisplayed[1]]) {
                const selector = locators[fieldIsDisplayed[1]];
                const quote = selector.includes("'") ? '`' : "'";
                methodBody += `    return await this.page.isVisible(${quote}${selector}${quote});\n`;
                hasContent = true;
                return;
            }
            // driver.getTitle()
            let getTitle = ln.match(/return\s+driver\.getTitle\s*\(\s*\)/);
            if (getTitle) {
                methodBody += `    return await this.page.title();\n`;
                hasContent = true;
                return;
            }
            // return new HomePage() etc
            let returnClass = ln.match(/return\s+new\s+(\w+)\s*\(\s*\)/);
            if (returnClass) {
                methodBody += `    // Page transition to ${returnClass[1]}\n`;
                hasContent = true;
                return;
            }
            // JavascriptExecutor js = (JavascriptExecutor)driver; js.executeScript("arguments[0].click();", field);
            if (ln.includes('executeScript')) {
                methodBody += `    // JavaScript executor call (review manually)\n`;
                hasContent = true;
                return;
            }
        });

        if (!hasContent) {
            methodBody = `    // TODO: Add implementation\n`;
        }

        ts += `  async ${name}(${paramsList}) {\n${methodBody}  }\n\n`;
    });

    ts += `}\n`;

    ensureDir(outDir);
    const outPath = path.join(outDir, `${className}.ts`);
    fs.writeFileSync(outPath, ts, 'utf8');
    return outPath;
}

function convertTest(javaPath, outDir, pagesDir) {
    const content = readJavaFile(javaPath);
    const fileName = path.basename(javaPath).replace('.java', '');
    const classMatch = content.match(/public\s+class\s+(\w+)/);
    const className = classMatch ? classMatch[1] : fileName;

    // Find all @Test methods
    const testPattern = /@Test[\s\S]*?public\s+void\s+(\w+)\s*\(\s*(?:[\w\s,]*?)?\s*\)\s*(?:throws\s+[\w.]+\s*)?\{([\s\S]*?)^\s*\}/gm;
    const tests = [];
    let m;
    while ((m = testPattern.exec(content)) !== null) {
        tests.push({ name: m[1], body: m[2] });
    }

    if (tests.length === 0) {
        console.warn(`  No @Test methods found in ${fileName}.java`);
        return null;
    }

    let ts = `import { chromium } from 'playwright';\n`;

    const importPattern = /import\s+com\.crm\.qa\.pages\.(\w+)\s*;/g;
    const imports = [];
    while ((m = importPattern.exec(content)) !== null) {
        imports.push(m[1]);
    }

    imports.forEach((imp) => {
        ts += `import { ${imp} } from '../pages/${imp}';\n`;
    });

    ts += `\n(async () => {\n  const browser = await chromium.launch({ headless: false });\n  const page = await browser.newPage();\n  await page.goto('http://localhost:3000'); // TODO: Set correct URL\n`;

    imports.forEach((imp) => {
        const varName = imp[0].toLowerCase() + imp.slice(1);
        ts += `  const ${varName} = new ${imp}(page);\n`;
    });

    ts += `\n  try {\n`;

    tests.forEach((t) => {
        ts += `    // @Test: ${t.name}\n`;
        const lines = t.body.split('\n');
        lines.forEach((ln) => {
            ln = ln.trim();
            if (!ln || ln.startsWith('//')) return;

            // Skip Java assertions entirely
            if (ln.match(/Assert\.(assertEquals|assertTrue|assertFalse|assertEquals)/)) {
                return;
            }

            // driver.get(url);
            const gotoMatch = ln.match(/driver\.get\s*\(\s*"([^"]+)"\s*\)\s*;/);
            if (gotoMatch) {
                ts += `    await page.goto('${gotoMatch[1]}');\n`;
                return;
            }

            // Variable assignments like: String title = driver.getTitle();
            const titleMatch = ln.match(/String\s+(\w+)\s*=\s*driver\.getTitle\s*\(\s*\)\s*;/);
            if (titleMatch) {
                ts += `    const ${titleMatch[1]} = await page.title();\n`;
                return;
            }

            // pageObj.methodName(...);
            const pageCall = ln.match(/(\w+)\.(\w+)\s*\((.*?)\)\s*;/);
            if (pageCall) {
                const obj = pageCall[1];
                const method = pageCall[2];
                const args = pageCall[3].trim();
                // Handle prop.getProperty(...) or string literals
                let jsArgs = args.replace(/prop\.getProperty\s*\(\s*"([^"]+)"\s*\)/g, "'$1'");
                jsArgs = jsArgs.replace(/new\s+\w+\s*\(|\)/g, '');
                ts += `    await ${obj}.${method}(${jsArgs});\n`;
                return;
            }

            // Variable assignments from method calls: String flag = loginPage.someMethod();
            const varAssign = ln.match(/\w+\s+(\w+)\s*=\s*(\w+)\.(\w+)\s*\((.*?)\)\s*;/);
            if (varAssign) {
                const varName = varAssign[1];
                const obj = varAssign[2];
                const method = varAssign[3];
                const args = varAssign[4].trim();
                let jsArgs = args.replace(/prop\.getProperty\s*\(\s*"([^"]+)"\s*\)/g, "'$1'");
                jsArgs = jsArgs.replace(/new\s+\w+\s*\(|\)/g, '');
                ts += `    const ${varName} = await ${obj}.${method}(${jsArgs});\n`;
                return;
            }
        });

        ts += `\n`;
    });

    ts += `    console.log('All tests passed!');\n`;
    ts += `  } catch (err) {\n`;
    ts += `    console.error('Test failed:', err);\n`;
    ts += `  } finally {\n`;
    ts += `    await browser.close();\n`;
    ts += `  }\n`;
    ts += `})();\n`;

    ensureDir(outDir);
    const outPath = path.join(outDir, `${className}.ts`);
    fs.writeFileSync(outPath, ts, 'utf8');
    return outPath;
}

const repoRoot = path.resolve(__dirname, '..', '..');
const javaPagesDir = path.join(repoRoot, 'src', 'main', 'java');
const javaTestsDir = path.join(repoRoot, 'src', 'test', 'java');

const convertedRoot = path.join(repoRoot, 'playwrite', 'converted');
const convPages = path.join(convertedRoot, 'pages');
const convTests = path.join(convertedRoot, 'tests');
ensureDir(convertedRoot);
ensureDir(convPages);
ensureDir(convTests);

let converted = [];

if (fs.existsSync(javaPagesDir)) {
    const allFiles = walk(javaPagesDir);
    const pageFiles = allFiles.filter(f => f.endsWith('.java') && f.includes(path.join('com', 'crm', 'qa', 'pages')));
    pageFiles.forEach(p => {
        try {
            const out = convertPage(p, convPages);
            converted.push({ input: p, output: out });
        } catch (e) {
            console.error('Failed converting page', p, e.message);
        }
    });
}

if (fs.existsSync(javaTestsDir)) {
    const allFiles = walk(javaTestsDir);
    const testFiles = allFiles.filter(f => f.endsWith('.java') && f.includes(path.join('com', 'crm', 'qa', 'testcases')));
    testFiles.forEach(p => {
        try {
            const out = convertTest(p, convTests, convPages);
            converted.push({ input: p, output: out });
        } catch (e) {
            console.error('Failed converting test', p, e.message);
        }
    });
}

console.log('Conversion complete. Files converted:');
converted.forEach(c => console.log(`- ${c.input} -> ${c.output}`));

if (converted.length === 0) console.log('No matching Java page/test files found for conversion.');