# Enhanced Prompt: Agentic Application Development Guidelines

-   **Build Generic Agentic Applications**
    -   Do **not** hardcode logic or workflows.\
    -   Always follow instruction-driven design (LLM interprets goals,
        not rigid code).
    - no fallback code. If there is error - throw error.
    - **No hardcoded logic patterns**:
        - No if/else branches based on content analysis
        - No template selection logic  
        - No validation rule engines
        - No pattern matching or classification logic
    - **Single instruction principle**: One clear instruction to LLM, let AI interpret and execute
    - **LLM-first approach**: When in doubt, ask LLM rather than code logic
-   **Environment Setup**
    -   Always use `venv` for isolated environments.\
    -   Ensure dependencies are declared in `requirements.txt`.\
    -   Use **environment variables** (via `.env` + `python-dotenv` or
        system env) for all secrets and configs.\
    -   Never hardcode API keys, database credentials, or connection
        info in code.
-   **OpenAI API Usage**
    -   Always use the **Responses API** (`client.responses.create`) --
        no legacy endpoints.\
    -   Prefer **streaming responses** whenever supported.
    -   Use model from `os.getenv("OPENAI_MODEL"). Donot add default value.
-   **Code Example (Baseline)**\

``` python
import os
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

response = client.responses.create(
    model="gpt-4o-mini",
    input="Write a one-sentence bedtime story about a unicorn."
)

print(response.output_text)
```

-   **Streaming (Preferred)**
    -   Implement streaming with `client.responses.stream` for real-time
        token handling.\
    -   Follow latest docs: [OpenAI Quickstart -- Responses API
        (Python)](https://platform.openai.com/docs/quickstart?api-mode=responses&lang=python&tool-type=remote-mcp).
-   **General Principles**
    -   Keep workflows **instructional and composable**.\
    -   Minimize assumptions; let LLM drive execution logic.\
    -   Separate orchestration from execution (agent coordinates, tools
        execute).
    -   **Trust LLM capabilities**: Don't second-guess with additional logic layers
    -   **Instruction clarity over code complexity**: Better prompt beats smarter code
    -   **When tempted to add logic, add instruction instead**

## Anti-Patterns to Avoid
-   **Template Systems**: Don't create template selection based on context analysis
-   **Rule Engines**: Don't build validation or classification rule systems  
-   **Smart Logic**: Don't add "intelligent" if/else branches
-   **Content Analysis**: Don't parse/analyze content to drive logic flows
-   **Optimization Logic**: Don't add "efficiency" logic that bypasses LLM decision-making
-   **Fallback Hierarchies**: Don't create multiple fallback layers (explicitly forbidden)
-   **Artificial Delays**: Never add sleep() or artificial delays - deliver responses immediately

## Development Best Practices

### **Always Verify the Correct Endpoint**
**CRITICAL**: Before implementing any fix, always verify which endpoint the frontend is actually using.

**Common Mistake**: Modifying one endpoint while the frontend uses a different one.
- **Example**: Fixing `/datamodel/chat` when frontend uses `/datamodel/chat/async`
- **Result**: Perfect implementation that does nothing because it's not the code path being executed

**Verification Steps**:
1. Check frontend network calls (browser dev tools)
2. Search codebase for multiple similar endpoints
3. Verify the exact URL path being called
4. Test with the actual endpoint before implementing
5. **Double check, triple check** - as the user reminds you!

**Remember**: A perfect solution for the wrong problem is worthless. Always identify the correct code path first.
- use the attached_assets\datamind-master\datamind-master\src\cli as your source reference