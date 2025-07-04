// orchestrator.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import OpenAI from 'openai';
import { chromium } from 'playwright';
import dotenv from 'dotenv';
import readline from 'readline';

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
  feedbackThreshold: 0.8, // 80% positive feedback to stop
  allowHumanInput: true // Allow human to continue past threshold
};

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: CONFIG.openaiApiKey
});

class PrototypeOrchestrator {
  constructor() {
    this.currentIteration = 0;
    this.feedbackHistory = [];
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async askHumanInput(feedback, visualFeedback) {
    if (!CONFIG.allowHumanInput) return false;
    
    console.log('\n🤔 Threshold reached, but there are still some areas for improvement:');
    
    if (feedback.issues && feedback.issues.length > 0) {
      console.log('\n📋 UX Issues identified:');
      feedback.issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
    }
    
    if (visualFeedback.designIssues && visualFeedback.designIssues.length > 0) {
      console.log('\n🎨 Visual Design Issues identified:');
      visualFeedback.designIssues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
    }
    
    if (feedback.improvements && feedback.improvements.length > 0) {
      console.log('\n💡 Suggested UX Improvements:');
      feedback.improvements.forEach((improvement, i) => console.log(`  ${i + 1}. ${improvement}`));
    }
    
    if (visualFeedback.designImprovements && visualFeedback.designImprovements.length > 0) {
      console.log('\n🎯 Suggested Visual Improvements:');
      visualFeedback.designImprovements.forEach((improvement, i) => console.log(`  ${i + 1}. ${improvement}`));
    }
    
    console.log('\n');
    
    return new Promise((resolve) => {
      this.rl.question('Would you like to run another iteration to address these issues? (y/N): ', (answer) => {
        const shouldContinue = answer.toLowerCase().startsWith('y');
        if (!shouldContinue) {
          console.log('✅ Proceeding with current prototype.');
        } else {
          console.log('🔄 Running additional iteration...');
        }
        resolve(shouldContinue);
      });
    });
  }

  closeInput() {
    this.rl.close();
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

  async getVisualDesignFeedback(screenshotPath, designPrompt) {
    console.log('🎨 Getting visual design feedback...');
    
    try {
      const imageBuffer = await fs.readFile(screenshotPath);
      const base64Image = imageBuffer.toString('base64');
      
      const systemPrompt = `You are a UI/UX design expert analyzing a screenshot of a web interface. Provide detailed visual design feedback focusing on:

- Visual hierarchy and layout
- Typography and readability
- Color scheme and contrast
- Spacing and alignment
- Component design and consistency
- Overall aesthetic appeal
- Accessibility considerations

CRITICAL: Return ONLY valid JSON, no explanations or additional text. The response must start with { and end with }.

Return a JSON object with this exact structure:
{
  "visualScore": 0.85,
  "designPositives": ["Good visual aspect 1", "Good visual aspect 2"],
  "designIssues": ["Visual issue 1", "Visual issue 2"],
  "designImprovements": ["Visual suggestion 1", "Visual suggestion 2"],
  "visualReasoning": "Detailed explanation of the visual design score"
}

Score should be between 0 and 1 (e.g., 0.85 for 85%).`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: [
              {
                type: "text",
                text: `Design prompt: ${designPrompt}\n\nPlease analyze this screenshot and provide visual design feedback.`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${base64Image}`
                }
              }
            ]
          }
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
        console.log(`🎨 Visual design score: ${feedback.visualScore}`);
        return feedback;
      } catch (error) {
        console.log('❌ Failed to parse visual feedback JSON, using fallback');
        console.log('Raw response:', content);
        
        return {
          visualScore: 0.5,
          designPositives: ["Interface is visible and rendered"],
          designIssues: ["Unable to analyze visual details"],
          designImprovements: ["Ensure proper visual hierarchy"],
          visualReasoning: "Fallback response due to JSON parsing error"
        };
      }
    } catch (error) {
      console.log('❌ Error analyzing screenshot:', error.message);
      return {
        visualScore: 0.3,
        designPositives: [],
        designIssues: ["Screenshot could not be analyzed"],
        designImprovements: ["Ensure screenshot is properly captured"],
        visualReasoning: "Could not analyze screenshot"
      };
    }
  }

  async getLLMFeedback(testResults, testPlan, visualFeedback = null) {
    console.log('🤖 Getting LLM feedback on test results...');
    
    const systemPrompt = `You are a UX testing expert analyzing test results and visual design feedback. Provide structured feedback on the prototype's usability.

CRITICAL: Return ONLY valid JSON, no explanations or additional text. The response must start with { and end with }.

Return a JSON object with this exact structure:
{
  "overallScore": 0.85,
  "positives": ["Good thing 1", "Good thing 2"],
  "issues": ["Issue 1", "Issue 2"],
  "improvements": ["Suggestion 1", "Suggestion 2"],
  "reasoning": "Detailed explanation of the score"
}

Score should be between 0 and 1 (e.g., 0.85 for 85%). Consider both functional testing results and visual design feedback if provided.`;

    const userContent = `Test Plan: ${JSON.stringify(testPlan, null, 2)}\n\nTest Results: ${JSON.stringify(testResults, null, 2)}${visualFeedback ? `\n\nVisual Design Feedback: ${JSON.stringify(visualFeedback, null, 2)}` : ''}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
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

  async improvePrototype(currentCode, feedback, visualFeedback) {
    console.log('🔧 Improving prototype based on feedback...');
    
    const systemPrompt = `You are a React TypeScript developer improving a component based on UX and visual design feedback. 

CRITICAL INSTRUCTIONS:
- Return ONLY the raw TypeScript React code, no markdown formatting, no code blocks, no explanations
- Do NOT wrap the code in \`\`\`jsx or \`\`\`tsx or any other formatting
- The response should start directly with "import" and end with the component export
- Keep the core functionality intact
- Address the specific issues mentioned in both UX and visual feedback
- Implement the suggested improvements for both usability and visual design
- Use modern React patterns and Tailwind CSS
- Use TypeScript with proper type annotations

UX Issues to address:
${feedback.issues.join('\n')}

UX Improvements:
${feedback.improvements.join('\n')}

Visual Design Issues to address:
${visualFeedback.designIssues.join('\n')}

Visual Design Improvements:
${visualFeedback.designImprovements.join('\n')}`;

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

  async runWorkflow(designPrompt, skipGeneration = false) {
    console.log('🚀 Starting agentic prototyping workflow...');
    console.log(`Design prompt: ${designPrompt}\n`);
    
    // Create screenshots directory
    await fs.mkdir('screenshots', { recursive: true });
    
    let currentCode;
    if (skipGeneration) {
      console.log('⏭️ Skipping prototype generation, using existing component...');
      // Read existing component
      const componentPath = path.join(__dirname, CONFIG.viteProjectPath, 'src/components/GeneratedPrototype.tsx');
      try {
        currentCode = await fs.readFile(componentPath, 'utf8');
        console.log('✅ Using existing prototype component');
      } catch (error) {
        console.log('❌ No existing component found, generating new one...');
        currentCode = await this.generatePrototype(designPrompt);
      }
    } else {
      currentCode = await this.generatePrototype(designPrompt);
    }
    
    for (let i = 0; i < CONFIG.maxIterations; i++) {
      this.currentIteration = i + 1;
      console.log(`\n🔄 Iteration ${this.currentIteration}/${CONFIG.maxIterations}`);
      
      // Wait a moment for Vite to reload
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const testPlan = await this.generateTestPlan(currentCode);
      const testResults = await this.runPlaywrightTests(testPlan);
      const visualFeedback = await this.getVisualDesignFeedback(testResults.screenshot, designPrompt);
      const feedback = await this.getLLMFeedback(testResults, testPlan, visualFeedback);
      
      this.feedbackHistory.push({
        iteration: this.currentIteration,
        score: feedback.overallScore,
        feedback,
        visualFeedback
      });
      
      console.log(`\n📊 Iteration ${this.currentIteration} Results:`);
      console.log(`Overall Score: ${feedback.overallScore}`);
      console.log(`Visual Score: ${visualFeedback.visualScore}`);
      console.log(`Positives: ${feedback.positives.join(', ')}`);
      console.log(`Issues: ${feedback.issues.join(', ')}`);
      console.log(`Visual Issues: ${visualFeedback.designIssues.join(', ')}`);
      
      // Check if we've reached the threshold
      if (feedback.overallScore >= CONFIG.feedbackThreshold) {
        console.log(`\n🎉 Success! Reached feedback threshold of ${CONFIG.feedbackThreshold}`);
        
        // Check if there are still issues and ask human if they want to continue
        const hasIssues = (feedback.issues && feedback.issues.length > 0) || 
                         (visualFeedback.designIssues && visualFeedback.designIssues.length > 0);
        
        if (hasIssues && i < CONFIG.maxIterations - 1) {
          const shouldContinue = await this.askHumanInput(feedback, visualFeedback);
          if (!shouldContinue) {
            break;
          }
        } else {
          break;
        }
      }
      
      // Improve for next iteration
      if (i < CONFIG.maxIterations - 1) {
        currentCode = await this.improvePrototype(currentCode, feedback, visualFeedback);
      }
    }
    
    console.log('\n📈 Final Results:');
    this.feedbackHistory.forEach(entry => {
      console.log(`Iteration ${entry.iteration}: ${entry.score}`);
    });
    
    // Close readline interface
    this.closeInput();
    
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
  const skipGeneration = process.argv.includes('--skip-generation') || process.argv.includes('-s');
  const noHumanInput = process.argv.includes('--no-human-input') || process.argv.includes('-n');
  
  // Override config if flag is provided
  if (noHumanInput) {
    CONFIG.allowHumanInput = false;
  }
  
  try {
    await orchestrator.runWorkflow(designPrompt, skipGeneration);
  } catch (error) {
    console.error('❌ Workflow failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}