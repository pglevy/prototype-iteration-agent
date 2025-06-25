# Agentic Prototype Testing Setup Guide

## 1. Initial Setup

### Create the orchestrator directory
```bash
mkdir prototype-orchestrator
cd prototype-orchestrator
npm init -y
```

### Install dependencies
```bash
npm install openai playwright dotenv
npx playwright install chromium
```

### Update package.json to use ES modules
Add this to your `package.json`:
```json
{
  "type": "module",
  "scripts": {
    "start": "node orchestrator.js",
    "test": "node orchestrator.js"
  }
}
```

## 2. Environment Setup

### Create `.env` file
```bash
# .env
OPENAI_API_KEY=your_openai_api_key_here
```

### Update the orchestrator configuration
In `orchestrator.js`, update the `CONFIG` object:
```javascript
const CONFIG = {
  viteProjectPath: '../your-actual-vite-project-name', // Update this path!
  viteUrl: 'http://localhost:5173', // Update if your Vite runs on different port
  openaiApiKey: process.env.OPENAI_API_KEY,
  maxIterations: 5,
  feedbackThreshold: 0.8
};
```

## 3. Vite Project Setup

### Make sure your Vite project has the route
Update your `App.jsx` to include the generated prototype:
```jsx
import GeneratedPrototype from './components/GeneratedPrototype'

function App() {
  return (
    <div className="App">
      <GeneratedPrototype />
    </div>
  )
}
```

### Create placeholder component
Create `src/components/GeneratedPrototype.tsx`:
```tsx
export default function GeneratedPrototype() {
  return (
    <div className="p-8">
      <h1>Generated Prototype Will Appear Here</h1>
      <p>Run the orchestrator to generate your first prototype!</p>
    </div>
  )
}
```

## 4. Directory Structure
```
your-workspace/
├── your-vite-project/          # Your existing Vite project
│   ├── src/
│   │   ├── components/
│   │   │   └── GeneratedPrototype.tsx
│   │   └── App.jsx
│   └── package.json
└── prototype-orchestrator/     # New orchestrator
    ├── orchestrator.js
    ├── package.json
    ├── .env
    └── screenshots/           # Will be created automatically
```

## 5. Running the Workflow

### Start your Vite dev server
```bash
cd your-vite-project
npm run dev
```

### In another terminal, run the orchestrator
```bash
cd prototype-orchestrator
npm start
```

### Or with a custom prompt
```bash
node orchestrator.js "Create a user profile card with avatar, name, bio, and social links"
```

## 6. What Happens During Execution

1. **Generation**: LLM creates React component → saves to your Vite project
2. **Auto-reload**: Vite hot-reloads the new component
3. **Testing**: Playwright opens browser → interacts with your localhost
4. **Feedback**: Testing LLM analyzes interactions → provides scored feedback
5. **Iteration**: If score < threshold, LLM improves the component
6. **Repeat**: Until threshold met or max iterations reached

## 7. Outputs

- **Screenshots**: `screenshots/` folder with visual progression
- **Final Report**: `final-report.json` with complete iteration history
- **Updated Component**: Your Vite project will have the final version

## 8. Customization Options

### Adjust feedback threshold
```javascript
feedbackThreshold: 0.7 // Lower = easier to satisfy
```

### Change max iterations
```javascript
maxIterations: 3 // Fewer iterations for faster testing
```

### Run in headless mode
```javascript
// In runPlaywrightTests method
const browser = await chromium.launch({ headless: true });
```

### Add custom test scenarios
Modify the `generateTestPlan` method to include domain-specific tests.

## 9. Troubleshooting

### Common Issues:
- **Port conflicts**: Make sure Vite is running on the expected port
- **File path errors**: Double-check the `viteProjectPath` in CONFIG
- **OpenAI API**: Ensure your API key is valid and has sufficient credits
- **Playwright**: If browser doesn't launch, try `npx playwright install`

### Debug Mode:
Set `headless: false` in Playwright config to watch the browser interactions in real-time.