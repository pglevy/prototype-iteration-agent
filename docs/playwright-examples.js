// playwright-examples.js
// This file shows common Playwright patterns you can use to customize testing

import { chromium } from 'playwright';

// Basic Playwright patterns for UI testing
export class PlaywrightTestPatterns {
  
  // Element interaction examples
  async basicInteractions(page) {
    // Click elements
    await page.click('button');                    // First button
    await page.click('button:has-text("Submit")'); // Button with specific text
    await page.click('[data-testid="submit-btn"]'); // Button with test ID
    
    // Fill forms
    await page.fill('input[type="text"]', 'Hello World');
    await page.fill('input[placeholder="Email"]', 'test@example.com');
    await page.selectOption('select', 'option-value');
    
    // Check/uncheck
    await page.check('input[type="checkbox"]');
    await page.uncheck('input[type="checkbox"]');
    
    // Hover and focus
    await page.hover('.menu-item');
    await page.focus('input');
    
    // Press keys
    await page.press('input', 'Enter');
    await page.press('body', 'Escape');
  }

  // Waiting strategies
  async waitingStrategies(page) {
    // Wait for elements
    await page.waitForSelector('button');
    await page.waitForSelector('.loading', { state: 'hidden' });
    
    // Wait for network
    await page.waitForLoadState('networkidle');
    await page.waitForResponse('**/api/data');
    
    // Wait for conditions
    await page.waitForFunction(() => window.myApp.loaded);
    await page.waitForTimeout(1000); // Use sparingly
  }

  // Data extraction
  async extractData(page) {
    // Get text content
    const title = await page.textContent('h1');
    const allButtons = await page.locator('button').allTextContents();
    
    // Get attributes
    const href = await page.getAttribute('a', 'href');
    const isDisabled = await page.isDisabled('button');
    const isVisible = await page.isVisible('.modal');
    
    // Count elements
    const buttonCount = await page.locator('button').count();
    
    // Get input values
    const inputValue = await page.inputValue('input[name="username"]');
    
    return {
      title,
      allButtons,
      href,
      isDisabled,
      isVisible,
      buttonCount,
      inputValue
    };
  }

  // Screenshots and visual testing
  async visualTesting(page) {
    // Full page screenshot
    await page.screenshot({ path: 'full-page.png' });
    
    // Element screenshot
    await page.locator('.component').screenshot({ path: 'component.png' });
    
    // Screenshot with options
    await page.screenshot({ 
      path: 'desktop.png',
      fullPage: true,
      clip: { x: 0, y: 0, width: 1200, height: 800 }
    });
  }

  // Advanced interactions
  async advancedInteractions(page) {
    // Drag and drop
    await page.dragAndDrop('.draggable', '.drop-zone');
    
    // File upload
    await page.setInputFiles('input[type="file"]', 'path/to/file.txt');
    
    // Handle dialogs
    page.on('dialog', dialog => dialog.accept());
    
    // Multiple tabs
    const [newPage] = await Promise.all([
      page.context().waitForEvent('page'),
      page.click('a[target="_blank"]')
    ]);
    
    // Scroll
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  }

  // Custom test scenarios for your workflow
  async testUserFlow(page, scenario) {
    console.log(`Testing: ${scenario.name}`);
    
    try {
      // Example: Test a form submission flow
      if (scenario.name.includes('form')) {
        return await this.testFormFlow(page);
      }
      
      // Example: Test navigation flow
      if (scenario.name.includes('navigation')) {
        return await this.testNavigationFlow(page);
      }
      
      // Example: Test interactive components
      if (scenario.name.includes('interactive')) {
        return await this.testInteractiveFlow(page);
      }
      
      // Default: Try to interact with common elements
      return await this.testGenericFlow(page);
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        screenshot: await page.screenshot({ path: `error-${Date.now()}.png` })
      };
    }
  }

  async testFormFlow(page) {
    const results = [];
    
    // Find all inputs and try to fill them
    const inputs = await page.locator('input').all();
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const type = await input.getAttribute('type');
      const placeholder = await input.getAttribute('placeholder');
      
      if (type === 'email') {
        await input.fill('test@example.com');
        results.push('Filled email input');
      } else if (type === 'password') {
        await input.fill('password123');
        results.push('Filled password input');
      } else if (type === 'text') {
        await input.fill(placeholder || 'Test input');
        results.push(`Filled text input: ${placeholder || 'unnamed'}`);
      }
    }
    
    // Try to submit
    const submitBtn = page.locator('button[type="submit"], button:has-text("submit")').first();
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
      results.push('Clicked submit button');
      
      // Wait for any response
      await page.waitForTimeout(1000);
    }
    
    return { success: true, actions: results };
  }

  async testNavigationFlow(page) {
    const results = [];
    
    // Find and click navigation links
    const navLinks = await page.locator('nav a, .nav a, [role="navigation"] a').all();
    
    for (let link of navLinks.slice(0, 3)) { // Test first 3 links
      const text = await link.textContent();
      const href = await link.getAttribute('href');
      
      if (href && !href.startsWith('http')) { // Internal link
        await link.click();
        results.push(`Navigated to: ${text}`);
        await page.waitForLoadState('networkidle');
        
        // Go back for next test
        await page.goBack();
        await page.waitForLoadState('networkidle');
      }
    }
    
    return { success: true, actions: results };
  }

  async testInteractiveFlow(page) {
    const results = [];
    
    // Test buttons
    const buttons = await page.locator('button:not([disabled])').all();
    for (let button of buttons.slice(0, 5)) { // Test first 5 buttons
      const text = await button.textContent();
      await button.click();
      results.push(`Clicked button: ${text?.trim()}`);
      await page.waitForTimeout(500); // Wait for any animations
    }
    
    // Test toggles/switches
    const checkboxes = await page.locator('input[type="checkbox"]').all();
    for (let checkbox of checkboxes) {
      await checkbox.click();
      results.push('Toggled checkbox');
    }
    
    // Test dropdowns
    const selects = await page.locator('select').all();
    for (let select of selects) {
      const options = await select.locator('option').all();
      if (options.length > 1) {
        await select.selectOption({ index: 1 });
        results.push('Selected dropdown option');
      }
    }
    
    return { success: true, actions: results };
  }

  async testGenericFlow(page) {
    const results = [];
    
    // Get page info
    const title = await page.title();
    const url = page.url();
    results.push(`Page loaded: ${title} at ${url}`);
    
    // Count interactive elements
    const buttonCount = await page.locator('button').count();
    const linkCount = await page.locator('a').count();
    const inputCount = await page.locator('input').count();
    
    results.push(`Found ${buttonCount} buttons, ${linkCount} links, ${inputCount} inputs`);
    
    // Try basic interactions
    if (buttonCount > 0) {
      await page.locator('button').first().click();
      results.push('Clicked first button');
    }
    
    if (inputCount > 0) {
      await page.locator('input').first().fill('Test');
      results.push('Filled first input');
    }
    
    return { success: true, actions: results };
  }

  // Accessibility testing helpers
  async checkAccessibility(page) {
    const issues = [];
    
    // Check for missing alt text
    const imagesWithoutAlt = await page.locator('img:not([alt])').count();
    if (imagesWithoutAlt > 0) {
      issues.push(`${imagesWithoutAlt} images missing alt text`);
    }
    
    // Check for proper heading hierarchy
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents();
    if (headings.length === 0) {
      issues.push('No heading elements found');
    }
    
    // Check for form labels
    const unlabeledInputs = await page.locator('input:not([aria-label]):not([aria-labelledby])').count();
    if (unlabeledInputs > 0) {
      issues.push(`${unlabeledInputs} inputs without labels`);
    }
    
    // Check for button text
    const emptyButtons = await page.locator('button:empty:not([aria-label])').count();
    if (emptyButtons > 0) {
      issues.push(`${emptyButtons} buttons without text or labels`);
    }
    
    // Check for focus indicators (basic check)
    const focusableElements = await page.locator('button, a, input, select, textarea').count();
    
    return {
      totalIssues: issues.length,
      issues,
      focusableElements,
      score: Math.max(0, 1 - (issues.length * 0.1)) // Simple scoring
    };
  }
}

// Example usage in your orchestrator:
// const testPatterns = new PlaywrightTestPatterns();
// const results = await testPatterns.testUserFlow(page, scenario);