module.exports = function(RED) {
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
            try {
                // Process the message with Playwright Automation
                let result = {
                    originalPayload: msg.payload,
                    config: {
                        takeScreenshot: node.takeScreenshot,
                        screenshotDelay: node.screenshotDelay
                    },
                    processedAt: new Date().toISOString()
                };
                
                msg.payload = result;
                
                // Send the message to the next node
                node.send(msg);
                
                // Log to the debug tab
                node.log(`Message processed with config: ${JSON.stringify(result.config)}`);
            } catch (error) {
                node.error("Error processing message: " + error.message, msg);
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
