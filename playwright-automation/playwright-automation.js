module.exports = function(RED) {
    function PlaywrightAutomationNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        
        // Store the node configuration
        this.name = config.name;
        
        // Handle incoming messages
        this.on('input', function(msg) {
            // Process the message with Playwright Automation
            msg.payload = `Playwright Automation processing: ${JSON.stringify(msg.payload)}`;
            
            // Send the message to the next node
            node.send(msg);
            
            // Log to the debug tab
            node.log("Message processed by Playwright Automation");
        });
        
        // Clean up when node is removed
        this.on('close', function() {
            node.log("Playwright Automation node is being closed");
        });
    }
    
    // Register the node with Node-RED
    RED.nodes.registerType("playwright-automation", PlaywrightAutomationNode);
}
