# Node-RED Playwright Automation Nodes

[![npm version](https://img.shields.io/npm/v/node-red-contrib-playwright-automation)](https://www.npmjs.com/package/node-red-contrib-playwright-automation)
[![Downloads](https://img.shields.io/npm/dm/node-red-contrib-playwright-automation)](https://www.npmjs.com/package/node-red-contrib-playwright-automation)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub issues](https://img.shields.io/github/issues/lesichkovm/node-red-contrib-playwright-automation)](https://github.com/lesichkovm/node-red-contrib-playwright-automation/issues)
[![GitHub stars](https://img.shields.io/github/stars/lesichkovm/node-red-contrib-playwright-automation)](https://github.com/lesichkovm/node-red-contrib-playwright-automation/stargazers)

A collection of Node-RED nodes for browser automation using [Playwright](https://playwright.dev/). These nodes provide an easy way to automate browser interactions directly from your Node-RED flows.

## Features

- **Multiple Browsers**: Supports Chromium, Firefox, and WebKit
- **Flexible Actions**: Navigate, click, fill forms, take screenshots, and evaluate JavaScript
- **Configurable**: Control browser behavior with various options
- **Headless/Headed**: Toggle between headless and visible browser modes
- **Smart Waiting**: Built-in waiting for elements and navigation
- **Screenshots**: Capture screenshots with configurable delay
- **Error Handling**: Comprehensive error handling and logging

## Installation

### Prerequisites
- Node.js 14 or later
- Node-RED 2.0 or later
- Playwright browsers (will be installed automatically)

### Installation Methods

#### Method 1: Install via npm (recommended)
Run the following command in your Node-RED user directory (typically `~/.node-red`):

```bash
npm install node-red-contrib-playwright-automation
```

#### Method 2: Install from GitHub
If you want the latest development version, you can install directly from GitHub:

```bash
npm install git+https://github.com/lesichkovm/node-red-contrib-playwright-automation.git
```

### Post-Installation
After installation, restart Node-RED. You'll find the Playwright Automation nodes in the palette under the "Playwright Automation" category.

### Browser Installation
Playwright requires browser binaries to be installed. The first time you use the nodes, it will attempt to install the necessary browsers automatically. If you encounter any issues, you can manually install them by running:

```bash
npx playwright install
```

## Nodes

### Playwright Automation Config

This node configures a Playwright browser instance.

#### Properties

- **Name**: A friendly name for the configuration
- **Browser**: Choose between Chromium, Firefox, or WebKit
- **Headless Mode**: Run browser in headless mode (default: true)
- **Slow Motion (ms)**: Slow down execution by specified milliseconds (useful for debugging)

### Playwright

This node performs browser automation actions.

#### Actions

1. **Navigate to URL**
   - Navigate to a specific URL
   - Can use `msg.url` or `msg.payload` as the URL

2. **Click Element**
   - Click on an element matching the CSS selector
   - Supports waiting for selectors to be visible

3. **Fill Form**
   - Fill a form field with the specified value
   - Supports waiting for selectors to be visible

4. **Take Screenshot**
   - Capture a screenshot of the current page
   - Can save to a file or output as buffer

5. **Evaluate JavaScript**
   - Execute JavaScript in the browser context
   - Returns the result in `msg.payload`

## Usage Examples

### Basic Navigation

1. Add a Playwright Automation Config node and configure it
2. Add a Playwright Automation node and set action to "Navigate to URL"
3. Connect an inject node and set the payload to a URL (e.g., `https://example.com`)
4. Deploy and click the inject node

### Form Filling

1. Add a Playwright Automation Config node
2. Add a Playwright Automation node set to "Navigate to URL" with your form URL
3. Add another Playwright Automation node set to "Fill Form" with the appropriate selector and value
4. Optionally add a "Click" node to submit the form
5. Connect them in sequence and deploy

### Taking a Screenshot

1. Add a Playwright Automation node to your flow
2. In the node configuration:
   - Check "Take Screenshot"
   - Set "Screenshot Delay" in milliseconds (e.g., 2000 for 2 seconds)
3. Ensure the input message contains a `browser` property with a Playwright browser instance
4. Optionally, include a `url` in the message to navigate before taking the screenshot
5. The screenshot will be available in `msg.screenshot` as a base64-encoded data URL

Example message to the node:
```javascript
{
    "browser": browserInstance,  // From Playwright browser launch
    "url": "https://example.com",  // Optional: URL to navigate to
    "payload": {
        // Your custom data
    }
}
```

Output message will include:
```javascript
{
    "screenshot": "data:image/png;base64,...",  // Base64 encoded image
    "screenshotTakenAt": "2025-06-21T10:42:33.123Z",
    "payload": {
        // Your original payload with additional processing
        "processedAt": "2025-06-21T10:42:33.123Z"
    }
}
```

### Displaying the Screenshot

To display the screenshot in the Node-RED Dashboard:
1. Add a "ui_template" node from node-red-dashboard
2. Use the following template to display the image:
```html
<div ng-if="msg.screenshot">
    <h3>Screenshot taken at {{msg.screenshotTakenAt}}</h3>
    <img ng-src="{{msg.screenshot}}" style="max-width: 100%;">
</div>

## Message Properties

### Input

- `msg.url`: URL to navigate to (for "navigate" action)
- `msg.selector`: CSS selector (for "click" and "fill" actions)
- `msg.value`: Value to fill (for "fill" action)
- `msg.payload`: Can be used as URL or value depending on the action

### Output

- `msg.payload`: Contains screenshot buffer (for "screenshot" action) or evaluation result (for "evaluate" action)
- `msg.screenshot`: Alternative property containing screenshot buffer
- `msg.page`: Reference to the Playwright Page object (advanced usage)

## Advanced Usage

### Screenshot Options

- **Take Screenshot**: Enable/disable screenshot functionality
- **Screenshot Delay**: Time to wait (in milliseconds) before taking the screenshot
- **Require Browser Instance**: When enabled, the node will only take screenshots if a browser instance is provided in the message. When disabled, the node will attempt to create a new browser instance if needed.

### Accessing Playwright API

You can access the Playwright Page object directly in function nodes:

```javascript
const page = msg._browserPage; // Available after any Playwright Automation node
// Use any Playwright Page API
const title = await page.title();
msg.payload = { title };
return msg;
```

### Handling Authentication

```javascript
// In a function node before navigation
msg._playwrightAuth = {
    username: 'user',
    password: 'pass',
    url: 'https://example.com/login'
};
return msg;
```

## Troubleshooting

- **Browser doesn't start**: Ensure all dependencies are installed correctly. Try running `npx playwright install`.
- **Element not found**: Make sure you're using the correct selector and the page has loaded completely.
- **Timeout errors**: Increase the wait timeout in the node's configuration.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Playwright](https://playwright.dev/) - Reliable end-to-end testing for modern web apps
- [Node-RED](https://nodered.org/) - Low-code programming for event-driven applications