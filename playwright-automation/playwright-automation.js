module.exports = function(RED) {
    let playwright;
    
    // Lazy load Playwright with better error reporting
    function getPlaywright() {
        if (!playwright) {
            const pathsToTry = [
                'playwright',
                __dirname + '/node_modules/playwright',
                __dirname + '/../../node_modules/playwright',
                process.cwd() + '/node_modules/playwright'
            ];
            
            for (const path of pathsToTry) {
                try {
                    playwright = require(path);
                    console.log(`Successfully loaded Playwright from: ${path}`);
                    return playwright;
                } catch (e) {
                    console.log(`Failed to load Playwright from ${path}:`, e.message);
                }
            }
            
            throw new Error(`Failed to load Playwright. Tried paths: ${pathsToTry.join(', ')}. ` +
                          `Make sure Playwright is installed in your Node-RED environment. ` +
                          `Run 'npm install playwright' in your Node-RED user directory.`);
        }
        return playwright;
    }
    function PlaywrightAutomationNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        
        // Store the node configuration
        this.name = config.name;
        this.takeScreenshot = config.takeScreenshot;
        this.screenshotDelay = config.screenshotDelay || 1000;
        
        // Log configuration
        this.log(`Playwright Automation node initialized - Take Screenshot: ${this.takeScreenshot}, Delay: ${this.screenshotDelay}ms`);
        
        // Handle incoming messages
        this.on('input', function(msg) {
            node.log('Received message: ' + JSON.stringify(msg));
            // Use a self-executing async function to handle async/await
            (async () => {
                let browser = null;
                let page = null;
                
                try {
                    node.log('Loading Playwright...');
                    const { chromium } = getPlaywright();
                    node.log('Playwright loaded successfully');
                
                    // Initialize browser
                    browser = await chromium.launch({ 
                        headless: true,
                        args: ['--no-sandbox', '--disable-setuid-sandbox']
                    });
                    const context = await browser.newContext();
                    page = await context.newPage();
                    
                    // Navigate to Google
                    await page.goto('https://google.com', { waitUntil: 'networkidle' });
                    node.log('Successfully navigated to Google');
                    
                    // Process the message with Playwright Automation
                    let result = {
                        originalPayload: msg.payload,
                        config: {
                            takeScreenshot: node.takeScreenshot,
                            screenshotDelay: node.screenshotDelay
                        },
                        processedAt: new Date().toISOString(),
                        browserInitialized: true
                    };
                    
                    msg.payload = result;
                    
                    // Send the message to the next node
                    node.send(msg);
                    
                    // Log to the debug tab
                    node.log(`Message processed with config: ${JSON.stringify(result.config)}`);
                    
                } catch (error) {
                    const errorMsg = "Error in browser automation: " + (error.stack || error.message);
                    node.error(errorMsg, msg);
                    msg.error = errorMsg;
                    node.send([null, msg]); // Send error to second output if available
                } finally {
                    try {
                        // Close the browser if it was opened
                        if (page) {
                            node.log('Closing page...');
                            await page.close().catch(e => node.error('Error closing page: ' + e.message));
                        }
                        if (browser) {
                            node.log('Closing browser...');
                            await browser.close().catch(e => node.error('Error closing browser: ' + e.message));
                        }
                    } catch (e) {
                        node.error('Error during cleanup: ' + e.message);
                    }
                }
            })();
        });
        
        // Clean up when node is removed
        this.on('close', function() {
            node.log("Playwright Automation node is being closed");
        });
    }
    
    // Register the node with Node-RED
    RED.nodes.registerType("playwright-automation", PlaywrightAutomationNode);
}
