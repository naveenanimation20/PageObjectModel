const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const testsDir = path.join(__dirname, 'converted', 'tests');

// Get all .ts test files
const testFiles = fs.readdirSync(testsDir)
    .filter(f => f.endsWith('.ts'))
    .map(f => path.join(testsDir, f));

if (testFiles.length === 0) {
    console.error('No test files found in', testsDir);
    process.exit(1);
}

console.log(`Found ${testFiles.length} test file(s):`);
testFiles.forEach(f => console.log(`  - ${path.basename(f)}`));

let completed = 0;
let failed = 0;

function runTest(filePath) {
    return new Promise((resolve) => {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Running: ${path.basename(filePath)}`);
        console.log('='.repeat(60));

        const proc = spawn('npx', ['ts-node', filePath], {
            stdio: 'inherit',
            shell: true,
        });

        proc.on('close', (code) => {
            if (code === 0) {
                console.log(`✓ PASSED: ${path.basename(filePath)}`);
                completed++;
            } else {
                console.log(`✗ FAILED: ${path.basename(filePath)} (exit code: ${code})`);
                failed++;
            }
            resolve();
        });

        proc.on('error', (err) => {
            console.error(`✗ ERROR: ${err.message}`);
            failed++;
            resolve();
        });
    });
}

async function runAllTests() {
    for (const testFile of testFiles) {
        await runTest(testFile);
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('Test Summary');
    console.log('='.repeat(60));
    console.log(`Completed: ${completed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total: ${testFiles.length}`);

    if (failed > 0) {
        process.exit(1);
    }
}

runAllTests();