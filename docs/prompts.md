# Prompts

## Initial

I want to set up an agentic prototyping workflow that looks something like this:
* Designer enters prompt to generate React prototype
* Designer asks LLM to write usability test plan
* LLM runs usability test with another Testing LLM (that is able to interact with prototype)
* Testing LLM gives feedback and original LLM makes changes to prototype and re-tests
* Loop continues until some threshold of positive feedback is received

What sort of tech stack should I use to set this up? And how should I proceed. (I have familiarity with tools like Claude Code, OpenAI API, Amazon Q, and Ollama.)

## Follow-ups

For the hosting, I'm currently using a vite project to run prototypes locally. Can I use that and avoid the Vercel hosting step?

Cool, I like that approach. I'll need help generating the Node.js orchestrator script and setting up and using Playwright (I haven't used this before.)

I read through orchestrator.js. Can you explain to me how the "testing LLM" is used? I'm not clear on the interaction between that and Playwright.

I set up the api key in the .env file. but it says it's missing or empty.

Workflow failed:

```
Workflow failed: SyntaxError: Unexpected token 'H', "Here is th"... is not valid JSON
    at JSON.parse (<anonymous>)
    at PrototypeOrchestrator.generateTestPlan (file:///Users/philip.levy/Documents/GitHub/pglevy/prototype-iteration-agent/orchestrator/orchestrator.js:105:27)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async PrototypeOrchestrator.runWorkflow (file:///Users/philip.levy/Documents/GitHub/pglevy/prototype-iteration-agent/orchestrator/orchestrator.js:305:24)
    at async main (file:///Users/philip.levy/Documents/GitHub/pglevy/prototype-iteration-agent/orchestrator/orchestrator.js:356:5)
```

actually, I'm using .tsx files in my vite project. I updated the suffixes, but I see that the LLM is not writing straight code to the GeneratedPrototype file. It's adding comments (see below). Can you address that, but also make sure it knows it's writing to a .tsx file?

what changes would I need to make to use the Anthropic API instead of OpenAI?