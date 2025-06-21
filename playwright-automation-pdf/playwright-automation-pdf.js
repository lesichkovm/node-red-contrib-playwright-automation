const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { URL } = require('url');

// Function to validate URL
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// Function to execute Playwright PDF generation
async function executePlaywrightPDF(pythonPath, options) {
    return new Promise((resolve, reject) => {
        const tempFile = path.join(os.tmpdir(), `playwright-pdf-${Date.now()}.py`);
        
        // Prepare options as a JSON string with proper escaping
        const optionsStr = JSON.stringify({
            url: options.url,
            waitUntil: options.waitUntil,
            format: options.format,
            margin: options.margin,
            printBackground: options.printBackground,
            displayHeaderFooter: options.displayHeaderFooter,
            headerTemplate: options.headerTemplate || '',
            footerTemplate: options.footerTemplate || '',
            preferCSSPageSize: options.preferCSSPageSize,
            landscape: options.landscape
        }).replace(/'/g, '\\\'');
        
        const scriptContent = `import asyncio
from playwright.async_api import async_playwright
import json
import base64
import sys

async def main():
    try:
        # Parse options from JSON string
        options = json.loads('''${optionsStr}''')
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            
            # Navigate to the URL
            await page.goto(options['url'], wait_until=options['waitUntil'])
            
            # Prepare PDF options
            pdf_options = {
                'format': options.get('format', 'A4'),
                'print_background': options.get('printBackground', True),
                'display_header_footer': options.get('displayHeaderFooter', False),
                'prefer_css_page_size': options.get('preferCSSPageSize', False),
                'landscape': options.get('landscape', False)
            }
            
            # Add margin if provided
            if options.get('margin') and isinstance(options['margin'], dict):
                pdf_options['margin'] = options['margin']
                
            # Add header/footer templates if provided
            if options.get('headerTemplate'):
                pdf_options['header_template'] = options['headerTemplate']
            if options.get('footerTemplate'):
                pdf_options['footer_template'] = options['footerTemplate']
            
            # Generate PDF with the prepared options
            pdf_buffer = await page.pdf(**pdf_options)
            
            # Get the title before closing the browser
            title = await page.title()
            
            await browser.close()
            
            # Return the base64-encoded PDF content
            print('__PLAYWRIGHT_PDF_RESULT_START__' + base64.b64encode(pdf_buffer).decode('utf-8') + '__PLAYWRIGHT_PDF_RESULT_END__')
            
    except Exception as e:
        # Return the error message
        print('__PLAYWRIGHT_PDF_RESULT_START__' + str(e) + '__PLAYWRIGHT_PDF_RESULT_END__')

if __name__ == '__main__':
    asyncio.run(main())`;

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
                    console.log(`Using Python executable from virtual environment: ${pythonExecutable}`);
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
        
        // Execute the script
        console.log(`Executing Python script with: ${pythonExecutable}`);
        const pythonProcess = spawn(pythonExecutable, [tempFile], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let output = '';
        let errorOutput = '';

        pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        pythonProcess.on('close', (code) => {
            // Clean up the temporary file
            try {
                if (fs.existsSync(tempFile)) {
                    fs.unlinkSync(tempFile);
                }
            } catch (e) {
                console.error('Error cleaning up temp file:', e);
            }

            if (code !== 0) {
                return reject(new Error(`Python script exited with code ${code}: ${errorOutput}`));
            }

            resolve(output);
        });
    });
}

// Node-RED node definition
module.exports = function(RED) {
    function PlaywrightPDFNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        // Parse margin JSON or use empty object if invalid
        let margin = {};
        try {
            margin = JSON.parse(config.margin || '{}');
        } catch (e) {
            node.warn('Invalid margin JSON, using default');
        }

        node.on('input', async function(msg) {
            try {
                // Get parameters from msg or use node config
                const url = msg.url || config.url || '';
                if (!url) {
                    throw new Error('URL is required');
                }
                
                if (!isValidUrl(url)) {
                    throw new Error('Invalid URL format');
                }

                const pythonPath = msg.pythonPath || config.pythonPath || 'python3';
                
                // Prepare options for PDF generation with proper fallbacks
                const options = {
                    url: url,
                    waitUntil: msg.waitUntil || config.waitUntil || 'load',
                    format: msg.format || config.format || 'A4',
                    margin: msg.margin || margin,
                    printBackground: msg.printBackground !== undefined ? 
                        msg.printBackground : (config.printBackground !== undefined ? config.printBackground : true),
                    displayHeaderFooter: msg.displayHeaderFooter !== undefined ? 
                        msg.displayHeaderFooter : (config.displayHeaderFooter !== undefined ? config.displayHeaderFooter : false),
                    headerTemplate: (msg.headerTemplate !== undefined ? 
                        msg.headerTemplate : (config.headerTemplate !== undefined ? config.headerTemplate : '')),
                    footerTemplate: (msg.footerTemplate !== undefined ? 
                        msg.footerTemplate : (config.footerTemplate !== undefined ? config.footerTemplate : '')),
                    preferCSSPageSize: msg.preferCSSPageSize !== undefined ? 
                        msg.preferCSSPageSize : (config.preferCSSPageSize !== undefined ? config.preferCSSPageSize : false),
                    landscape: msg.landscape !== undefined ? 
                        msg.landscape : (config.landscape !== undefined ? config.landscape : false)
                };
                
                // Ensure margin is an object
                if (typeof options.margin === 'string') {
                    try {
                        options.margin = JSON.parse(options.margin);
                    } catch (e) {
                        options.margin = {};
                    }
                }
                
                // Execute Playwright to generate PDF
                const result = await executePlaywrightPDF(pythonPath, options);
                
                // Extract the result between markers
                const resultMatch = result.match(/__PLAYWRIGHT_PDF_RESULT_START__([\s\S]*?)__PLAYWRIGHT_PDF_RESULT_END__/);
                if (!resultMatch) {
                    throw new Error('Could not find result in output.');
                }

                const pdfContent = resultMatch[1].trim();
                
                // On success, the content is the base64-encoded PDF
                msg.payload = pdfContent;
                node.send([msg, null]);
                
            } catch (error) {
                // Prepare error message
                msg.payload = {
                    success: false,
                    error: error.message,
                    url: msg.url || config.url || ''
                };
                
                // Log the error
                node.error(error, msg);
                
                // Send to second output (error)
                node.send([null, msg]);
            }
        });
        
        // Clean up when node is removed
        node.on('close', function() {
            node.log("Playwright PDF node is being closed");
        });
    }
    
    // Register the node with Node-RED
    RED.nodes.registerType("playwright-automation-pdf", PlaywrightPDFNode);
};
