# Enhanced Prompt: Agentic Application Development Guidelines

-   **Build Generic Agentic Applications**
    -   Do **not** hardcode logic or workflows.\
    -   Always follow instruction-driven design (LLM interprets goals,
        not rigid code).
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
    -   Default to `model="gpt-5"` (unless overridden).\
    -   Prefer **streaming responses** whenever supported.
-   **Code Example (Baseline)**\

``` python
import os
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

response = client.responses.create(
    model="gpt-5",
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
