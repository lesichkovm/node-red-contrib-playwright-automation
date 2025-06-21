const { chromium, firefox, webkit } = require('playwright');

module.exports = function(RED) {
    function PlaywrightConfigNode(config) {
        RED.nodes.createNode(this, config);
        this.name = config.name;
        this.browserType = config.browserType || 'chromium';
        this.headless = config.headless !== false;
        this.slowMo = parseInt(config.slowMo) || 0;
        this.browser = null;
        this.context = null;
        this.page = null;

        const node = this;

        this.launchBrowser = async function() {
            try {
                const browserMap = { chromium, firefox, webkit };
                const launchOptions = {
                    headless: node.headless,
                    slowMo: node.slowMo
                };
                
                node.browser = await browserMap[node.browserType].launch(launchOptions);
                node.context = await node.browser.newContext();
                node.page = await node.context.newPage();
                
                node.status({fill:"green",shape:"dot",text:"connected"});
                return node.page;
            } catch (error) {
                node.status({fill:"red",shape:"ring",text:"error"});
                node.error("Failed to launch browser: " + error.message);
                throw error;
            }
        };

        this.closeBrowser = async function() {
            if (node.browser) {
                await node.browser.close();
                node.browser = null;
                node.context = null;
                node.page = null;
                node.status({});
            }
        };

        // Clean up on node removal
        this.on('close', function(done) {
            node.closeBrowser().then(done);
        });
    }

    RED.nodes.registerType("playwright-automation-config", PlaywrightConfigNode);

    // Action node
    function PlaywrightActionNode(config) {
        RED.nodes.createNode(this, config);
        this.config = RED.nodes.getNode(config.config);
        this.action = config.action || 'navigate';
        this.selector = config.selector || '';
        this.value = config.value || '';
        this.waitForNavigation = config.waitForNavigation !== false;
        this.waitForSelector = config.waitForSelector || '';
        this.waitForTimeout = parseInt(config.waitForTimeout) || 30000;

        const node = this;

        this.on('input', async function(msg) {
            if (!node.config) {
                node.status({fill:"red",shape:"ring",text:"error: no config"});
                node.error("No Playwright configuration");
                return;
            }

            try {
                let page = node.config.page;
                if (!page) {
                    page = await node.config.launchBrowser();
                }

                // Handle different actions
                switch(node.action) {
                    case 'navigate':
                        const url = node.value || msg.url || msg.payload;
                        await page.goto(url, { waitUntil: node.waitForNavigation ? 'networkidle' : 'domcontentloaded' });
                        break;
                    case 'click':
                        const clickSelector = node.selector || msg.selector || msg.payload;
                        if (node.waitForSelector) {
                            await page.waitForSelector(node.waitForSelector, { timeout: node.waitForTimeout });
                        }
                        await page.click(clickSelector);
                        break;
                    case 'fill':
                        const fillSelector = node.selector || msg.selector;
                        const fillValue = node.value || msg.value || msg.payload;
                        if (node.waitForSelector) {
                            await page.waitForSelector(node.waitForSelector, { timeout: node.waitForTimeout });
                        }
                        await page.fill(fillSelector, fillValue);
                        break;
                    case 'screenshot':
                        const screenshot = await page.screenshot({
                            fullPage: node.value === 'full',
                            path: node.value && node.value !== 'full' ? node.value : undefined
                        });
                        msg.payload = screenshot;
                        break;
                    case 'evaluate':
                        const result = await page.evaluate((script) => {
                            return eval(script);
                        }, node.value || msg.payload);
                        msg.payload = result;
                        break;
                }

                // Pass through the message
                node.send(msg);
                node.status({fill:"green",shape:"dot",text:"success"});
                
                // Clear status after 2 seconds
                setTimeout(() => {
                    node.status({});
                }, 2000);

            } catch (error) {
                node.status({fill:"red",shape:"ring",text:"error"});
                node.error("Playwright error: " + error.message, msg);
            }
        });
    }

    RED.nodes.registerType("playwright-automation", PlaywrightActionNode);
}
