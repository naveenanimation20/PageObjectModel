#!/usr/bin/env node
 // Simple GitHub Copilot-style migration agent wrapper for Java -> Playwright
// Usage: node index.js convert

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const repoRoot = path.join(__dirname, '..');
const toolsDir = path.join(repoRoot, 'tools');
const converter = path.join(toolsDir, 'javaToPlaywright.cjs');
const convertedDir = path.join(repoRoot, 'converted');

function runConverter() {
    if (!fs.existsSync(converter)) {
        console.error('Converter not found at', converter);
        process.exit(1);
    }
    console.log('Running converter...');
    const res = spawnSync('node', [converter], { stdio: 'inherit', cwd: repoRoot });
    process.exit(res.status || 0);
}

function listConverted() {
    if (!fs.existsSync(convertedDir)) {
        console.log('No converted directory found');
        return;
    }
    console.log('Converted pages:');
    const pages = fs.readdirSync(path.join(convertedDir, 'pages')).filter(f => f.endsWith('.ts'));
    pages.forEach(p => console.log('  -', p));
    console.log('\nConverted tests:');
    const tests = fs.readdirSync(path.join(convertedDir, 'tests')).filter(f => f.endsWith('.ts'));
    tests.forEach(t => console.log('  -', t));
}

function runAllTests() {
    console.log('Running test runner (npm run test:all)');
    const res = spawnSync('npm', ['run', 'test:all'], { stdio: 'inherit', cwd: repoRoot, shell: true });
    process.exit(res.status || 0);
}

function help() {
    console.log('GitHub Copilot Migration Agent — Commands:');
    console.log('  convert       Run the Java->Playwright converter');
    console.log('  list          List converted files (pages & tests)');
    console.log('  run-tests     Run all converted tests via the project test runner');
    console.log('  help          Show this help');
}

(async function main() {
    const cmd = process.argv[2] || 'help';
    switch (cmd) {
        case 'convert':
            runConverter();
            break;
        case 'list':
            listConverted();
            break;
        case 'run-tests':
            runAllTests();
            break;
        default:
            help();
    }
})();