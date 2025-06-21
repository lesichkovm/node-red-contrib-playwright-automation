module.exports = function(RED) {
    // Function to execute Playwright script using Python
    async function executePlaywright(pythonPath, url, screenshotDelay) {
        const { exec } = require('child_process');
        const path = require('path');
        const fs = require('fs');
        const os = require('os');

        return new Promise((resolve, reject) => {
            // Create a temporary Python script
            const tempFile = path.join(os.tmpdir(), `playwright-script-${Date.now()}.py`);
            
            try {
                // Create the Python script content
                const scriptContent = `
import asyncio
from playwright.async_api import async_playwright
import json
import base64
import os

async def main():
    async with async_playwright() as p:
        # Launch browser
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        try:
            # Navigate to the URL
            await page.goto('${url.replace(/'/g, "\\'")}')
            
            # Wait for the specified delay
            await page.wait_for_timeout(${screenshotDelay})
            
            # Take screenshot
            screenshot_data = await page.screenshot(full_page=True, type='jpeg', quality=80)
            screenshot_data = base64.b64encode(screenshot_data).decode('utf-8')
            
            # Get page title
            title = await page.title()
            
            # Print the base64-encoded image data between markers
            print('__PLAYWRIGHT_RESULT_START__' + screenshot_data + '__PLAYWRIGHT_RESULT_END__')
            
        except Exception as e:
            print(f"Error: {str(e)}", file=sys.stderr)
            return 1
        finally:
            await browser.close()
    return 0

if __name__ == "__main__":
    import sys
    sys.exit(asyncio.run(main()))
`;
                
                // Write the script to a temporary file
                fs.writeFileSync(tempFile, scriptContent);
                
                // Handle Python path resolution for virtual environments
                let pythonExecutable = pythonPath;
                
                // If the path is a directory (virtual environment), determine the correct Python executable
                try {
                    const stats = fs.statSync(pythonPath);
                    if (stats.isDirectory()) {
                        // Check for virtual environment structure
                        const isWindows = os.platform() === 'win32';
                        const pythonBinDir = isWindows ? 'Scripts' : 'bin';
                        const pythonExe = isWindows ? 'python.exe' : 'python';
                        
                        const potentialPythonPath = path.join(pythonPath, pythonBinDir, pythonExe);
                        
                        if (fs.existsSync(potentialPythonPath)) {
                            pythonExecutable = potentialPythonPath;
                        } else {
                            console.warn(`Could not find Python executable in ${potentialPythonPath}, using default: ${pythonPath}`);
                        }
                    }
                } catch (e) {
                    console.log(`Using Python path as is (${pythonPath}): ${e.message}`);
                }
                
                // Convert to absolute path if relative
                if (!path.isAbsolute(pythonExecutable)) {
                    pythonExecutable = path.resolve(process.cwd(), pythonExecutable);
                }
                
                // Normalize path separators for the current platform
                pythonExecutable = pythonExecutable.replace(/[\\/]+/g, path.sep);
                
                // Handle spaces in path by properly escaping
                const escapedPythonPath = `"${pythonExecutable.replace(/"/g, '\"')}"`;
                const escapedScriptPath = `"${tempFile.replace(/"/g, '\"')}"`;
                
                const command = `${escapedPythonPath} ${escapedScriptPath}`;
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
        
        this.on('input', async function(msg) {
            try {
                // Resolve values in order: msg -> config -> defaults
                const url = msg.url || config.url || '';
                const screenshotDelay = msg.screenshotDelay || config.screenshotDelay || 1000;
                const pythonPath = msg.pythonPath || config.pythonPath || 'python';
                
                // Validate URL
                if (!url) {
                    throw new Error('URL is required');
                }
                
                // Basic URL validation
                try {
                    new URL(url);
                } catch (e) {
                    throw new Error(`Invalid URL: ${url}`);
                }
                
                node.log('Starting Playwright automation...');
                
                // Execute the Playwright script to take a screenshot
                const result = await executePlaywright(
                    pythonPath,
                    url,
                    screenshotDelay
                );
                
                // Parse and send the result
                try {
                    // Extract the result between markers
                    const resultMatch = result.match(/__PLAYWRIGHT_RESULT_START__([\s\S]*?)__PLAYWRIGHT_RESULT_END__/);
                    if (!resultMatch) {
                        throw new Error('Could not find result in output.');
                    }

                    const imageData = resultMatch[1].trim();
                    
                    // On success, the content is the base64-encoded image
                    msg.payload = imageData;
                    node.send([msg, null]);
                } catch (e) {
                    console.error('Error parsing result:', e);
                    msg.payload = { error: 'Failed to parse result: ' + e.message };
                    node.error(e, msg);
                    // Send to second output (error)
                    node.send([null, msg]);
                }
            } catch (e) {
                console.error('Error in Playwright automation:', e);
                msg.payload = { error: e.message };
                node.error(e, msg);
                // Send to second output (error)
                node.send([null, msg]);
            }
        });
        
        // Clean up when node is removed
        this.on('close', function() {
            node.log("Playwright Automation node is being closed");
        });
    }
    
    // Register the node with Node-RED
    RED.nodes.registerType("playwright-automation-screenshot", PlaywrightAutomationNode);
}
