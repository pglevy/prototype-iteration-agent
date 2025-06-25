// orchestrator.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import OpenAI from 'openai';
import { chromium } from 'playwright';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const execAsync = promisify(exec);

// Configuration
const CONFIG = {
  viteProjectPath: '../prototype', // Adjust to your Vite project path
  viteUrl: 'http://localhost:5173',
  openaiApiKey: process.env.OPENAI_API_KEY,
  maxIterations: 5,
  feedbackThreshold: 0.8 // 80% positive feedback to stop
};

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: CONFIG.openaiApiKey
});

class PrototypeOrchestrator {
  constructor() {
    this.currentIteration = 0;
    this.feedbackHistory = [];
  }

  async generatePrototype(designPrompt) {
    console.log('🎨 Generating prototype from prompt...');
    
    const systemPrompt = `You are a React TypeScript component generator. Create a complete, functional React TypeScript component based on the user's design prompt. 

CRITICAL INSTRUCTIONS:
- Return ONLY the raw TypeScript React code, no markdown formatting, no code blocks, no explanations
- Do NOT wrap the code in \`\`\`jsx or \`\`\`tsx or any other formatting
- The response should start directly with "import" and end with the component export
- Use TypeScript with proper type annotations
- Use modern React with hooks
- Include Tailwind CSS classes for styling
- Make it interactive and engaging
- Export as default
- Component should be self-contained
- Use semantic HTML elements

Example of correct format:
import React, { useState } from 'react';

interface Props {
  // types here
}

const ComponentName: React.FC<Props> = () => {
  // component code
  return (
    <div>content</div>
  );
};

export default ComponentName;`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: designPrompt }
      ],
      temperature: 0.7
    });

    let componentCode = response.choices[0].message.content.trim();
    
    // Strip markdown code blocks if they exist
    componentCode = componentCode.replace(/^```[\w]*\n/, '').replace(/\n```$/, '');
    
    // Remove any leading/trailing explanatory text
    const importMatch = componentCode.match(/(import[\s\S]*export default [^;]+;?)/);
    if (importMatch) {
      componentCode = importMatch[1];
    }
    
    // Write to Vite project (.tsx file)
    const componentPath = path.join(__dirname, CONFIG.viteProjectPath, 'src/components/GeneratedPrototype.tsx');
    await fs.writeFile(componentPath, componentCode);
    
    console.log('✅ Prototype generated and saved as .tsx');
    return componentCode;
  }

  async generateTestPlan(componentCode) {
    console.log('📋 Generating usability test plan...');
    
    const systemPrompt = `You are a UX testing expert. Create a comprehensive usability test plan for the React component provided.

CRITICAL: Return ONLY valid JSON, no explanations or additional text. The response must start with { and end with }.

Return a JSON object with this exact structure:
{
  "testScenarios": [
    {
      "name": "Test name",
      "description": "What to test",
      "steps": ["Step 1", "Step 2", "Step 3"],
      "expectedOutcome": "What should happen"
    }
  ],
  "usabilityChecks": [
    "Check 1",
    "Check 2"
  ],
  "accessibilityChecks": [
    "A11y check 1",
    "A11y check 2"
  ]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Component code:\n${componentCode}` }
      ],
      temperature: 0.1
    });

    let content = response.choices[0].message.content.trim();
    
    // Try to extract JSON if the response includes extra text
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      content = jsonMatch[0];
    }
    
    try {
      const testPlan = JSON.parse(content);
      console.log('✅ Test plan generated');
      return testPlan;
    } catch (error) {
      console.log('❌ Failed to parse test plan JSON, using fallback');
      console.log('Raw response:', content);
      
      // Fallback test plan
      return {
        testScenarios: [
          {
            name: "Basic interaction test",
            description: "Test basic UI interactions",
            steps: ["Click available buttons", "Fill any input fields", "Check for responses"],
            expectedOutcome: "UI should respond to user interactions"
          }
        ],
        usabilityChecks: [
          "Check if buttons are clickable",
          "Check if text is readable"
        ],
        accessibilityChecks: [
          "Check for alt text on images",
          "Check for proper heading structure"
        ]
      };
    }
  }

  async runPlaywrightTests(testPlan) {
    console.log('🧪 Running Playwright tests...');
    
    const browser = await chromium.launch({ headless: false }); // Set to true for headless
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      await page.goto(CONFIG.viteUrl);
      await page.waitForLoadState('networkidle');
      
      const testResults = [];
      
      // Take initial screenshot
      await page.screenshot({ path: `screenshots/iteration-${this.currentIteration}-initial.png` });
      
      // Run each test scenario
      for (const scenario of testPlan.testScenarios) {
        console.log(`  Running: ${scenario.name}`);
        
        try {
          // Basic interaction testing
          const interactions = await this.performInteractions(page, scenario);
          
          // Take screenshot after each test
          await page.screenshot({ 
            path: `screenshots/iteration-${this.currentIteration}-${scenario.name.replace(/\s+/g, '-')}.png` 
          });
          
          testResults.push({
            scenario: scenario.name,
            status: 'passed',
            interactions,
            screenshot: `screenshots/iteration-${this.currentIteration}-${scenario.name.replace(/\s+/g, '-')}.png`
          });
          
        } catch (error) {
          testResults.push({
            scenario: scenario.name,
            status: 'failed',
            error: error.message
          });
        }
      }
      
      // Accessibility checks
      const accessibilityResults = await this.checkAccessibility(page);
      
      await browser.close();
      
      return {
        testResults,
        accessibilityResults,
        screenshot: `screenshots/iteration-${this.currentIteration}-initial.png`
      };
      
    } catch (error) {
      await browser.close();
      throw error;
    }
  }

  async performInteractions(page, scenario) {
    const interactions = [];
    
    // Try to find and interact with common elements
    const buttons = await page.locator('button').count();
    const inputs = await page.locator('input').count();
    const links = await page.locator('a').count();
    
    interactions.push(`Found ${buttons} buttons, ${inputs} inputs, ${links} links`);
    
    // Try clicking buttons
    if (buttons > 0) {
      try {
        await page.locator('button').first().click();
        interactions.push('Successfully clicked first button');
        await page.waitForTimeout(1000); // Wait for any animations
      } catch (error) {
        interactions.push(`Button click failed: ${error.message}`);
      }
    }
    
    // Try filling inputs
    if (inputs > 0) {
      try {
        await page.locator('input').first().fill('Test input');
        interactions.push('Successfully filled first input');
      } catch (error) {
        interactions.push(`Input fill failed: ${error.message}`);
      }
    }
    
    return interactions;
  }

  async checkAccessibility(page) {
    const checks = [];
    
    // Check for alt text on images
    const imagesWithoutAlt = await page.locator('img:not([alt])').count();
    checks.push(`Images without alt text: ${imagesWithoutAlt}`);
    
    // Check for heading structure
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').count();
    checks.push(`Heading elements found: ${headings}`);
    
    // Check for form labels
    const unlabeledInputs = await page.locator('input:not([aria-label]):not([aria-labelledby])').count();
    checks.push(`Unlabeled inputs: ${unlabeledInputs}`);
    
    return checks;
  }

  async getLLMFeedback(testResults, testPlan) {
    console.log('🤖 Getting LLM feedback on test results...');
    
    const systemPrompt = `You are a UX testing expert analyzing test results. Provide structured feedback on the prototype's usability.

CRITICAL: Return ONLY valid JSON, no explanations or additional text. The response must start with { and end with }.

Return a JSON object with this exact structure:
{
  "overallScore": 0.85,
  "positives": ["Good thing 1", "Good thing 2"],
  "issues": ["Issue 1", "Issue 2"],
  "improvements": ["Suggestion 1", "Suggestion 2"],
  "reasoning": "Detailed explanation of the score"
}

Score should be between 0 and 1 (e.g., 0.85 for 85%).`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Test Plan: ${JSON.stringify(testPlan, null, 2)}\n\nTest Results: ${JSON.stringify(testResults, null, 2)}` }
      ],
      temperature: 0.1
    });

    let content = response.choices[0].message.content.trim();
    
    // Try to extract JSON if the response includes extra text
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      content = jsonMatch[0];
    }
    
    try {
      const feedback = JSON.parse(content);
      console.log(`📊 Feedback score: ${feedback.overallScore}`);
      return feedback;
    } catch (error) {
      console.log('❌ Failed to parse feedback JSON, using fallback');
      console.log('Raw response:', content);
      
      // Fallback feedback
      return {
        overallScore: 0.5,
        positives: ["Component loads successfully"],
        issues: ["Unable to analyze detailed feedback"],
        improvements: ["Try regenerating with clearer requirements"],
        reasoning: "Fallback response due to JSON parsing error"
      };
    }
  }

  async improvePrototype(currentCode, feedback) {
    console.log('🔧 Improving prototype based on feedback...');
    
    const systemPrompt = `You are a React TypeScript developer improving a component based on UX feedback. 

CRITICAL INSTRUCTIONS:
- Return ONLY the raw TypeScript React code, no markdown formatting, no code blocks, no explanations
- Do NOT wrap the code in \`\`\`jsx or \`\`\`tsx or any other formatting
- The response should start directly with "import" and end with the component export
- Keep the core functionality intact
- Address the specific issues mentioned in the feedback
- Implement the suggested improvements
- Use modern React patterns and Tailwind CSS
- Use TypeScript with proper type annotations

Current issues to address:
${feedback.issues.join('\n')}

Suggested improvements:
${feedback.improvements.join('\n')}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Current component code:\n${currentCode}` }
      ],
      temperature: 0.3
    });

    let improvedCode = response.choices[0].message.content.trim();
    
    // Strip markdown code blocks if they exist
    improvedCode = improvedCode.replace(/^```[\w]*\n/, '').replace(/\n```$/, '');
    
    // Remove any leading/trailing explanatory text
    const importMatch = improvedCode.match(/(import[\s\S]*export default [^;]+;?)/);
    if (importMatch) {
      improvedCode = importMatch[1];
    }
    
    // Write improved version to Vite project (.tsx file)
    const componentPath = path.join(__dirname, CONFIG.viteProjectPath, 'src/components/GeneratedPrototype.tsx');
    await fs.writeFile(componentPath, improvedCode);
    
    console.log('✅ Prototype improved and saved as .tsx');
    return improvedCode;
  }

  async runWorkflow(designPrompt) {
    console.log('🚀 Starting agentic prototyping workflow...');
    console.log(`Design prompt: ${designPrompt}\n`);
    
    // Create screenshots directory
    await fs.mkdir('screenshots', { recursive: true });
    
    let currentCode = await this.generatePrototype(designPrompt);
    
    for (let i = 0; i < CONFIG.maxIterations; i++) {
      this.currentIteration = i + 1;
      console.log(`\n🔄 Iteration ${this.currentIteration}/${CONFIG.maxIterations}`);
      
      // Wait a moment for Vite to reload
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const testPlan = await this.generateTestPlan(currentCode);
      const testResults = await this.runPlaywrightTests(testPlan);
      const feedback = await this.getLLMFeedback(testResults, testPlan);
      
      this.feedbackHistory.push({
        iteration: this.currentIteration,
        score: feedback.overallScore,
        feedback
      });
      
      console.log(`\n📊 Iteration ${this.currentIteration} Results:`);
      console.log(`Score: ${feedback.overallScore}`);
      console.log(`Positives: ${feedback.positives.join(', ')}`);
      console.log(`Issues: ${feedback.issues.join(', ')}`);
      
      // Check if we've reached the threshold
      if (feedback.overallScore >= CONFIG.feedbackThreshold) {
        console.log(`\n🎉 Success! Reached feedback threshold of ${CONFIG.feedbackThreshold}`);
        break;
      }
      
      // Improve for next iteration
      if (i < CONFIG.maxIterations - 1) {
        currentCode = await this.improvePrototype(currentCode, feedback);
      }
    }
    
    console.log('\n📈 Final Results:');
    this.feedbackHistory.forEach(entry => {
      console.log(`Iteration ${entry.iteration}: ${entry.score}`);
    });
    
    // Save final report
    const report = {
      designPrompt,
      iterations: this.feedbackHistory,
      finalCode: currentCode
    };
    
    await fs.writeFile('final-report.json', JSON.stringify(report, null, 2));
    console.log('📄 Final report saved to final-report.json');
  }
}

// Usage
async function main() {
  const orchestrator = new PrototypeOrchestrator();
  
  const designPrompt = process.argv[2] || "Create a modern todo list app with add, delete, and mark complete functionality. Use a clean, minimalist design with good spacing and hover effects.";
  
  try {
    await orchestrator.runWorkflow(designPrompt);
  } catch (error) {
    console.error('❌ Workflow failed:', error);
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}