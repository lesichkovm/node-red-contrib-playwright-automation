module.exports = function(RED) {
    // Function to execute Playwright script using Python
    function executePlaywright(url, takeScreenshot, screenshotDelay) {
        const { exec } = require('child_process');
        const path = require('path');
        const fs = require('fs');
        const os = require('os');

        return new Promise((resolve, reject) => {
            // Create a temporary Python script
            const tempFile = path.join(os.tmpdir(), `playwright-script-${Date.now()}.py`);
            
            try {
                // Escape the URL for Python string
                const escapedUrl = url.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                
                // Create the Python script
                const scriptContent = `
from playwright.sync_api import sync_playwright
import json
import sys

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-setuid-sandbox'])
        context = browser.new_context()
        page = context.new_page()
        
        # Navigate to the URL
        page.goto('${escapedUrl}', wait_until='networkidle')
        print('Successfully navigated to: ${escapedUrl}')
        
        # Add delay if screenshot is enabled
        if ${takeScreenshot}:
            page.wait_for_timeout(${screenshotDelay})
        
        # Take screenshot if enabled
        screenshot = None
        if ${takeScreenshot}:
            screenshot = page.screenshot(full_page=True, encoding='base64')
        
        # Prepare result
        result = {
            'success': True,
            'url': '${escapedUrl}',
            'title': page.title(),
            'screenshot': screenshot
        }
        
        # Output the result as JSON
        print('__PLAYWRIGHT_RESULT_START__')
        print(json.dumps(result))
        print('__PLAYWRIGHT_RESULT_END__')
        
        browser.close()
        
except Exception as e:
    print('__PLAYWRIGHT_ERROR_START__')
    print(str(e))
    print('__PLAYWRIGHT_ERROR_END__')
    sys.exit(1)
`;
                
                // Write the script to a temporary file
                fs.writeFileSync(tempFile, scriptContent);
                
                // Execute the Python script
                const command = `python "${tempFile}"`;
                console.log('Executing command:', command);
                
                exec(command, { timeout: 60000 }, (error, stdout, stderr) => {
                    // Clean up the temporary file
                    try { 
                        fs.unlinkSync(tempFile); 
                        console.log('Temporary file cleaned up');
                    } catch (e) {
                        console.error('Error cleaning up temp file:', e);
                    }
                    
                    if (error) {
                        // Check for error in stdout/stderr
                        const errorMatch = stdout && stdout.match(/__PLAYWRIGHT_ERROR_START__\s*([\s\S]*?)\s*__PLAYWRIGHT_ERROR_END__/);
                        const errorMessage = errorMatch ? errorMatch[1].trim() : (error.message || stderr || 'Unknown error');
                        
                        console.error('Playwright execution error:', {
                            error: errorMessage,
                            code: error.code,
                            signal: error.signal,
                            cmd: error.cmd,
                            stdout: stdout,
                            stderr: stderr
                        });
                        
                        return reject(new Error(`Playwright execution failed: ${errorMessage}`));
                    }
                    
                    resolve(stdout);
                });
            } catch (error) {
                // Clean up the temporary file if it exists
                try { fs.unlinkSync(tempFile); } catch (e) {}
                reject(error);
            }
        });
    }

    function PlaywrightAutomationNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        // Configuration
        this.name = config.name;
        this.takeScreenshot = config.takeScreenshot;
        this.screenshotDelay = config.screenshotDelay || 1000;
        this.url = config.url || 'https://google.com';

        this.on('input', async function(msg) {
            try {
                node.log('Starting Playwright automation...');
                
                // Call the Python-based Playwright executor
                const scriptContent = ''; // Not used in Python implementation

                // Execute the script
                const result = await executePlaywright(scriptContent);
                
                // Parse and send the result
                try {
                    // Extract the JSON result from between the markers
                    const resultMatch = result.match(/__PLAYWRIGHT_RESULT_START__\s*([\s\S]*?)\s*__PLAYWRIGHT_RESULT_END__/);
                    if (!resultMatch) {
                        throw new Error('Could not find result in output. Full output: ' + result);
                    }
                    
                    const parsedResult = JSON.parse(resultMatch[1].trim());
                    msg.payload = parsedResult;
                    node.send([msg, null]);
                } catch (e) {
                    console.error('Error parsing result:', e);
                    console.error('Raw output:', result);
                    throw new Error(`Failed to parse result: ${e.message}. Output: ${result}`);
                }
                
            } catch (error) {
                node.error('Playwright execution failed: ' + error.message, msg);
                msg.error = error.message;
                node.send([null, msg]);
            }
        });
        
        // Clean up when node is removed
        this.on('close', function() {
            node.log("Playwright Automation node is being closed");
        });
    }
    
    // Register the node with Node-RED
    RED.nodes.registerType("playwright-automation", PlaywrightAutomationNode);
}
